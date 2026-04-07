'use strict';

const https = require('https');

/**
 * Check if the email belongs to Microsoft (Outlook, Hotmail, Live, MSN).
 * Uses the unofficial GetCredentialType API to detect if account exists without SMTP.
 * @param {string} email
 * @returns {Promise<{ isMicrosoft: boolean, exists: boolean|null, reason: string|null }>}
 */
function checkMicrosoft(email) {
  return new Promise((resolve) => {
    const isMsDomain = /@(outlook|hotmail|live|msn)\.(com|co\.uk|net|org|es|fr|it|de|ca|com\.au)$/i.test(email);
    if (!isMsDomain) {
      return resolve({ isMicrosoft: false, exists: null, reason: null });
    }

    const data = JSON.stringify({ Username: email });
    const options = {
      hostname: 'login.microsoftonline.com',
      path: '/common/GetCredentialType',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 5000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          // If IfExistsResult is 0, the account exists. If 1, it doesn't.
          const exists = json.IfExistsResult === 0;
          resolve({ isMicrosoft: true, exists, reason: `Microsoft API returned IfExistsResult: ${json.IfExistsResult}` });
        } catch (e) {
          resolve({ isMicrosoft: true, exists: null, reason: 'Failed to parse Microsoft API response' });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ isMicrosoft: true, exists: null, reason: `Microsoft API error: ${e.message}` });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ isMicrosoft: true, exists: null, reason: 'Microsoft API timeout' });
    });

    req.write(data);
    req.end();
  });
}

module.exports = { checkMicrosoft };
