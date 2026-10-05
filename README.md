# Invitations

A private invitation app for family parties: Paperless Post–style designs, no ads, no accounts, free to send.

- **Guests** open a link, tap an envelope that opens into the invitation, and reply. They give a name plus an email or mobile number, and never create an account.
- **Hosts** create events, pick a design, manage the guest list, see who's coming, export a CSV, and send invitations and reminders from their own Gmail (or by text from their phone).

First-time setup: see **[SETUP.md](SETUP.md)**. Until the backend is connected, the site runs in demo mode.

## How it fits together

```
GitHub Pages (this repo, static)          Google Apps Script (your account)
├─ diwali.html?e=<event>&g=<guest>  ───►  backend/Code.gs  (web app, Sheet store, Gmail)
│  envelope → card → reply                backend/core.js  (all the rules; also runs the demo)
├─ host.html#k=<host key>           ───►          │
│  events, replies, guests, send, editor          ▼
└─ themes/<id>/  (art, styles, wording)   One Google Sheet: Hosts · Events · Guests · Log
```

- **One Sheet for every party.** Each event is a row in `Events`. Each guest, along with their latest reply, is a row in `Guests`. `Log` keeps a history of replies and sends.
- **Access.** Each host has a private key carried in their link after `#`, so it never reaches server logs. The owner sees and manages everything, including the list of hosts. A family host sees only the events they host. Guests use personal links that carry an unguessable token, or the event's open link if it is switched on.
- **Same code in two places.** `backend/core.js` runs inside Apps Script and in the browser's demo mode, so the demo behaves exactly like the real thing.

## Files

| Path | What it is |
| --- | --- |
| `diwali.html`, `invite.html` | Guest page. `diwali.html` carries the Diwali link-preview image; `invite.html` works for any theme. |
| `host.html` | Host app. |
| `js/invite.js` | Guest flow: envelope, opening animation, card, reply, thank-you. |
| `js/host.js` | Host app: events, replies dashboard, guests, send, editor with live preview, hosts. |
| `js/render.js` | Guest markup shared by every theme (details, who's coming, form, thank-you, calendar). |
| `js/api.js`, `js/config.js` | API client and demo mode; `config.js` holds the backend URL. |
| `backend/core.js` | Data rules, validation, permissions, email building, daily reminders. |
| `backend/Code.gs` | Apps Script entry points, Sheet storage, `setup()`, daily job. |
| `themes/registry.js` | Theme loader. |
| `themes/diwali/` | Diwali theme: SVG motifs, 6 card designs (Lanterns & Mandala, Saffron Arch, Marigold Carnival, Plum Lights, Rangoli Moon, Marigold Toran), styles, email and preview images. |
| `tools/render-images.js` | Regenerates a theme's email stamps and link-preview image. |
| `tests/` | Unit tests for the core and for Code.gs against a fake Sheet. |

## Adding a theme

1. Add the theme to `backend/core.js` (`THEMES`): its page, its card designs (`templates`) and each design's palette (swatches plus the text and button colors emails use).
2. Create `themes/<id>/theme.js` that calls `Themes.register({...})` with fonts, default wording, at least three card designs, and `envelope()`, `card()` and `hero()` renderers. Copy the Diwali theme as a starting point.
3. Add `themes/<id>/theme.css`: style the shared classes (`.details`, `.rsvp`, `.thanks` and so on) under `.t-<id>`, and set each design's page colors under `.t-<id>.tpl-<design>`. Then add the theme to `list` in `themes/registry.js`.
4. Copy `diwali.html` to `<id>.html` and update its preview tags.
5. Serve the repo locally and run `node tools/render-images.js <id>` for the email stamps and preview image (the theme provides `stampArt()` and `previewArt()`).

## Developing

```sh
python3 -m http.server 8765        # then open http://localhost:8765/host.html (demo mode)
node --test tests/core.test.js tests/gas.test.js
```
