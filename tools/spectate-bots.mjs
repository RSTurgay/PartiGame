// Görsel kontrol: tarayıcıdaki oyuncu ve iki bot, eşya kullanarak yarışır. Tarayıcı oyuncusunu da
// otopilot sürer (sayfanın aldığı durumu okuyup tuşlara basar); takip kamerası efektleri yakından gösterir.
// Kullanım: cd tools && node spectate-bots.mjs [çıktı-klasörü]   (backend :8080 ve Vite :5173 açık olmalı)
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const OUT = process.argv[2] ?? 'screenshots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function bot(name) {
  const ws = new WebSocket('ws://localhost:8080/ws')
  const b = { ws, id: null, init: null, state: null, tick: 0 }
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.type === 'joined') b.id = m.playerId
    if (m.type === 'gameStart') b.init = m.init
    if (m.type === 'state') b.state = m.state
  }
  b.send = (o) => ws.send(JSON.stringify(o))
  b.open = new Promise((r) => (ws.onopen = r))
  b.name = name
  return b
}

// En yakın pist noktasının birkaç ilerisine dönen basit otopilot; eşyayı elde edince kullanır.
function drive(b, lookahead) {
  const me = b.state?.cars.find((c) => c.id === b.id)
  if (!me || !b.init) return
  const pts = b.init.points
  let best = 0
  let bestD = Infinity
  pts.forEach(([x, y], i) => {
    const d = Math.hypot(x - me.x, y - me.y)
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  const [tx, ty] = pts[(best + lookahead) % pts.length]
  let diff = Math.atan2(ty - me.y, tx - me.x) - me.a
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  const sharp = Math.abs(diff) > 0.5
  b.send({
    type: 'input',
    input: {
      up: !sharp || me.speed < 150,
      down: sharp && me.speed > 260,
      left: diff < -0.08,
      right: diff > 0.08,
      item: !!me.item && b.tick++ % 2 === 0,
    },
  })
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })
// Sayfanın WebSocket mesajlarını otopilot için yakala.
await page.evaluateOnNewDocument(() => {
  const Native = window.WebSocket
  window.WebSocket = class extends Native {
    constructor(...args) {
      super(...args)
      this.addEventListener('message', (e) => {
        const m = JSON.parse(e.data)
        if (m.type === 'joined') window.__me = m.playerId
        if (m.type === 'gameStart') window.__init = m.init
        if (m.type === 'state') window.__state = m.state
      })
    }
  }
})
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' })
await page.waitForSelector('input')
await page.click('input', { clickCount: 3 })
await page.type('input', 'İzleyici')
await page.click('button.primary')
await page.waitForSelector('.big-code')
const code = await page.$eval('.big-code', (e) => e.textContent)

const bots = [bot('Ayşe'), bot('Can')]
await Promise.all(bots.map((b) => b.open))
for (const b of bots) b.send({ type: 'join', name: b.name, code })
await sleep(500)
const buttons = await page.$$('button.primary')
await buttons[buttons.length - 1].click()
const timer = setInterval(() => bots.forEach((b, i) => drive(b, 3 + i)), 50)

// Tarayıcı oyuncusunun otopilotu: aynı mantık, tuş basarak.
const held = new Set()
const setKey = async (key, down) => {
  if (down && !held.has(key)) {
    held.add(key)
    await page.keyboard.down(key)
  } else if (!down && held.has(key)) {
    held.delete(key)
    await page.keyboard.up(key)
  }
}
let itemToggle = false
const started = Date.now()
let shot = 0
while (Date.now() - started < 40000) {
  const { me, init, state } = await page.evaluate(() => ({ me: window.__me, init: window.__init, state: window.__state }))
  const car = state?.cars.find((c) => c.id === me)
  if (car && init) {
    let best = 0
    let bestD = Infinity
    init.points.forEach(([x, y], i) => {
      const d = Math.hypot(x - car.x, y - car.y)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    const [tx, ty] = init.points[(best + 3) % init.points.length]
    let diff = Math.atan2(ty - car.y, tx - car.x) - car.a
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    await setKey('ArrowUp', Math.abs(diff) < 0.5 || car.speed < 150)
    await setKey('ArrowLeft', diff < -0.08)
    await setKey('ArrowRight', diff > 0.08)
    itemToggle = !itemToggle
    await setKey('KeyE', !!car.item && itemToggle)
  }
  if (Date.now() - started > (shot + 1) * 3000 && shot < 12) {
    shot++
    await page.screenshot({ path: `${OUT}/izle-${shot}.png` })
  }
  await sleep(60)
}
clearInterval(timer)
await browser.close()
bots.forEach((b) => b.ws.close())
console.log('tamam')
