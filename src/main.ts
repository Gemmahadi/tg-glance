// TG Glance — Telegram on Even Realities G2.
// Track 01 · Messaging & News (+ Best Telegram integration).
//
// Interaction model (glanceable, one action at a time):
//   • Ring scroll / swipe  → move selection in a list
//   • Tap                 → open the selected chat / pick a draft / SEND
//   • Double-tap          → back (on the inbox: exit with system confirm)
// The same state machine drives the glasses UI and a DOM fallback used
// for browser testing and demo recording when no bridge is present.

import {
  waitForEvenAppBridge,
  TextContainerProperty,
  ListContainerProperty,
  ListItemContainerProperty,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import { DEMO_CHATS, DEMO_CHANNELS, type Chat } from './data'
import { draftReplies, digestChannel, type Draft } from './ai'

const W = 576
const H = 288
const BACKEND = 'http://localhost:8787'

type View =
  | { kind: 'inbox' }
  | { kind: 'chat'; chatId: string }
  | { kind: 'confirm'; chatId: string; draft: Draft }
  | { kind: 'sent'; chatId: string; text: string }
  | { kind: 'digest'; idx: number }

interface SendResult {
  ok: boolean
  mode: 'demo' | 'live'
}

let chats: Chat[] = DEMO_CHATS.map((c) => ({ ...c, messages: [...c.messages] }))
let view: View = { kind: 'inbox' }
let sel = 0 // selected list index for the current list view
let bridge: EvenAppBridge | null = null
let started = false
let sentTimer: ReturnType<typeof setTimeout> | undefined

// ---------------------------------------------------------------- data ---

async function loadChats(): Promise<void> {
  try {
    const res = await fetch(`${BACKEND}/api/chats`, { signal: AbortSignal.timeout(900) })
    if (!res.ok) return
    const data = (await res.json()) as { chats?: Chat[] }
    if (Array.isArray(data.chats) && data.chats.length > 0) chats = data.chats
  } catch {
    // No backend (simulator-only run): bundled demo data stays.
  }
}

async function sendReply(chatId: string, text: string): Promise<SendResult> {
  try {
    const res = await fetch(`${BACKEND}/api/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId, text }),
      signal: AbortSignal.timeout(2000),
    })
    if (res.ok) {
      const data = (await res.json()) as SendResult
      return { ok: true, mode: data.mode ?? 'demo' }
    }
  } catch {
    // fall through to local demo send
  }
  return { ok: true, mode: 'demo' }
}

function chatById(id: string): Chat | undefined {
  return chats.find((c) => c.id === id)
}

function markRead(chat: Chat, sentText: string): void {
  chat.unread = 0
  chat.lastMessage = `You: ${sentText}`
}

function totalUnread(): number {
  return chats.reduce((n, c) => n + c.unread, 0)
}

// ------------------------------------------------------------- content ---

function inboxItems(): string[] {
  const items = chats.map((c) => {
    const badge = c.unread > 0 ? `(${c.unread}) ` : ''
    const snippet = c.lastMessage.length > 26 ? c.lastMessage.slice(0, 25) + '…' : c.lastMessage
    const row = `${badge}${c.name} — ${snippet}`
    return row.length > 44 ? row.slice(0, 43) + '…' : row
  })
  items.push('News: Channel digest')
  return items
}

function chatItems(chat: Chat): string[] {
  const rows = draftReplies(chat).map((d) => `${d.label}: ${d.text}`)
  return [...rows.map((r) => (r.length > 44 ? r.slice(0, 43) + '…' : r)), '‹ Back']
}

function headerText(): string {
  const u = totalUnread()
  return u > 0 ? `TG Glance · ${u} unread` : 'TG Glance · all read'
}

function chatHeader(chat: Chat): string {
  const last = chat.messages[chat.messages.length - 1]
  const body = last ? `${last.sender} ${last.time}\n${last.text}` : chat.lastMessage
  return `${chat.name}\n${body}\n— tap a draft to preview —`
}

function confirmText(chat: Chat, draft: Draft): string {
  return `Send to ${chat.name}?\n\n"${draft.text}"\n\nTAP = SEND\nDOUBLE-TAP = BACK`
}

function sentText(chat: Chat, text: string, mode: string): string {
  return `✓ Sent to ${chat.name}\n\n"${text}"\n\n(${mode === 'live' ? 'via Telegram Bot API' : 'demo mode — no message left the device'})`
}

function digestText(idx: number): string {
  const post = DEMO_CHANNELS[idx % DEMO_CHANNELS.length]
  const bullets = digestChannel(post)
  return `News: ${post.channel}\n${post.title} · ${post.time}\n\n• ${bullets.join('\n• ')}\n\nTAP = next channel\nDOUBLE-TAP = BACK`
}

// ------------------------------------------------------- glasses render ---

function textBox(id: number, name: string, y: number, h: number, content: string, capture = 0) {
  return new TextContainerProperty({
    xPosition: 0,
    yPosition: y,
    width: W,
    height: h,
    borderWidth: 0,
    borderColor: 5,
    paddingLength: 4,
    containerID: id,
    containerName: name,
    content,
    // The host allows exactly ONE event-capturing container per page
    // (simulator: "multiple event listeners (2) not allowed"). Display
    // text stays 0; the list (or the single text page) captures.
    isEventCapture: capture,
  })
}

function listBox(id: number, name: string, y: number, h: number, items: string[]) {
  return new ListContainerProperty({
    xPosition: 0,
    yPosition: y,
    width: W,
    height: h,
    borderWidth: 0,
    borderColor: 5,
    paddingLength: 4,
    containerID: id,
    containerName: name,
    itemContainer: new ListItemContainerProperty({
      itemCount: items.length,
      isItemSelectBorderEn: 1,
      itemName: items,
    }),
    isEventCapture: 1,
  })
}

async function renderGlasses(): Promise<void> {
  if (bridge) {
    const page = ((): RebuildPageContainer => {
    switch (view.kind) {
      case 'inbox':
        return new RebuildPageContainer({
          containerTotalNum: 2,
          textObject: [textBox(1, 'header', 0, 44, headerText())],
          listObject: [listBox(2, 'inbox', 44, H - 44, inboxItems())],
        })
      case 'chat': {
        const chat = chatById(view.chatId)
        if (!chat) return new RebuildPageContainer({ containerTotalNum: 1, textObject: [textBox(1, 'main', 0, H, 'Chat not found', 1)] })
        return new RebuildPageContainer({
          containerTotalNum: 2,
          textObject: [textBox(1, 'msg', 0, 118, chatHeader(chat))],
          listObject: [listBox(2, 'drafts', 118, H - 118, chatItems(chat))],
        })
      }
      case 'confirm': {
        const chat = chatById(view.chatId)
        const content = chat ? confirmText(chat, view.draft) : 'Chat not found'
        return new RebuildPageContainer({ containerTotalNum: 1, textObject: [textBox(1, 'main', 0, H, content, 1)] })
      }
      case 'sent': {
        const chat = chatById(view.chatId)
        const content = chat ? sentText(chat, view.text, 'demo') : 'Sent.'
        return new RebuildPageContainer({ containerTotalNum: 1, textObject: [textBox(1, 'main', 0, H, content, 1)] })
      }
      case 'digest':
        return new RebuildPageContainer({ containerTotalNum: 1, textObject: [textBox(1, 'main', 0, H, digestText(view.idx), 1)] })
    }
  })()
    await bridge.rebuildPageContainer(page)
  }
  renderDom() // keep the browser mirror in sync for recording/debugging
}

async function upgradeText(content: string): Promise<void> {
  if (!bridge) return
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({ containerID: 1, containerName: 'main', content }),
  )
}

// ---------------------------------------------------------- DOM fallback ---

function renderDom(): void {
  const app = document.getElementById('app')
  if (!app) return
  let body = ''
  switch (view.kind) {
    case 'inbox':
      body = `<div class="t">${headerText()}</div>` + inboxItems().map((it, i) =>
        `<div class="row${i === sel ? ' sel' : ''}">${i === sel ? '▶ ' : '  '}${escapeHtml(it)}</div>`).join('')
      break
    case 'chat': {
      const chat = chatById(view.chatId)
      body = chat
        ? `<div class="t">${escapeHtml(chatHeader(chat)).replace(/\n/g, '<br>')}</div>` +
          chatItems(chat).map((it, i) =>
            `<div class="row${i === sel ? ' sel' : ''}">${i === sel ? '▶ ' : '  '}${escapeHtml(it)}</div>`).join('')
        : 'Chat not found'
      break
    }
    case 'confirm': {
      const chat = chatById(view.chatId)
      body = chat ? `<div class="t">${escapeHtml(confirmText(chat, view.draft)).replace(/\n/g, '<br>')}</div>` : 'Chat not found'
      break
    }
    case 'sent': {
      const chat = chatById(view.chatId)
      body = chat ? `<div class="t">${escapeHtml(sentText(chat, view.text, 'demo')).replace(/\n/g, '<br>')}</div>` : 'Sent.'
      break
    }
    case 'digest':
      body = `<div class="t">${escapeHtml(digestText(view.idx)).replace(/\n/g, '<br>')}</div>`
      break
  }
  const hint = bridge
    ? 'SIMULATOR MIRROR — glasses UI above is live'
    : 'BROWSER PREVIEW — no glasses bridge; click TAP / use ▲ ▼ / BACK'
  app.innerHTML =
    `<div class="glasses"><div class="screen">${body}</div></div>` +
    `<div class="controls"><button data-act="up">▲</button><button data-act="tap">TAP</button><button data-act="down">▼</button><button data-act="back">BACK</button></div>` +
    `<div class="hint">${hint}</div>`
  app.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      const act = (b as HTMLElement).dataset.act
      if (act === 'up') onScroll('up')
      if (act === 'down') onScroll('down')
      if (act === 'tap') void onTap()
      if (act === 'back') void onDoubleTap()
    }),
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// -------------------------------------------------------------- inputs ---

function listLength(): number {
  if (view.kind === 'inbox') return inboxItems().length
  if (view.kind === 'chat') {
    const chat = chatById(view.chatId)
    return chat ? chatItems(chat).length : 0
  }
  return 0
}

function clampSel(): void {
  const n = listLength()
  if (n === 0) sel = 0
  else sel = Math.max(0, Math.min(sel, n - 1))
}

function onScroll(dir: 'up' | 'down'): void {
  if (view.kind !== 'inbox' && view.kind !== 'chat') return
  sel += dir === 'down' ? 1 : -1
  clampSel()
  renderDom()
}

async function onTap(): Promise<void> {
  switch (view.kind) {
    case 'inbox': {
      if (sel >= chats.length) {
        view = { kind: 'digest', idx: 0 }
      } else {
        view = { kind: 'chat', chatId: chats[sel].id }
      }
      sel = 0
      await renderGlasses()
      return
    }
    case 'chat': {
      const chat = chatById(view.chatId)
      if (!chat) return
      const drafts = draftReplies(chat)
      if (sel >= drafts.length) {
        view = { kind: 'inbox' }
        sel = 0
      } else {
        view = { kind: 'confirm', chatId: chat.id, draft: drafts[sel] }
      }
      await renderGlasses()
      return
    }
    case 'confirm': {
      const chat = chatById(view.chatId)
      if (!chat) return
      const result = await sendReply(chat.id, view.draft.text)
      markRead(chat, view.draft.text)
      view = { kind: 'sent', chatId: chat.id, text: view.draft.text }
      await renderGlasses()
      if (bridge) {
        await upgradeText(sentText(chat, view.text, result.mode))
      }
      clearTimeout(sentTimer)
      sentTimer = setTimeout(async () => {
        if (view.kind === 'sent') {
          view = { kind: 'inbox' }
          sel = 0
          await renderGlasses()
        }
      }, 1800)
      return
    }
    case 'digest':
      view = { kind: 'digest', idx: view.idx + 1 }
      await renderGlasses()
      return
    case 'sent':
      view = { kind: 'inbox' }
      sel = 0
      await renderGlasses()
      return
  }
}

async function onDoubleTap(): Promise<void> {
  switch (view.kind) {
    case 'inbox':
      if (bridge) await bridge.shutDownPageContainer(1) // system exit confirm
      return
    case 'chat':
    case 'digest':
      view = { kind: 'inbox' }
      sel = 0
      await renderGlasses()
      return
    case 'confirm':
      view = { kind: 'chat', chatId: view.chatId }
      sel = 0
      await renderGlasses()
      return
    case 'sent':
      view = { kind: 'inbox' }
      sel = 0
      await renderGlasses()
      return
  }
}

function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

// ---------------------------------------------------------------- boot ---

async function boot(): Promise<void> {
  if (started) return
  started = true
  await loadChats()

  // Race the bridge: in the simulator it resolves immediately; in a plain
  // browser it never resolves, so fall back to the DOM preview.
  const bridgeOrNull = await Promise.race([
    waitForEvenAppBridge().then((b) => b as EvenAppBridge | null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
  ])

  if (bridgeOrNull) {
    bridge = bridgeOrNull
    const result = await bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 2,
        textObject: [textBox(1, 'header', 0, 44, headerText())],
        listObject: [listBox(2, 'inbox', 44, H - 44, inboxItems())],
      }),
    )
    console.log('TG Glance page created:', result === 0 ? 'success' : `failed (${result})`)
    if (result !== 0) {
      // The SDK bridge also "initialises" in a plain browser, but the host
      // (simulator / phone app) is absent — create returns non-zero and
      // postMessage warns "Flutter handler not available". Treat that as
      // browser-only mode so the DOM preview (and demo video) is honest.
      bridge = null
    }
  }

  if (bridge) {
    bridge.onEvenHubEvent((event) => {
      const listType = eventTypeOf(event.listEvent)
      const textType = eventTypeOf(event.textEvent)
      const sysType = eventTypeOf(event.sysEvent)
      const type = listType ?? textType ?? sysType
      if (type === null) return

      // Selection follows the host-reported index on list events.
      if (event.listEvent?.currentSelectItemIndex !== undefined) {
        sel = event.listEvent.currentSelectItemIndex
        clampSel()
        renderDom()
      }

      // Double-tap always means back/exit, on every envelope.
      if (
        listType === OsEventTypeList.DOUBLE_CLICK_EVENT ||
        textType === OsEventTypeList.DOUBLE_CLICK_EVENT ||
        sysType === OsEventTypeList.DOUBLE_CLICK_EVENT
      ) {
        void onDoubleTap()
        return
      }
      if (
        listType === OsEventTypeList.SCROLL_TOP_EVENT ||
        textType === OsEventTypeList.SCROLL_TOP_EVENT ||
        sysType === OsEventTypeList.SCROLL_TOP_EVENT
      ) {
        onScroll('up')
        return
      }
      if (
        listType === OsEventTypeList.SCROLL_BOTTOM_EVENT ||
        textType === OsEventTypeList.SCROLL_BOTTOM_EVENT ||
        sysType === OsEventTypeList.SCROLL_BOTTOM_EVENT
      ) {
        onScroll('down')
        return
      }
      if (type === OsEventTypeList.CLICK_EVENT) {
        void onTap()
        return
      }
      if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
        clearTimeout(sentTimer)
      }
    })
  }

  renderDom()
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') onScroll('down')
    if (e.key === 'ArrowUp') onScroll('up')
    if (e.key === 'Enter') void onTap()
    if (e.key === 'Backspace' || e.key === 'Escape') void onDoubleTap()
  })
}

void boot()
