# Cowork Outlook MCP Server

A local [MCP](https://modelcontextprotocol.io/) server that gives Claude full access to Microsoft 365 email and calendar through the Microsoft Graph API. Built to be distributed as a standalone package — no secrets are baked in, no environment variables are required. Each user authenticates with their own Microsoft account through a browser-based OAuth flow.

Works with any Microsoft 365 account: work, school, or personal (outlook.com, hotmail.com, live.com).

## Non-destructive by design

This server is deliberately built so that it cannot cause irreversible harm, even if Claude is misdirected:

- **No delete.** Messages can only be archived (moved to Archive) or moved between folders. There is no delete operation.
- **No send.** Emails can only be created as drafts. There is no send operation, and the `Mail.Send` OAuth scope is never requested — the token is physically incapable of sending mail, even if a prompt injection attack tries to invoke it.
- **No calendar deletion.** Events can be created, updated, and RSVP'd to, but not deleted.

## Security

### Prompt injection protection

When Claude reads an email, the content passes through a multi-layer HTML sanitizer before it reaches the model. This prevents attackers from embedding hidden instructions in emails that could manipulate Claude's behaviour.

The sanitizer defends against:

| Attack vector | Defence |
|---------------|---------|
| Hidden text via CSS (`display:none`, `visibility:hidden`, `opacity:0`) | Detected and stripped, including element content |
| Zero-size text (`font-size:0`, `height:0`, `width:0`) | Detected and stripped |
| Off-screen positioning (`position:absolute; left:-9999px`) | Detected and stripped |
| Same-colour text/background (`color:white` on `background:white`) | Colour comparison detects and strips |
| `text-indent:-9999px` and `overflow:hidden` with zero dimensions | Detected and stripped |
| `aria-hidden="true"` elements | Stripped with content |
| Dangerous tags (`<script>`, `<style>`, `<iframe>`, `<svg>`, `<form>`, etc.) | Removed entirely including content |
| Invisible Unicode characters (zero-width spaces, joiners, BOM, directional marks) | Stripped |
| Unicode tag characters (U+E0001-U+E007F, used in homoglyph attacks) | Stripped |
| Tracking pixels (1x1 images) | Detected and removed |
| HTML comments (can hide instructions) | Removed |
| `data:` URIs and base64 in attributes | Removed |

Sanitized email content is wrapped in boundary markers (`--- BEGIN EMAIL CONTENT ---` / `--- END EMAIL CONTENT ---`) so Claude can clearly distinguish email content from its own instructions.

### Authentication security

- **OAuth 2.0 with PKCE** — No client secret is stored or transmitted. Authentication uses the Authorization Code flow with Proof Key for Code Exchange, a standard designed for public clients.
- **Localhost loopback** — During login, the server spins up a temporary HTTP listener on a random port. The browser redirects back to `http://localhost:{port}/callback` after authentication. The listener shuts down immediately after receiving the callback.
- **CSRF protection** — A random `state` parameter is generated for each login and validated on callback.
- **Local token storage** — Access and refresh tokens are stored only on the user's machine. They are never transmitted to any third party.
- **Automatic token refresh** — Tokens are refreshed 60 seconds before expiry. A concurrency guard ensures that if multiple tools fire simultaneously with an expired token, only a single refresh request is made.
- **Minimal scopes** — Only four OAuth scopes are requested: `offline_access`, `User.Read`, `Mail.ReadWrite`, `Calendars.ReadWrite`. Notably, `Mail.Send` is excluded.

### Scope justification

| Scope | Why |
|-------|-----|
| `offline_access` | Allows token refresh without re-authentication |
| `User.Read` | Validates the authenticated identity (`o365_whoami`) |
| `Mail.ReadWrite` | Read messages, create drafts, move/archive messages, manage folders |
| `Calendars.ReadWrite` | Read/create/update events, RSVP |

## Tools (18)

### Authentication

| Tool | Description |
|------|-------------|
| `o365_login` | Opens a browser window for Microsoft sign-in. Tokens are saved locally. |
| `o365_logout` | Removes stored tokens from this machine. |
| `o365_whoami` | Shows the currently authenticated user. |

### Email

| Tool | Description |
|------|-------------|
| `list_messages` | List messages from inbox or a specific folder. Supports pagination via `top`/`skip`. |
| `get_message` | Read a full email with HTML sanitized to safe plain text. |
| `search_messages` | Search emails by keyword. Supports [KQL syntax](https://learn.microsoft.com/en-us/graph/search-query-parameter) (`subject:`, `from:`, etc.). |
| `list_mail_folders` | List all mail folders with unread/total counts. |
| `create_mail_folder` | Create a new top-level folder or subfolder. |
| `move_message` | Move one or more messages to any folder. |
| `archive_message` | Move one or more messages to the Archive folder. |
| `mark_message_read` | Mark a message as read or unread. |
| `create_draft` | Create a draft email. Does **not** send. |

### Calendar

| Tool | Description |
|------|-------------|
| `list_calendars` | List all calendars the user has access to. |
| `list_events` | List events in a date range. Recurring events are automatically expanded into individual occurrences. Supports auto-pagination for large ranges. |
| `get_event` | Get full event details including attendees, recurrence pattern, and online meeting link. |
| `create_event` | Create an event with support for attendees, locations, recurrence patterns (daily, weekly, monthly, yearly), all-day events, and specific calendars. |
| `update_event` | Update an existing event. Only changed fields are sent. |
| `rsvp_event` | Accept, tentatively accept, or decline a calendar event. |

## Setup

### 1. Install

```bash
git clone <this-repo>
cd cowork-outlook-plugin
npm install
npm run build
```

No environment variables are needed. The Azure AD app client ID is embedded in the package.

### 2. Connect to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "outlook": {
      "command": "node",
      "args": ["/path/to/cowork-outlook-plugin/build/index.js"]
    }
  }
}
```

### 3. Authenticate

Tell Claude:

> Log in to my Microsoft 365 account

Claude will call `o365_login`, which opens your browser to the Microsoft sign-in page. After you sign in and consent to the permissions, the browser redirects to a localhost callback, the tokens are saved, and you're ready to go.

If your organisation requires admin consent, a tenant admin will need to approve the app first. Users in the app's home tenant have consent pre-granted.

## Token storage

Tokens are stored locally on your machine:

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\cowork-outlook-mcp\tokens.json` |
| macOS | `~/Library/Application Support/cowork-outlook-mcp/tokens.json` |
| Linux | `~/.config/cowork-outlook-mcp/tokens.json` |

