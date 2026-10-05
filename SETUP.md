# Setup

About 15 minutes, once. After this, every new party is created in the host page; you never touch the Sheet or this guide again.

## 1. Turn on the website (GitHub Pages)

1. In this repo on GitHub: **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*, then **Branch** to `main` and folder `/ (root)`. Save.
3. After a minute the site is live at **https://nidhihgupta.github.io/invitations/**.

Until step 4 is done, the site runs in **demo mode**: open `host.html` and choose *Explore the demo*. Demo data stays in your browser and emails go to a pretend outbox.

## 2. Create the Sheet and paste the backend

1. Go to [sheets.new](https://sheets.new) and name the spreadsheet **Invitations**. This one Sheet holds every party.
2. In the Sheet: **Extensions → Apps Script**. Name the project **Invitations** (top left).
3. Replace everything in `Code.gs` with the contents of [`backend/Code.gs`](backend/Code.gs).
4. Click **+** next to *Files* → **Script**, name it `Core`, and paste the contents of [`backend/core.js`](backend/core.js).
5. Set the time zone: **Project Settings** (gear icon) → tick *Show "appsscript.json" manifest file in editor*. Back in the editor, open `appsscript.json` and set `"timeZone": "America/Los_Angeles"` (or your own). This decides when "today" starts for reminders and for closing replies after the party.
6. Click **Save** (disk icon).

## 3. Run setup once

1. In the toolbar's function menu, choose **setup**, then click **Run**.
2. Google asks for permission. Because this is your own script, it shows *Google hasn't verified this app*: click **Advanced → Go to Invitations (unsafe)** → **Allow**. The script can read and write this Sheet, send email as you, and run a daily job.
3. When it finishes, the **Execution log** shows a line like
   `Your private host link (keep it secret): https://nidhihgupta.github.io/invitations/host.html#k=…`
   Copy it somewhere safe, like a password manager. It is your sign-in.

`setup` creates the `Hosts`, `Events`, `Guests` and `Log` tabs, makes you the owner, and schedules a job every morning around 9 am for automatic reminders and day-before emails. It is safe to run again and never deletes data.

## 4. Deploy the web app

1. **Deploy → New deployment** → click the gear next to *Select type* → **Web app**.
2. *Execute as*: **Me**. *Who has access*: **Anyone**. Then click **Deploy**.
3. Copy the **Web app URL** (it ends in `/exec`).
4. Paste it into [`js/config.js`](js/config.js) as `API_URL`, and commit. Or send it to Claude to do.

*Anyone* means guests can reply without a Google account. They can only do what the app allows: read their own invitation and send a reply. Everything else needs a host link.

## 5. Use it

Open your host link on each device you use (phone, laptop) once; it remembers you. Then:

- **New event** → pick a card design and colors, fill in the details, and save.
- **Guests** tab → add people (or paste a list). Each guest gets a personal link.
- **Send** tab → email invitations from your Gmail, or text guests who have only a mobile number from your phone.
- **Hosts** (owner only) → add family members. Each gets their own host link. Tick them under *Hosts* on an event to share it.

## Later

- **Updating the backend** after a code change: paste the new `Code.gs` / `Core` content, then **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The URL stays the same.
- **Lost your host link?** Run `showOwnerLink` from the Apps Script editor and read the log.
- **Leaked your host link?** Run `resetOwnerKey`; the old link stops working and the log shows the new one. For family hosts, use *Reset link* on the Hosts page.
- **Gmail limit**: a personal Gmail account can send about 100 emails a day from scripts. If you hit it, the Send tab says so; the rest can go the next day.
- **Website address**: emails and links point to `https://nidhihgupta.github.io/invitations`. If that ever changes, set the script property `SITE_URL` (Project Settings → Script properties).
