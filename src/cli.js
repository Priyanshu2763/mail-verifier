'use strict';

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { validate } = require('./validator');

// ─── ANSI Colors ──────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
};

const VERDICT_COLOR = {
  VALID: C.green,
  INVALID: C.red,
  DISPOSABLE: C.yellow,
  NO_MX: C.red,
  UNVERIFIABLE: C.yellow,
  RISKY: C.magenta,
};

// ─── Formatting ───────────────────────────────────────────────────────────────
function icon(condition) {
  return condition ? `${C.green}✔${C.reset}` : `${C.red}✖${C.reset}`;
}

function scoreBar(score) {
  const filled = Math.round(score / 5);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
  const color = score >= 75 ? C.green : score >= 50 ? C.yellow : C.red;
  return `${color}${bar}${C.reset} ${score}/100`;
}

function printResult(result) {
  const vc = VERDICT_COLOR[result.verdict] || C.reset;
  console.log('');
  console.log(`${C.bold}Email:${C.reset}   ${result.email}`);
  console.log(`${C.bold}Verdict:${C.reset} ${vc}${C.bold}${result.verdict}${C.reset}`);
  console.log(`${C.bold}Score:${C.reset}   ${scoreBar(result.score)}`);
  console.log(`${C.bold}Valid:${C.reset}   ${result.valid ? `${C.green}Yes${C.reset}` : `${C.red}No${C.reset}`}`);
  console.log(`${C.bold}Cached:${C.reset}  ${result.cached ? 'Yes' : 'No'}`);
  console.log(`${C.bold}Time:${C.reset}    ${result.duration_ms}ms`);
  console.log('');

  const d = result.details;
  if (d.syntax) {
    console.log(`  ${icon(d.syntax.valid)} Syntax: ${d.syntax.valid ? 'Valid' : d.syntax.reason}`);
    if (d.syntax.isRole) console.log(`  ${C.yellow}⚠${C.reset}  Role-based address detected`);
  }
  if (d.disposable) {
    console.log(`  ${icon(!d.disposable.isDisposable)} Disposable: ${d.disposable.isDisposable ? `Yes (${d.disposable.domain})` : 'No'}`);
  }
  if (d.dns) {
    console.log(`  ${icon(d.dns.hasMx)} MX Records: ${d.dns.hasMx ? d.dns.mxRecords.map(r => r.host).join(', ') : (d.dns.reason || 'None found')}`);
    if (d.dns.hasMx) {
      const portStatus = d.dns.portOpen === true ? `${C.green}Open${C.reset}` : d.dns.portOpen === false ? `${C.red}Closed/Blocked${C.reset}` : `${C.gray}Unknown${C.reset}`;
      console.log(`  ${icon(d.dns.portOpen !== false)} Port 25: ${portStatus}`);
    }
  }
  if (d.smtp) {
    const smtpIcon = d.smtp.exists === true ? icon(true) : d.smtp.exists === false ? icon(false) : `${C.yellow}~${C.reset}`;
    console.log(`  ${smtpIcon} SMTP: ${d.smtp.verdict} — ${d.smtp.reason}`);
  }
  console.log('');
}

async function validateAndPrint(email) {
  process.stdout.write(`${C.gray}  Validating ${email}...${C.reset}\r`);
  const result = await validate(email);
  printResult(result);
  return result;
}

// ─── Modes ────────────────────────────────────────────────────────────────────
async function runSingle(email) {
  const result = await validateAndPrint(email);
  process.exit(result.valid ? 0 : 1);
}

async function runFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`${C.red}Error: File not found: ${resolved}${C.reset}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(resolved, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    console.error(`${C.red}Error: File is empty${C.reset}`);
    process.exit(1);
  }

  console.log(`${C.bold}Validating ${lines.length} email(s) from ${path.basename(filePath)}...${C.reset}\n`);

  const results = [];
  for (const email of lines) {
    const result = await validateAndPrint(email);
    results.push(result);
  }

  // Summary
  const valid = results.filter(r => r.valid).length;
  const invalid = results.length - valid;
  console.log(`${C.bold}Summary:${C.reset} ${C.green}${valid} valid${C.reset}  |  ${C.red}${invalid} invalid${C.reset}  |  Total: ${results.length}`);
}

function runInteractive() {
  console.log(`\n${C.bold}${C.cyan}📧 Email Validator — Interactive Mode${C.reset}`);
  console.log(`${C.gray}Type an email address and press Enter. Type 'exit' to quit.${C.reset}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = () => {
    rl.question(`${C.bold}Email > ${C.reset}`, async (input) => {
      const trimmed = input.trim();
      if (!trimmed || trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log(`${C.gray}Goodbye!${C.reset}`);
        rl.close();
        return;
      }
      await validateAndPrint(trimmed);
      ask();
    });
  };

  ask();
}

function printHelp() {
  console.log(`
${C.bold}📧 Email Validator — CLI${C.reset}

${C.bold}Usage:${C.reset}
  node src/cli.js <email>                  Validate a single email
  node src/cli.js --file <path>            Validate emails from a file (one per line)
  node src/cli.js --interactive            Interactive REPL mode
  node src/cli.js --help                   Show this help

${C.bold}Examples:${C.reset}
  node src/cli.js user@gmail.com
  node src/cli.js --file emails.txt
  node src/cli.js --interactive

${C.bold}Environment variables:${C.reset}
  ENABLE_SMTP=true        Enable SMTP mailbox probing (port 25 must be open)
  DNS_TIMEOUT_MS=5000     DNS lookup timeout in milliseconds
  SMTP_TIMEOUT_MS=10000   SMTP probe timeout in milliseconds
`);
}

// ─── Entry Point ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  printHelp();
  process.exit(0);
}

if (args[0] === '--interactive' || args[0] === '-i') {
  runInteractive();
} else if (args[0] === '--file' || args[0] === '-f') {
  if (!args[1]) {
    console.error(`${C.red}Error: --file requires a file path${C.reset}`);
    process.exit(1);
  }
  runFile(args[1]);
} else {
  runSingle(args[0]);
}
