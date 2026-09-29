// Uçtan uca sunucu testi: iki bot oda kurar/katılır, takım modunda yarışı kendi kendine tamamlar.
// Kullanım: node tools/race-bots.mjs (backend :8080'de çalışıyor olmalı, Node 22+)
const URL = process.env.SERVER_URL ?? 'ws://localhost:8080/ws'

function bot(name) {
  const ws = new WebSocket(URL)
  const b = { name, ws, msgs: [], id: null, room: null, init: null, state: null, errors: [], events: {}, tick: 0 }
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.type === 'joined') b.id = m.playerId
    if (m.type === 'room') b.room = m.room
    if (m.type === 'gameStart') b.init = m.init
    if (m.type === 'state') {
      b.state = m.state
      for (const e of m.state.events ?? []) {
        const key = `${e.type}${e.item ? ':' + e.item : ''}`
        b.events[key] = (b.events[key] ?? 0) + 1
      }
    }
    if (m.type === 'gameEnd') b.results = m.results
    if (m.type === 'error') b.errors.push(m.message)
  }
  b.send = (o) => ws.send(JSON.stringify(o))
  b.open = new Promise((r) => (ws.onopen = r))
  return b
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Basit otopilot: en yakın pist noktasının birkaç ilerisine doğru döner.
function drive(b, lookahead, throttleBias) {
  if (!b.state || !b.init) return
  const me = b.state.cars.find((c) => c.id === b.id)
  if (!me) return
  const pts = b.init.points
  let best = 0, bestD = Infinity
  pts.forEach(([x, y], i) => {
    const d = Math.hypot(x - me.x, y - me.y)
    if (d < bestD) { bestD = d; best = i }
  })
  const [tx, ty] = pts[(best + lookahead) % pts.length]
  let diff = Math.atan2(ty - me.y, tx - me.x) - me.a
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  const sharp = Math.abs(diff) > 0.5
  // Eşya varsa kullan; tuş basıp bırakma gibi olsun diye bir tick basılı, bir tick bırakılmış.
  const item = !!me.item && b.tick++ % 2 === 0
  b.send({ type: 'input', input: { item,
    up: !sharp || me.speed < 150 * throttleBias, down: sharp && me.speed > 260,
    left: diff < -0.08, right: diff > 0.08 } })
}

const a = bot('Ayşe'), c = bot('Can')
await Promise.all([a.open, c.open])
a.send({ type: 'create', name: 'Ayşe' })
await sleep(300)
console.log('oda:', a.room.code, 'host:', a.room.hostId === a.id)
c.send({ type: 'join', name: 'Can', code: a.room.code.toLowerCase() })
await sleep(300)
c.send({ type: 'start' }) // host değil, hata beklenir
a.send({ type: 'selectGame', mode: 'TEAMS' })
await sleep(300)
console.log('takımlar:', a.room.players.map((p) => `${p.name}:${p.team}`).join(', '))
c.send({ type: 'setTeam', team: 2 })
await sleep(300)
console.log('takımlar:', a.room.players.map((p) => `${p.name}:${p.team}`).join(', '))
a.send({ type: 'start' })
await sleep(300)
console.log('faz:', a.room.phase, 'pist noktası:', a.init.points.length)

const t0 = Date.now()
let lastLog = 0
while (!a.results && Date.now() - t0 < 120000) {
  drive(a, 4, 1)
  drive(c, 3, 0.8)
  await sleep(50)
  if (Date.now() - lastLog > 5000 && a.state) {
    lastLog = Date.now()
    console.log(`t=${a.state.time}s`, a.state.phase,
      a.state.cars.map((x) => `tur${x.lap} sıra${x.place} v${x.speed} ${x.onTrack ? 'pist' : 'ÇİM'}`).join(' | '))
  }
}
console.log('sonuç:', JSON.stringify(a.results))
console.log('parti puanı:', a.room.players.map((p) => `${p.name}=${p.score}`).join(', '), 'faz:', a.room.phase)
console.log('hatalar Can:', c.errors, 'Ayşe:', a.errors)
console.log('eşya olayları:', JSON.stringify(a.events))
a.send({ type: 'lobby' })
await sleep(200)
console.log('lobiye dönüş:', a.room.phase)
a.ws.close(); c.ws.close()
