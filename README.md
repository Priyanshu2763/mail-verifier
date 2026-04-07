# 📧 Email Validator

> Production-ready, **zero-cost** email existence validator built in pure Node.js.  
> No paid APIs. No heavy dependencies. Just DNS, SMTP, and smart logic.

---

## ✨ Features

- ✅ 4-layer validation pipeline — syntax → disposable → DNS/MX → SMTP
- ✅ 5,360+ known disposable/throwaway domains blocked
- ✅ In-memory caching (avoid redundant lookups)
- ✅ REST API with single + bulk endpoints (up to 50 emails)
- ✅ Beautiful browser dashboard UI
- ✅ CLI with colored output, file mode, and interactive REPL
- ✅ Rate limiting built-in
- ✅ Zero paid APIs — completely free to run

---

## ⚠️ Limitations — Read This First

| Domain Type | Works? | Why |
|---|---|---|
| Custom / business domains | ✅ Yes | SMTP responds honestly |
| Small providers | ✅ Yes | SMTP responds honestly |
| **Gmail** | ⚠️ Partial | **Catch-all: accepts any address to prevent spam harvesting** |
| **Yahoo** | ⚠️ Partial | **Catch-all: always responds 250 OK regardless of mailbox existence** |
| **Hotmail / Outlook** | ⚠️ Partial | **Catch-all: same anti-enumeration policy** |
| Disposable (Mailinator etc.) | ✅ Blocked | Detected by domain blocklist |
| Nonexistent domains | ✅ Caught | DNS/MX lookup fails immediately |

> **TL;DR:** For Yahoo, Gmail, and Hotmail — the validator tells you the **domain** is real and reachable, but cannot confirm the **mailbox** exists. This is a deliberate policy by those providers, not a bug in this tool. No free tool in the world can bypass it.  
> The only 100% accurate method for these providers is **double opt-in** (send a confirmation email).

---

## 🏗️ Architecture

```
Email Input
    │
    ▼
┌─────────────────────┐
│  Layer 1: Syntax    │  RFC 5322 format check, length limits, role detection
└────────┬────────────┘
         │ PASS
         ▼
┌─────────────────────┐
│ Layer 2: Disposable │  Checks against 5,360+ known throwaway domains
└────────┬────────────┘
         │ PASS
         ▼
┌─────────────────────┐
│ Layer 3: DNS / MX   │  Resolves MX records, probes port 25 (TCP only)
└────────┬────────────┘
         │ PASS
         ▼
┌─────────────────────┐
│ Layer 4: SMTP Probe │  Fake handshake up to RCPT TO — no email sent
└────────┬────────────┘  (Only runs when ENABLE_SMTP=true)
         │
         ▼
  Verdict + Score (0–100)
```

### Verdict Types

| Verdict | Meaning |
|---|---|
| `VALID` | Passed all enabled checks |
| `INVALID` | Bad syntax or SMTP explicitly rejected |
| `DISPOSABLE` | Known throwaway/temp domain |
| `NO_MX` | Domain has no mail servers |
| `UNVERIFIABLE` | MX exists but SMTP blocked or catch-all |
| `RISKY` | Passes minimum checks but low confidence |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v16+
- Git

### 1. Clone the repo

```bash
# With GitHub token (for private repos)
git clone https://<YOUR_TOKEN>@github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
cd <YOUR_REPO>

# Public repo
git clone https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
cd <YOUR_REPO>
```

### 2. Install dependencies

```bash
npm install
```

### 3. Download disposable domains list

```bash
mkdir -p src/data
curl -fsSL "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf" \
  -o src/data/disposable-domains.txt
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` as needed:

```env
PORT=3000
ENABLE_SMTP=false       # Set true only on bare-metal/VPS (cloud blocks port 25)
DNS_TIMEOUT_MS=5000
SMTP_TIMEOUT_MS=10000
CACHE_TTL_SECONDS=3600
RATE_LIMIT_MAX=100
```

### 5. Start the server

```bash
node src/server.js
```

Open your browser at **http://localhost:3000** or **http://\<SERVER_IP\>:3000**

---

## 🔁 Keep It Running (Production)

```bash
# Install PM2 process manager
npm install -g pm2

# Start and persist
pm2 start src/server.js --name email-validator
pm2 save
pm2 startup    # Run the printed command to auto-start on reboot
```

---

## 🌐 REST API

### Single Email

```bash
curl "http://localhost:3000/validate?email=user@example.com"
```

**Response:**
```json
{
  "email": "user@example.com",
  "valid": true,
  "score": 85,
  "verdict": "VALID",
  "details": {
    "syntax":     { "valid": true, "isRole": false },
    "disposable": { "isDisposable": false, "domain": "example.com" },
    "dns":        { "hasMx": true, "mxRecords": [...], "portOpen": true },
    "smtp":       { "checked": true, "exists": true, "verdict": "ACCEPTED" }
  },
  "cached": false,
  "duration_ms": 142
}
```

### Bulk Emails (up to 50)

```bash
curl -X POST http://localhost:3000/validate/bulk \
  -H "Content-Type: application/json" \
  -d '{"emails": ["a@gmail.com", "fake@mailinator.com", "bad@notexists.xyz"]}'
```

### Health Check

```bash
curl http://localhost:3000/health
```

---

## 💻 CLI Usage

```bash
# Single email
node src/cli.js user@gmail.com

# Bulk from file (one email per line)
node src/cli.js --file emails.txt

# Interactive REPL mode
node src/cli.js --interactive

# Help
node src/cli.js --help
```

---

## 🧪 Run Tests

```bash
npm test
```

Expected: **31/31 tests pass** across syntax, disposable, DNS, and end-to-end layers.

---

## 📁 Project Structure

```
├── src/
│   ├── config.js            # Env-based config (no dotenv dep)
│   ├── cache.js             # In-memory TTL cache
│   ├── validator.js         # Pipeline orchestrator
│   ├── server.js            # REST API (pure Node.js http)
│   ├── cli.js               # CLI interface
│   ├── server-ui.html       # Browser dashboard
│   └── validators/
│       ├── syntax.js        # Layer 1 — RFC 5322 format
│       ├── disposable.js    # Layer 2 — Throwaway domain check
│       ├── dns.js           # Layer 3 — MX record lookup
│       └── smtp.js          # Layer 4 — SMTP handshake probe
├── tests/
│   ├── syntax.test.js
│   ├── disposable.test.js
│   ├── dns.test.js
│   ├── validator.test.js
│   └── run-tests.sh
├── .env.example
└── package.json
```

---

## 🔒 Firewall / Port Access

```bash
# Ubuntu/Debian
sudo ufw allow 3000/tcp

# Or run on port 80 (no port number in URL)
sudo setcap 'cap_net_bind_service=+ep' $(which node)
# Then set PORT=80 in .env
```

For AWS/GCP/Azure — add an **inbound rule** in your security group/firewall for the chosen port.

---

## 📄 License

MIT
