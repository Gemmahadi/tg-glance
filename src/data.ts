// Demo dataset for TG Glance.
//
// These messages are bundled demo content so the app works end-to-end in
// the Even Hub simulator with no accounts, tokens or network. When the
// companion backend (server/) runs with TELEGRAM_BOT_TOKEN set, live
// Telegram Bot API data replaces this dataset — see server/index.mjs.

export interface ChatMessage {
  id: string
  chatId: string
  sender: string
  text: string
  time: string
}

export interface Chat {
  id: string
  name: string
  kind: 'dm' | 'group' | 'channel'
  unread: number
  lastMessage: string
  lastTime: string
  messages: ChatMessage[]
}

export interface ChannelPost {
  channel: string
  title: string
  body: string
  time: string
}

export const DEMO_CHATS: Chat[] = [
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

export const DEMO_CHANNELS: ChannelPost[] = [
  {
    channel: 'Indie Game Dev ID',
    title: 'Play Store closed test',
    body: 'Closed test butuh 12 tester opt-in selama 14 hari berturut-turut. Upload baru tidak me-reset hitungan hari, tapi tester yang opt-out akan me-reset. Rekrut lewat komunitas test-for-test, dan siapkan 2-3 tester cadangan.',
    time: '08:15',
  },
  {
    channel: 'Crypto Pagi',
    title: 'BTC & ETH pagi ini',
    body: 'Bitcoin stabil di atas support, Ethereum ikut menguat tipis. Volume perdagangan naik 12% dibanding kemarin. Analis mengingatkan volatilitas masih tinggi menjelang rilis data inflasi AS minggu ini.',
    time: '07:50',
  },
]
