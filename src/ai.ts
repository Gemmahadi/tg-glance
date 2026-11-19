// On-device AI for TG Glance: intent classification, reply drafting and
// extractive channel digests. Runs locally, no API key, no network — the
// drafts are template-based (not an LLM), which is disclosed in the README.

import type { ChannelPost, Chat, ChatMessage } from './data'

export type Intent = 'question' | 'request' | 'invite' | 'thanks' | 'delivery' | 'general'

export interface Draft {
  tone: 'short' | 'warm' | 'detail'
  label: string
  text: string
}

const QUESTION_RE = /\?|bisa|boleh|kapan|berapa|apakah|gimana|bagaimana|dimana|di mana/i
const REQUEST_RE = /tolong|minta|kirim|bantu|butuh|perlu/i
const INVITE_RE = /kumpul|ketemu|datang|mampir|main|nanti|besok|minggu|jam \d/i
const THANKS_RE = /makasih|terima kasih|thanks|thank/i
const DELIVERY_RE = /paket|sampai|lobi|antar|kurir|diterima/i

export function classifyIntent(text: string): Intent {
  if (THANKS_RE.test(text)) return 'thanks'
  if (DELIVERY_RE.test(text)) return 'delivery'
  if (QUESTION_RE.test(text)) return 'question'
  if (INVITE_RE.test(text)) return 'invite'
  if (REQUEST_RE.test(text)) return 'request'
  return 'general'
}

/** First content noun-ish token, used to personalise drafts. */
function keyTopic(text: string): string | null {
  const stop = new Set([
    'bisa', 'tolong', 'yang', 'dan', 'sudah', 'belum', 'nanti', 'besok', 'hari', 'ini', 'itu',
    'saya', 'kamu', 'kita', 'lagi', 'juga', 'akan', 'mau', 'saja', 'atau', 'kalau', 'sudah',
    'kirim', 'antar', 'cek', 'kasih', 'minta', 'bantu', 'ambil', 'siapkan', 'kirimkan', 'balas',
  ])
  const words = text
    .replace(/[?.,!]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w.toLowerCase()))
  return words.length > 0 ? words[0].toLowerCase() : null
}

/**
 * Draft three replies (short / warm / detailed) for the latest message in a
 * chat. The drafts are generated from the message intent, never copied
 * verbatim from a remote model.
 */
export function draftReplies(chat: Chat): Draft[] {
  const last: ChatMessage | undefined = chat.messages[chat.messages.length - 1]
  const text = last ? last.text : chat.lastMessage
  const sender = last ? last.sender : chat.name
  const intent = classifyIntent(text)
  const topic = keyTopic(text)

  switch (intent) {
    case 'question':
      return [
        { tone: 'short', label: 'Singkat', text: topic ? `Bisa — ${topic} aman.` : 'Bisa, aman.' },
        { tone: 'warm', label: 'Ramah', text: `Hai ${sender}! Bisa, aku cek dulu ya.` },
        { tone: 'detail', label: 'Detail', text: topic ? `Bisa. ${topic} aku siapkan, kabari lagi segera.` : 'Bisa, aku kabari lagi segera.' },
      ]
    case 'request':
      return [
        { tone: 'short', label: 'Singkat', text: 'Siap, OTW.' },
        { tone: 'warm', label: 'Ramah', text: `Siap ${sender}, aku usahakan hari ini.` },
        { tone: 'detail', label: 'Detail', text: topic ? `Siap — ${topic} aku kirim hari ini, kabari kalau sudah sampai.` : 'Siap, aku kirim hari ini.' },
      ]
    case 'invite':
      return [
        { tone: 'short', label: 'Singkat', text: 'Boleh, gas!' },
        { tone: 'warm', label: 'Ramah', text: `Boleh banget! Aku datang ya.` },
        { tone: 'detail', label: 'Detail', text: 'Boleh — jam berapa? Aku atur jadwal dulu.' },
      ]
    case 'thanks':
      return [
        { tone: 'short', label: 'Singkat', text: 'Sama-sama!' },
        { tone: 'warm', label: 'Ramah', text: `Sama-sama ${sender}! Senang bisa bantu.` },
        { tone: 'detail', label: 'Detail', text: 'Sama-sama! Kabari saja kalau butuh lagi.' },
      ]
    case 'delivery':
      return [
        { tone: 'short', label: 'Singkat', text: 'Oke, terima kasih!' },
        { tone: 'warm', label: 'Ramah', text: `Oke ${sender}, makasih infonya!` },
        { tone: 'detail', label: 'Detail', text: 'Oke, aku ambil sebentar lagi. Makasih!' },
      ]
    default:
      return [
        { tone: 'short', label: 'Singkat', text: 'Oke, noted!' },
        { tone: 'warm', label: 'Ramah', text: `Oke ${sender}, makasih kabarnya!` },
        { tone: 'detail', label: 'Detail', text: 'Oke, aku cek dulu lalu kabari lagi.' },
      ]
  }
}

/**
 * Extractive digest: score sentences by keyword overlap with the post
 * title, keep the top two, cap at ~200 chars. No remote model involved.
 */
export function digestChannel(post: ChannelPost): string[] {
  const titleWords = new Set(
    post.title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2),
  )
  const sentences = post.body.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0)
  const scored = sentences.map((s) => {
    const words = s.toLowerCase().split(/[^a-z0-9]+/)
    const hits = words.filter((w) => titleWords.has(w)).length
    return { s: s.trim(), score: hits * 2 + Math.min(words.length, 20) / 20 }
  })
  scored.sort((a, b) => b.score - a.score)
  const picked = scored.slice(0, 2).map((x) => x.s)
  const out: string[] = []
  let budget = 200
  for (const s of picked) {
    if (budget <= 0) break
    out.push(s.length > budget ? s.slice(0, budget - 1) + '…' : s)
    budget -= s.length
  }
  return out
}
