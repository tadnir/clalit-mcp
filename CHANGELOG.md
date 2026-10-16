# Changelog

## Unreleased

- **Documents:** visit summaries, hospital summaries, medical approvals and Form 17 (`list_documents` / `get_document`); a search splits its date range so results past the portal's 10-row page are found.
- **Sign-in from the MCP server:** `clalit_login` returns a link to a sign-in page the server serves itself; the ID, CAPTCHA and SMS code are typed there, never in the chat.
- **Keep-alive:** while the MCP server runs it keeps the Clalit session alive and signs out at the end of the length chosen at sign-in (1 hour to 1 week). `clalit_session_status` and `clalit_logout` added.

- Public repo cleanup: agent skill, docs, CI, GitHub-only install (no npm publish).
- **CLI + MCP only** — `@clalit/core` stays a private workspace package, not a public SDK.
- **Reads:** prescriptions list + issue status; lab orders list + detail (fixtures; no PDFs).
- **Login:** browser-only loopback `login` (CAPTCHA + SMS OTP); CAPTCHA/WebForms fixes, OTP diagnostics, session save race fix.
- **Still out:** `MedicalReferrals.aspx`, prescription/lab-order PDFs.

## 0.1.0 — 2026-09-29

- Initial scaffold: `@clalit/core`, `@clalit/cli`, `@clalit/mcp`.
- Labs MVP: `listLabs`, `getLabResult`, `getLabDocument` (WebForms HTML fixtures).
- Interactive login (CAPTCHA + SMS OTP); live verify on a residential machine.
- Roadmap notes for מרשמים / הפניות (no invented endpoints).
