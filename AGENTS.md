# AGENTS.md

## Cursor Cloud specific instructions

This is a single-service Node.js/Express personal portfolio site (samet.works).

### Running the dev server

```
npm run dev        # starts Express on http://localhost:3000
```

### Key notes

- No test framework is configured; `npm test` exits with an error by design.
- No linter/formatter is configured in `package.json`. Tailwind CSS v4 is a dev dependency for CSS compilation only.
- All external integrations (Google Sheets, ipapi.co) degrade gracefully without credentials — no secrets are required to run the app locally.
- The CMS page (`/cms`) is password-protected; the password is hardcoded in `cms.html`.
- Data is stored in flat JSON files (`resources.json`, `writings.json`, `lastVisitor.json`) — no database needed.
- The server requires Node.js 18+ (uses built-in `fetch`).
