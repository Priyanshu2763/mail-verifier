'use strict';

const net = require('net');
const config = require('../config');

// SMTP response code meanings relevant to us
const SMTP_VALID_CODES = new Set(['250', '251']);
const SMTP_INVALID_CODES = new Set(['550', '551', '552', '553', '554', '450', '452', '553']);
const SMTP_UNVERIFIABLE_CODES = new Set(['421', '450', '451', '452']);

/**
 * Perform a fake SMTP handshake to check if a mailbox exists.
 * Connects → EHLO → MAIL FROM → RCPT TO → QUIT
 * Never sends DATA — no actual email is sent.
 *
 * @param {string} email  - The address to verify
 * @param {string} mxHost - The primary MX host to connect to
 * @returns {Promise<{ checked: boolean, exists: boolean|null, verdict: string, reason: string }>}
 */
async function checkSmtp(email, mxHost) {
  if (!config.validation.enableSmtp) {
    return {
      checked: false,
      exists: null,
      verdict: 'SKIPPED',
      reason: 'SMTP check disabled (set ENABLE_SMTP=true to enable)',
    };
  }

  return new Promise(resolve => {
    const timeoutMs = config.validation.smtpTimeoutMs;
    let settled = false;
    let buffer = '';
    let stage = 'CONNECT';

    const finish = (result) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch (_) {}
      resolve(result);
    };

    const socket = new net.Socket();
    socket.setEncoding('utf8');
    socket.setTimeout(timeoutMs);

    socket.on('timeout', () => {
      finish({ checked: true, exists: null, verdict: 'UNVERIFIABLE', reason: 'SMTP connection timed out' });
    });

    socket.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        finish({ checked: true, exists: null, verdict: 'UNVERIFIABLE', reason: 'SMTP port 25 refused (likely blocked by cloud provider)' });
      } else {
        finish({ checked: true, exists: null, verdict: 'UNVERIFIABLE', reason: `SMTP connection error: ${err.code || err.message}` });
      }
    });

    socket.on('data', (data) => {
      buffer += data;

      // Process complete lines (responses end with \r\n)
      const lines = buffer.split('\r\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line) continue;
        const code = line.slice(0, 3);

        // Multi-line responses: "250-" means more lines follow
        if (line[3] === '-') continue;

        handleResponse(code, line);
      }
    });

    function send(cmd) {
      try {
        socket.write(cmd + '\r\n');
      } catch (err) {
        finish({ checked: true, exists: null, verdict: 'UNVERIFIABLE', reason: `Write error: ${err.message}` });
      }
    }

    function handleResponse(code, line) {
      switch (stage) {
        case 'CONNECT':
          if (code === '220') {
            stage = 'EHLO';
            send('EHLO mail-validator.local');
          } else {
            finish({ checked: true, exists: null, catchAll: false, verdict: 'UNVERIFIABLE', reason: `Unexpected banner: ${line}` });
          }
          break;

        case 'EHLO':
          if (code === '250') {
            stage = 'MAIL_FROM';
            send('MAIL FROM:<validator@mail-validator.local>');
          } else {
            finish({ checked: true, exists: null, catchAll: false, verdict: 'UNVERIFIABLE', reason: `EHLO rejected: ${line}` });
          }
          break;

        case 'MAIL_FROM':
          if (code === '250') {
            stage = 'RCPT_TO_REAL';
            send(`RCPT TO:<${email}>`);
          } else {
            finish({ checked: true, exists: null, catchAll: false, verdict: 'UNVERIFIABLE', reason: `MAIL FROM rejected: ${line}` });
          }
          break;

        case 'RCPT_TO_REAL':
          if (SMTP_VALID_CODES.has(code)) {
            // Real email accepted. But is it a catch-all? Let's check a fake address on the same connection.
            const domain = email.slice(email.lastIndexOf('@') + 1);
            const fakeEmail = `fake_test_123xyz_${Date.now()}@${domain}`;
            stage = 'RCPT_TO_FAKE';
            send(`RCPT TO:<${fakeEmail}>`);
            socket.realEmailResponse = code + ': ' + line;
          } else if (SMTP_INVALID_CODES.has(code)) {
            stage = 'QUIT';
            send('QUIT');
            finish({ checked: true, exists: false, catchAll: false, verdict: 'REJECTED', reason: `Server responded ${code}: ${line}` });
          } else if (SMTP_UNVERIFIABLE_CODES.has(code)) {
            stage = 'QUIT';
            send('QUIT');
            finish({ checked: true, exists: null, catchAll: false, verdict: 'GREYLISTED', reason: `Greylisted or temp error: ${line}` });
          } else {
            stage = 'QUIT';
            send('QUIT');
            finish({ checked: true, exists: null, catchAll: false, verdict: 'UNVERIFIABLE', reason: `Ambiguous response ${code}: ${line}` });
          }
          break;

        case 'RCPT_TO_FAKE':
          stage = 'QUIT';
          send('QUIT');
          if (SMTP_VALID_CODES.has(code)) {
            // Fake email was ALSO accepted -> Catch-all!
            finish({ checked: true, exists: null, catchAll: true, verdict: 'CATCH_ALL', reason: 'Domain is a catch-all (always returns OK)' });
          } else {
            // Fake email was rejected, meaning the real email's acceptance was genuine!
            finish({ checked: true, exists: true, catchAll: false, verdict: 'ACCEPTED', reason: `Server responded ${socket.realEmailResponse}` });
          }
          break;

        case 'QUIT':
          // Done — socket will close
          break;

        default:
          break;
      }
    }

    socket.connect(25, mxHost);
  });
}

module.exports = { checkSmtp };
