# Abu Nidal Trading — WhatsApp AI Sales Assistant

An AI assistant that answers customer WhatsApp messages 24/7 about your
trading materials, and records order/quote inquiries into a dashboard — so
nobody has to sit on the phone taking orders.

- Replies in the customer's own language (Arabic, English, or others)
- Knows your products, prices, opening hours, and location
- Records order inquiries (product + quantity) automatically
- Simple password-protected dashboard to see all customers, conversations
  and order inquiries in one place
- No deposit/payment collection in this version (can be added later)

Current product list (edit in `business.config.json`): Fibreglass Mesh,
Corner Bead, Stretch Film, Clear Tape, Brown Tape, Masking Tape.

---

## 1. Important: how the salesman's WhatsApp number will work

You mentioned your salesman already has a SIM with the regular **WhatsApp
Business app** installed. Read this before doing anything else, because it
affects that phone directly:

This bot uses the official **WhatsApp Cloud API** (Meta's business
platform). To connect a phone number to the Cloud API, that number must be
registered on Meta's WhatsApp Business Platform. **Once a number is
registered there, it can no longer be used inside the regular WhatsApp
Business app on the phone at the same time** — the app and the Cloud API
are mutually exclusive for a given number.

You have two practical options:

1. **Get a new SIM/number dedicated to the bot.** The salesman keeps using
   his current WhatsApp Business app and number as normal; customers who
   want the AI assistant message the new automated number. This is the
   simplest option and avoids disrupting his current workflow. Existing
   chats/contacts do **not** transfer between numbers.
2. **Migrate the salesman's existing number to the Cloud API.** All new
   messages then go through this bot (which can still notify the team, and
   a human can take over a conversation by messaging the customer from the
   dashboard's phone number, or you can extend the bot to hand off to a
   human). His phone's WhatsApp Business **app can no longer send/receive**
   on that number afterward — everything happens through this bot/API.

Most businesses start with option 1 (a second number) to avoid disruption,
then migrate the main number once they trust the bot. Decide which you
want before setting up Meta's side below.

---

## 2. One-time setup with Meta (WhatsApp Cloud API)

1. Create a Meta developer account at https://developers.facebook.com and
   create a new **Business** app.
2. Add the **WhatsApp** product to the app.
3. Under WhatsApp → API Setup, note down:
   - **Temporary access token** (for testing) — for production, generate a
     **permanent token** via a System User in Meta Business Suite.
   - **Phone number ID** for the number you're using (test number provided
     by Meta initially, or your own number once added).
4. Add/verify the actual phone number you'll use (per the decision in
   section 1) under WhatsApp → API Setup → "Add phone number", following
   Meta's SMS/call verification.
5. Complete **Meta Business verification** for the app — required before
   you can message customers who haven't messaged you first, and to lift
   the initial daily messaging limits.

Keep the token and phone number ID — you'll need them for `.env`.

---

## 3. Configure the project

```bash
npm install
cp .env.example .env
```

Edit `.env` and fill in:

- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` — from step 2.
- `WHATSAPP_VERIFY_TOKEN` — make up any random string; you'll enter the
  same value in Meta's webhook settings in step 5.
- `ANTHROPIC_API_KEY` — from https://console.anthropic.com.
- `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` — login for the dashboard.

Then edit **`business.config.json`** in the project root with your real
products, prices, opening hours, address, and contact info — this is what
the AI is "trained" on. No coding needed; it's just the source of truth the
AI reads before every reply. Update it any time your prices/hours change,
no redeploy of code required (just restart the server, or edit the file
directly on the server if deployed).

---

## 4. Run it

Development (auto-reload):

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

The server starts on `PORT` (default 3000) and exposes:

- `POST /webhook` and `GET /webhook` — WhatsApp Cloud API webhook
- `/dashboard` — the orders dashboard (HTTP Basic Auth login)
- `/healthz` — health check

---

## 5. Deploy it somewhere reachable from the internet

Meta needs to reach your `/webhook` endpoint over HTTPS. Any small always-on
host works, e.g. Railway, Render, Fly.io, or a small VPS. Set the same
environment variables there as in your local `.env`, and mount a persistent
disk/volume for the SQLite database file (`DATABASE_FILE`, default
`./data/orders.sqlite`) so orders survive restarts/deploys.

Once deployed, go back to Meta → WhatsApp → Configuration → Webhook, and
set:

- **Callback URL**: `https://your-domain.com/webhook`
- **Verify token**: the same value as `WHATSAPP_VERIFY_TOKEN` in your `.env`

Then subscribe the webhook to the `messages` field.

---

## 6. Try it

Message the connected WhatsApp number from your own phone. The AI should
greet you, answer questions about products/prices/hours, and record an
order inquiry once you agree on a product and quantity — check the
dashboard at `/dashboard` to see it appear.

---

## Project structure

```
business.config.json   Business data the AI is grounded on (products, hours, prices...)
src/config.ts           Env vars + business config loader
src/db.ts                SQLite schema and queries (customers, messages, orders)
src/whatsapp.ts          WhatsApp Cloud API send/receive helpers
src/ai.ts                Claude integration: system prompt + order-inquiry tool
src/webhook.ts            WhatsApp webhook (verify + inbound message handling)
src/dashboardApi.ts   REST API backing the dashboard
src/basicAuth.ts         Dashboard login
src/server.ts              Express app wiring it all together
public/                     Dashboard frontend (plain HTML/CSS/JS)
```

## Not included yet (roadmap)

- Deposit/payment collection (explicitly out of scope for this version)
- Human hand-off / "pause the bot for this customer" toggle
- Multi-agent/multi-number support
- Automated reminders before appointments
