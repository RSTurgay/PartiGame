import type { CarState, RaceInit, RaceSnapshot } from './types'

const MINIMAP_WIDTH = 220

/** Oyun alanının üstündeki HTML göstergeler: tur, sıra, süre, sıralama, mesaj ve mini harita. */
export class Hud {
  private readonly root = document.createElement('div')
  private readonly lap = el('div', 'pk-lap')
  private readonly time = el('div', 'pk-time')
  private readonly standings = el('ol', 'pk-standings')
  private readonly center = el('div', 'pk-center')
  private readonly hint = el('div', 'pk-hint')
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
    this.hint.textContent = 'C: kamerayı değiştir'
    this.root.append(this.lap, this.time, this.standings, this.center, this.minimap, this.hint)
    parent.appendChild(this.root)
  }

  update(snap: RaceSnapshot) {
    const me = snap.cars.find((c) => c.id === this.myId)
    this.lap.textContent = me ? `Tur ${me.lap}/${this.race.laps} · Sıra ${me.place}/${snap.cars.length}` : ''
    this.time.textContent = formatTime(snap.time)
    this.updateStandings(snap.cars)
    this.center.textContent = centerMessage(snap, me)
    this.center.classList.toggle('big', snap.phase === 'COUNTDOWN' || snap.time < 1)
    this.drawMinimap(snap.cars)
  }

  dispose() {
    this.root.remove()
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
  if (snap.time < 1) return 'BAŞLA!'
  if (me?.finished) {
    return snap.finishTimer >= 0 ? `${me.place}. oldun! · ${Math.ceil(snap.finishTimer)} sn` : `${me.place}. oldun!`
  }
  if (snap.finishTimer >= 0) return `Son ${Math.ceil(snap.finishTimer)} sn!`
  if (me && !me.onTrack) return 'Piste dön!'
  return ''
}

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
