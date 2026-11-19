// TG Glance companion backend — zero-dependency Node http server.
//
// Demo mode (default): serves the bundled demo chats and records "sent"
// replies locally. Nothing leaves the machine.
//
// Live mode: set TELEGRAM_BOT_TOKEN (a bot token from @BotFather) and the
// server talks to the Telegram Bot API instead:
//   GET  /api/chats  -> recent chats from getUpdates
//   POST /api/send   -> sendMessage to that chat
// The token is read ONLY from the environment — never commit it.
//
// Run:  node server/index.mjs            (port 8787)
// Live: TELEGRAM_BOT_TOKEN=123:ABC node server/index.mjs

import http from 'node:http'

const PORT = Number(process.env.PORT ?? 8787)
const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const TG_API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null

const DEMO_CHATS = [
  {
    id: 'c1',
    name: 'Maya (Warung)',
    kind: 'dm',
    unread: 2,
    lastMessage: 'Bisa kirim 20 porsi besok pagi?',
    lastTime: '09:41',
    messages: [
      { id: 'm1', chatId: 'c1', sender: 'Maya', text: 'Hai! Stok ayam habis lagi.', time: '09:38' },
      { id: 'm2', chatId: 'c1', sender: 'Maya', text: 'Bisa kirim 20 porsi besok pagi?', time: '09:41' },
    ],
  },
  {
    id: 'c2',
    name: 'Gemma Works',
    kind: 'group',
    unread: 5,
    lastMessage: 'Rimba v2.1.1 sudah di Play, cek ya',
    lastTime: '09:12',
    messages: [
      { id: 'm3', chatId: 'c2', sender: 'Adi', text: 'Build Rimba v2.1.1 selesai.', time: '08:57' },
      { id: 'm4', chatId: 'c2', sender: 'Rani', text: 'Rimba v2.1.1 sudah di Play, cek ya', time: '09:12' },
    ],
  },
  {
    id: 'c3',
    name: 'Dedi Kurir',
    kind: 'dm',
    unread: 1,
    lastMessage: 'Paketnya sudah sampai di lobi',
    lastTime: '08:30',
    messages: [
      { id: 'm5', chatId: 'c3', sender: 'Dedi', text: 'Paketnya sudah sampai di lobi', time: '08:30' },
    ],
  },
  {
    id: 'c4',
    name: 'Keluarga',
    kind: 'group',
    unread: 0,
    lastMessage: 'Minggu depan kumpul di rumah Ibu',
    lastTime: 'Kemarin',
    messages: [
      { id: 'm6', chatId: 'c4', sender: 'Ibu', text: 'Minggu depan kumpul di rumah Ibu', time: 'Kemarin' },
    ],
  },
]

const sentLog = []

function json(res, status, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

async function liveChats() {
  const res = await fetch(`${TG_API}/getUpdates?limit=50&timeout=0`)
  const data = await res.json()
  if (!data.ok) throw new Error('Telegram getUpdates failed')
  const byChat = new Map()
  for (const u of data.result ?? []) {
    const m = u.message
    if (!m?.chat) continue
    const id = String(m.chat.id)
    const entry = byChat.get(id) ?? {
      id,
      name: m.chat.title ?? [m.chat.first_name, m.chat.last_name].filter(Boolean).join(' ') ?? 'Telegram',
      kind: m.chat.type === 'private' ? 'dm' : m.chat.type === 'channel' ? 'channel' : 'group',
      unread: 0,
      lastMessage: '',
      lastTime: '',
      messages: [],
    }
    entry.unread += 1
    entry.lastMessage = m.text ?? m.caption ?? '(media)'
    entry.lastTime = new Date((m.date ?? 0) * 1000).toTimeString().slice(0, 5)
    entry.messages.push({
      id: String(m.message_id),
      chatId: id,
      sender: m.from?.first_name ?? 'Telegram',
      text: m.text ?? m.caption ?? '(media)',
      time: entry.lastTime,
    })
    byChat.set(id, entry)
  }
  return [...byChat.values()].slice(0, 10)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    })
    res.end()
    return
  }

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      json(res, 200, { ok: true, mode: TG_API ? 'live' : 'demo' })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/chats') {
      const chats = TG_API ? await liveChats() : DEMO_CHATS
      json(res, 200, { chats, mode: TG_API ? 'live' : 'demo' })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/send') {
      let raw = ''
      for await (const chunk of req) raw += chunk
      const { chatId, text } = JSON.parse(raw || '{}')
      if (typeof chatId !== 'string' || typeof text !== 'string' || text.length === 0 || text.length > 500) {
        json(res, 400, { ok: false, error: 'chatId and text (1-500 chars) required' })
        return
      }
      if (TG_API) {
        const tg = await fetch(`${TG_API}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
        })
        const data = await tg.json()
        if (!data.ok) {
          json(res, 502, { ok: false, error: data.description ?? 'Telegram send failed' })
          return
        }
        json(res, 200, { ok: true, mode: 'live' })
        return
      }
      sentLog.push({ chatId, text, at: new Date().toISOString() })
      console.log(`[demo send] to ${chatId}: ${text}`)
      json(res, 200, { ok: true, mode: 'demo' })
      return
    }

    json(res, 404, { ok: false, error: 'not found' })
  } catch (err) {
    console.error(err)
    json(res, 500, { ok: false, error: String(err?.message ?? err) })
  }
})

server.listen(PORT, () => {
  console.log(`TG Glance backend on http://localhost:${PORT} (mode: ${TG_API ? 'live' : 'demo'})`)
})
