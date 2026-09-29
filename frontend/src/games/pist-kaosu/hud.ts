import { ITEM_ICONS } from './items'
import type { CarState, ItemEvent, ItemKind, RaceInit, RaceSnapshot } from './types'

const MINIMAP_WIDTH = 220
const FEED_SECONDS = 4
const FEED_MAX = 4
const ROULETTE: ItemKind[] = ['TURBO', 'BANANA', 'ICE', 'SHIELD']

/** Oyun alanının üstündeki HTML göstergeler: tur, sıra, süre, sıralama, mesaj ve mini harita. */
export class Hud {
  private readonly root = document.createElement('div')
  private readonly lap = el('div', 'pk-lap')
  private readonly time = el('div', 'pk-time')
  private readonly standings = el('ol', 'pk-standings')
  private readonly center = el('div', 'pk-center')
  private readonly hint = el('div', 'pk-hint')
  private readonly drift = el('div', 'pk-drift')
  private readonly itemSlot = el('div', 'pk-item')
  private readonly itemIcon = el('span', 'pk-item-icon')
  private readonly feed = el('div', 'pk-feed')
  private readonly cameraFlash = el('div', 'pk-camera-flash')
  private readonly minimap = document.createElement('canvas')
  private readonly race: RaceInit
  private readonly names: Map<string, { name: string; color: string }>
  private readonly myId: string

  constructor(parent: HTMLElement, race: RaceInit, myId: string) {
    this.race = race
    this.myId = myId
    this.names = new Map(race.players.map((p) => [p.id, p]))

    this.root.className = 'pk-hud'
    this.minimap.className = 'pk-minimap'
    this.minimap.width = MINIMAP_WIDTH * 2
    this.minimap.height = Math.round((MINIMAP_WIDTH * race.height) / race.width) * 2
    this.hint.textContent = 'Boşluk + yön: drift · E: eşya · C: kamera'
    const key = el('span', 'pk-item-key')
    key.textContent = 'E'
    this.itemSlot.append(this.itemIcon, key)
    this.root.append(
      this.lap, this.time, this.standings, this.itemSlot, this.feed, this.center, this.drift, this.minimap, this.hint,
      this.cameraFlash,
    )
    parent.appendChild(this.root)
  }

  update(snap: RaceSnapshot) {
    const me = snap.cars.find((c) => c.id === this.myId)
    this.lap.textContent = me ? `Tur ${me.lap}/${this.race.laps} · Sıra ${me.place}/${snap.cars.length}` : ''
    this.time.textContent = formatTime(snap.time)
    this.updateStandings(snap.cars)
    this.center.textContent = centerMessage(snap, me)
    this.center.classList.toggle('big', snap.phase === 'COUNTDOWN' || (snap.time < 1 && !me?.boost))
    this.updateDrift(me)
    this.updateItem(me)
    this.drawMinimap(snap.cars)
  }

  /** Kamera değişince köşedeki ipucunu günceller ve adını kısa süre ortada gösterir. */
  setCameraLabel(label: string) {
    this.hint.textContent = `Boşluk + yön: drift · E: eşya · C: kamera (${label})`
    this.cameraFlash.textContent = `🎥 ${label}`
    this.cameraFlash.classList.remove('show')
    // Animasyonu yeniden başlatmak için bir kare bekle.
    requestAnimationFrame(() => this.cameraFlash.classList.add('show'))
  }

  dispose() {
    this.root.remove()
  }

  /** Eşya kutusu: çark dönerken simgeler hızla değişir. */
  private updateItem(me: CarState | undefined) {
    let icon = ''
    if (me?.rolling) {
      icon = ITEM_ICONS[ROULETTE[Math.floor(performance.now() / 80) % ROULETTE.length]]
    } else if (me?.item) {
      icon = ITEM_ICONS[me.item]
    }
    if (this.itemIcon.textContent !== icon) this.itemIcon.textContent = icon
    this.itemSlot.classList.toggle('rolling', !!me?.rolling)
    this.itemSlot.classList.toggle('ready', !!me?.item && !me.rolling)
  }

  /** Eşya olaylarından kısa mesajlar: kim kimi dondurdu, kim kaydı. */
  onEvents(events: ItemEvent[]) {
    for (const e of events) {
      const text = this.describe(e)
      if (!text) continue
      const line = el('div', 'pk-feed-line')
      line.textContent = text
      if (e.playerId === this.myId || e.other === this.myId) line.classList.add('me')
      this.feed.prepend(line)
      setTimeout(() => line.remove(), FEED_SECONDS * 1000)
      while (this.feed.children.length > FEED_MAX) this.feed.lastChild?.remove()
    }
  }