- Access tokens last ~1 hour and refresh automatically (with a 60-second buffer).
- Refresh tokens last ~90 days (rolling). If you don't use the server for 90 days, you'll need to log in again.
- Run `o365_logout` to remove stored tokens.

## Development

```bash
npm test              # Run all 166 tests
npm run test:watch    # Watch mode
npm run dev           # Dev mode with tsx hot reload
npm run build         # Compile TypeScript to build/
```

### Testing

The project is built with test-driven development. Every tool, the auth layer, the HTML sanitizer, and the Graph client are covered by tests using [Vitest](https://vitest.dev/) and [MSW](https://mswjs.io/) (Mock Service Worker) for HTTP-level mocking.

```
test/
├── auth/
│   ├── graph-client.test.ts   # 12 tests (GET/POST/PATCH, auto-refresh, concurrency, pagination)
│   ├── oauth.test.ts          # 15 tests (PKCE, localhost callback, token exchange, full flow)
│   └── token-store.test.ts    #  9 tests (save/load/delete, expiry detection)
├── tools/
│   ├── mail/                  # 50 tests across 9 files
│   └── calendar/              # 41 tests across 6 files
└── utils/
    └── html-sanitizer.test.ts # 39 tests (every attack vector listed above)
```

### Architecture

```
src/
├── index.ts                    # MCP server entry point (stdio transport)
├── config.ts                   # Hardcoded client ID, scopes, token paths
├── auth/
│   ├── oauth.ts                # OAuth 2.0 Authorization Code + PKCE flow
│   ├── token-store.ts          # Local token persistence
│   └── graph-client.ts         # Authenticated Graph API client (auto-refresh, pagination, concurrency guard)
├── tools/
│   ├── types.ts                # GraphClient and ToolDefinition interfaces
│   ├── index.ts                # Tool registry (assembles all tools)
│   ├── auth/                   # Login (PKCE + localhost), logout, whoami
│   ├── mail/                   # 9 email tools
│   └── calendar/               # 6 calendar tools
├── utils/
│   └── html-sanitizer.ts       # Prompt injection defence for email content
└── types/
    ├── config.ts               # OAuth and token types
    └── graph.ts                # Microsoft Graph API response types
```

## How it works

```
┌──────────┐    stdio     ┌────────────────────┐    HTTPS    ┌──────────────────┐
│  Claude   │◄───────────►│  MCP Server (local) │◄──────────►│  Microsoft Graph │
└──────────┘              └────────────────────┘             └──────────────────┘
                                   │
                                   ▼
                          ~/.../tokens.json
                          (local token cache)
```

1. Claude sends a tool call over stdio (e.g., `list_messages`)
2. The MCP server checks for valid tokens, refreshing if needed
3. The server makes the Graph API call with the user's access token
4. The response is formatted (emails are sanitized) and returned to Claude

No data passes through any intermediary. The MCP server runs locally and talks directly to Microsoft's Graph API.

## Azure AD app registration (for contributors)

The app is already registered and its client ID is embedded in the source. If you need to register your own:

1. Go to [Azure Portal > App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **New registration**
3. Configure:
   - **Name:** Whatever you like
   - **Supported account types:** "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI:** Leave blank
4. After registration:
   - Go to **Authentication** > enable **Allow public client flows**
   - Under **Mobile and desktop applications**, add redirect URI: `http://localhost`
   - Go to **API permissions** > add Microsoft Graph delegated permissions: `offline_access`, `User.Read`, `Mail.ReadWrite`, `Calendars.ReadWrite`
   - If you're a tenant admin, grant admin consent
5. Replace the `CLIENT_ID` constant in `src/config.ts` with your app's client ID

## License

MIT
