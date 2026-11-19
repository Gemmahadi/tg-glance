# TG Glance — Telegram on Even Realities G2

**Heads Up: Even Realities Hackathon (DoraHacks) · Track 01 Messaging & News · also entered for the $1,000 Best Telegram Integration special prize**

## The problem

Telegram is where a small business owner in Indonesia actually lives — supplier
orders, courier updates, family groups, community channels. Every reply means
taking the phone out, unlocking it, finding the chat, typing. On the move, that
is the whole interruption.

## What it does

TG Glance puts Telegram on the G2's 576×288 monochrome display. One thing on
screen, one action per tap:

1. **Inbox at a glance** — chats with unread counts and a one-line preview.
   Scroll with the R1 ring (or the simulator's Up/Down), tap to open.
2. **AI-drafted replies** — opening a chat shows the latest message plus three
   draft replies (short / warm / detailed), generated on-device from the
   message intent (question, request, invite, thanks, delivery). Tap a draft
   to preview it.
3. **Approve to send** — the confirm screen shows the exact text. Tap = send,
   double-tap = back. The sent message appears in the inbox as `You: …` and
   the unread badge clears.
4. **Channel digest** — long channel posts are condensed to two bullets by an
   extractive summariser, so a channel catch-up fits on one glasses screen.

No camera, no speaker, no phone-unlock needed while it runs. Double-tap on
the inbox exits with the system confirmation dialog, as Even Hub QA requires.

## How it works

- **Glasses app** (`src/`): Vite + TypeScript + `@evenrealities/even_hub_sdk`
  0.0.10. One state machine drives two renderers: the real G2 containers
  (`TextContainer` + `ListContainer`, `rebuildPageContainer` on navigation,
  `textContainerUpgrade` for in-place updates) and a DOM mirror in
  `index.html` used for browser testing and demo recording when no bridge is
  present. The app detects a real host by the `createStartUpPageContainer`
  result — the SDK bridge also "initialises" in a plain browser, but creation
  fails there, so the DOM preview is honest about which mode it is in.
- **AI** (`src/ai.ts`): intent classification + template-based draft
  generation + extractive digest. Runs fully on-device; **no LLM API, no API
  key, no network call for the drafts**. (Voice input is a documented hook:
  the SDK exposes raw mic audio; a Whisper-backed `/api/transcribe` can be
  added on the server without touching the glasses UI.)
- **Companion backend** (`server/index.mjs`): zero-dependency Node server
  (port 8787). Demo mode serves bundled demo chats and records sends locally
  — nothing leaves the machine. Live mode (set `TELEGRAM_BOT_TOKEN` from
  @BotFather) serves real chats via `getUpdates` and sends via `sendMessage`.
  The token is read only from the environment and is never committed.

## Run it

```bash
npm install
npm run server   # terminal 1 — backend on http://localhost:8787 (demo mode)
npm run dev      # terminal 2 — Vite on http://localhost:5173
```

**Even Hub simulator** (no glasses needed):

```bash
npm run simulate   # evenhub-simulator http://localhost:5173
```

Use the simulator's Up / Down / Click / Double Click buttons. The demo video
in this repo (`tg-glance-demo.mp4`, 27 s) was recorded this way — the
whole read → draft → approve → send loop, plus the channel digest, on the
real simulator. Screenshots: `docs/simulator-inbox.png`,
`docs/simulator-sent.png`.

**Package** (`.ehpk`, optional for submission):

```bash
npm run pack     # -> tg-glance.ehpk (SDK 0.0.10)
```

Note: `evenhub pack -c` (package-ID availability check) requires an Even Hub
login; plain `pack` works without one.

**Browser preview** (no simulator): just open http://localhost:5173 — the
same state machine renders a 576×288 green canvas with TAP / ▲ / ▼ / BACK
controls (keyboard: Enter / arrows / Backspace). This is how the flow was
verified with Playwright (`../verify-browser.py`, 0 page errors).

## Linux simulator notes

The Linux simulator binary needs WebKitGTK 4.1 (`libwebkit2gtk-4.1.so.0`,
`libjavascriptcoregtk-4.1.so.0`, `libsoup-3.0.so.0` + GStreamer deps). If
`apt` cannot fetch them, the `.deb`s can be extracted locally and the
simulator run with `LD_LIBRARY_PATH=<dir>/usr/lib/x86_64-linux-gnu`, plus a
symlink for `.../webkit2gtk-4.1/` (the WebKit helper processes). See
`../simlibs/` in this workspace for the exact set used here. Two real
simulator behaviours worth knowing:

- A page may have **exactly one event-capturing container** — two
  `isEventCapture: 1` containers fail validation (`multiple event listeners
  (2) not allowed`). Display text uses `0`; the list (or the single text
  page) uses `1`.
- The simulator windows open at `y=-40`, clipping the top ~40 px of the
  576×288 canvas. Move the `Browser` and `Glasses Display` windows to `y=0`
  to see the whole screen.

## What existed before Nov 23

Per the hackathon rules, this is the honest timeline: the project scaffold
(official `evenhub-templates/minimal`), the TG Glance implementation, the
backend, the simulator verification and the demo video were built
**19–20 Nov 2026**, ahead of build week (23–29 Nov 2026). No code, asset or
account existed for this project before 19 Nov 2026. Final packaging,
submission and any build-week changes are made during build week.

## AI disclosure

AI was used to write code (this repo was AI-assisted), and the app's reply
drafts are generated by a local, on-device template engine — not by a remote
LLM. No AI-generated images, audio or text are presented to the user as
anything else. The demo chats are fictional demo data, labelled "demo mode"
on the sent screen.

## Privacy & safety

- Demo mode sends nothing anywhere; the sent screen says so explicitly.
- Live mode uses the official Telegram Bot API with a bot token the user
  supplies; only chats the bot can already see are shown, and only the
  user-approved draft text is sent.
- No API keys or secrets are shipped in the app or committed to the repo
  (the `.ehpk` contains only the built web app).

## License

MIT. Even Hub SDK/CLI/simulator are property of Even Realities; the
`evenhub-templates/minimal` starter is MIT.