  private describe(e: ItemEvent) {
    const name = (id: string | null) => (id ? (this.names.get(id)?.name ?? '?') : '?')
    if (e.type === 'use' && e.item === 'ICE' && e.other) return `🧊 ${name(e.playerId)} → ${name(e.other)}`
    if (e.type === 'hit' && e.item === 'BANANA') return `🍌 ${name(e.playerId)} kaydı!`
    if (e.type === 'block') return `🛡️ ${name(e.playerId)} saldırıyı engelledi`
    if (e.type === 'use' && e.item === 'SHIELD') return `🛡️ ${name(e.playerId)} kalkan açtı`
    return null
  }

  /** Drift şarj göstergesi: şarjsız → mavi → turuncu. */
  private updateDrift(me: CarState | undefined) {
    const level = me && !me.finished ? me.drift : 0
    this.drift.hidden = level === 0
    this.drift.dataset.level = String(level)
    this.drift.textContent = DRIFT_LABELS[level] ?? ''
  }

  private updateStandings(cars: CarState[]) {
    const ordered = [...cars].sort((a, b) => a.place - b.place)
    const html = ordered
      .map((c) => {
        const p = this.names.get(c.id)
        const me = c.id === this.myId ? ' class="me"' : ''
        return `<li${me}><span class="dot" style="background:${p?.color}"></span>${escapeHtml(
          p?.name ?? '?',
        )}${c.finished ? ' 🏁' : ''}</li>`
      })
      .join('')
    if (this.standings.innerHTML !== html) this.standings.innerHTML = html
  }

  private drawMinimap(cars: CarState[]) {
    const ctx = this.minimap.getContext('2d')!
    const scale = this.minimap.width / this.race.width
    ctx.clearRect(0, 0, this.minimap.width, this.minimap.height)
    ctx.save()
    ctx.scale(scale, scale)

    ctx.lineJoin = 'round'
    ctx.beginPath()
    this.race.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
    ctx.closePath()
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = this.race.trackWidth * 0.55
    ctx.stroke()
    ctx.strokeStyle = 'rgba(40,44,56,0.95)'
    ctx.lineWidth = this.race.trackWidth * 0.4
    ctx.stroke()

    // Kendi arabanı en üstte çiz.
    const ordered = [...cars.filter((c) => c.id !== this.myId), ...cars.filter((c) => c.id === this.myId)]
    for (const c of ordered) {
      const mine = c.id === this.myId
      ctx.beginPath()
      ctx.arc(c.x, c.y, mine ? 42 : 32, 0, Math.PI * 2)
      ctx.fillStyle = this.names.get(c.id)?.color ?? '#fff'
      ctx.fill()
      ctx.lineWidth = mine ? 14 : 8
      ctx.strokeStyle = mine ? '#ffffff' : '#000000'
      ctx.stroke()
    }
    ctx.restore()
  }
}

function centerMessage(snap: RaceSnapshot, me: CarState | undefined) {
  if (snap.phase === 'COUNTDOWN') return String(Math.ceil(snap.countdown))
  if (snap.time < 1.5 && me?.boost) return '🚀 ROKET START!'
  if (snap.time < 1) return 'BAŞLA!'
  if (me?.finished) {
    return snap.finishTimer >= 0 ? `${me.place}. oldun! · ${Math.ceil(snap.finishTimer)} sn` : `${me.place}. oldun!`
  }
  if (snap.finishTimer >= 0) return `Son ${Math.ceil(snap.finishTimer)} sn!`
  if (me?.frozen) return '🧊 Dondun!'
  if (me?.spin) return '🍌 Kaydın!'
  if (me?.boost) return '🔥 TURBO!'
  if (me && !me.onTrack) return 'Piste dön!'
  return ''
}

const DRIFT_LABELS = ['', 'DRIFT', 'DRIFT · MİNİ TURBO ⚡', 'DRIFT · SÜPER TURBO ⚡⚡']

function el(tag: string, className: string) {
  const e = document.createElement(tag)
  e.className = className
  return e
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = (seconds - m * 60).toFixed(1).padStart(4, '0')
  return `${m}:${s}`
}
