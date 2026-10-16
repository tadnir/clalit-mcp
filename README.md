# clalit-mcp

**Read your own Clalit Health Services records (lab results, prescriptions, lab orders, visit and hospital summaries) from an AI assistant over MCP, or from a CLI.**

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Unofficial. Not affiliated with Clalit. Not a substitute for the official portal or clinical advice.

Based on [netanelavr/clalit-mcp](https://github.com/netanelavr/clalit-mcp) by Netanel Avraham (MIT). This version adds the document readers and moves sign-in and session keep-alive into the MCP server itself, so it works as a plain local MCP server and can also run as one long-lived copy for several clients.

Everything runs on your machine. You sign in through your own browser, the session is saved only on your computer, and this project has no hosted backend and collects nothing. Whatever your AI client requests is passed to that client and handled under its provider's privacy terms.

## Terms of use

- **Own account only.** Never use this against someone else's record.
- **Read-only.** No booking, payments, profile writes, or prescription requests.
- **No CAPTCHA, bot or Imperva bypass.** You solve the CAPTCHA and enter the SMS code yourself.
- **Residential connection.** Clalit's Imperva turns most datacenter and cloud IPs away (Error 16). Run it at home.
- **The session file is secret.** It is saved with mode `0600` under `~/.config/clalit-mcp/`. Never commit or paste it.

## Install

```sh
git clone https://github.com/tadnir/clalit-mcp.git
cd clalit-mcp
npm install
npm test
```

## Use it from an MCP client

Add the server to your client. For Claude Code, Cursor and most clients:

```json
{
  "mcpServers": {
    "clalit": {
      "command": "npx",
      "args": ["tsx", "packages/cli/src/main.ts", "mcp"],
      "cwd": "/absolute/path/to/clalit-mcp"
    }
  }
}
```

Claude Desktop does not see your shell's `PATH`, so give it absolute paths (find node with `which node`):

```json
{
  "mcpServers": {
    "clalit": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/path/to/clalit-mcp/node_modules/.bin/tsx",
        "/absolute/path/to/clalit-mcp/packages/cli/src/main.ts",
        "mcp"
      ]
    }
  }
}
```

### Signing in

1. Ask your assistant for something, for example "list my lab results from this year".
2. While nobody is signed in, the tools answer with a link to a sign-in page this server serves on `http://localhost:8765/`. `clalit_login` returns the same link.
3. Open it, pick how long to stay signed in (1 hour to 1 week), and enter your ID, the CAPTCHA and the SMS code there.
4. Ask again. The server now keeps the session alive while it runs and signs out at the end of the length you picked.

Your ID and the codes are only ever typed on that page. The assistant only ever sees the link, and the tools tell it never to ask for them in the chat.

The keep-alive only runs while your client keeps the server running. If the client is closed for more than about ten minutes, Clalit ends the session and you sign in again next time. To keep one session alive across days, see [docs/HOSTING.md](docs/HOSTING.md).

### Tools

| Tool | What it reads |
| --- | --- |
| `list_labs`, `get_lab_result`, `get_lab_document` | Lab history, one result, the original lab PDF |
| `list_prescriptions`, `get_prescription_issue_status` | Prescriptions and their pharmacy issue status |
| `list_lab_orders`, `get_lab_order` | Lab orders and one order's detail |
| `list_documents`, `get_document` | Visit summaries, hospital summaries, medical approvals, Form 17, and their PDFs |
| `clalit_login`, `clalit_session_status`, `clalit_logout` | The sign-in link, whether a session is live and until when, and sign-out |

### Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `CLALIT_CONFIG_DIR` | `~/.config/clalit-mcp` | Where the session is saved |
| `CLALIT_LOGIN_HOST` | `127.0.0.1` | Address the sign-in page listens on |
| `CLALIT_LOGIN_PORT` | `8765` | Its port; a free one is used if another copy holds it |
| `CLALIT_LOGIN_URL` | `http://localhost:<port>/` | The link handed out, when the page sits behind a reverse proxy |

## CLI

The CLI shares the same session file, so signing in from either one works for both.

```sh
npx tsx packages/cli/src/main.ts login
npx tsx packages/cli/src/main.ts labs --json
npx tsx packages/cli/src/main.ts lab --ref <token-from-labs> --json
npx tsx packages/cli/src/main.ts lab-document --ref <token> --out result.pdf
npx tsx packages/cli/src/main.ts prescriptions --json
npx tsx packages/cli/src/main.ts lab-orders --json
npx tsx packages/cli/src/main.ts documents --source visit_summaries --json
npx tsx packages/cli/src/main.ts document --ref <token-from-documents> --out summary.pdf
npx tsx packages/cli/src/main.ts help
```

See [docs/](docs/README.md) for the sign-in flow, the portal pages used and a first live check.

## License

[MIT](LICENSE)
