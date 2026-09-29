// Gerçek tarayıcı testi: iki oyuncu oda kurar/katılır, yarışı başlatır ve ekran görüntüleri alır.
// Kullanım: cd tools && npm install && node browser-test.mjs [çıktı-klasörü]
// Backend (:8080) ve Vite (:5173) çalışıyor olmalı. Chrome yolu CHROME_PATH ile değiştirilebilir.
// Not: headless ortamda ekran kartı yok; FPS değeri gerçek performansı göstermez.
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const OUT = process.argv[2] ?? 'screenshots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

async function openPage(label) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.log(`[${label} pageerror]`, e.message))
  page.on('console', (m) => m.type() === 'error' && console.log(`[${label} console.error]`, m.text()))
  return page
}

const host = await openPage('host')
await host.goto('http://localhost:5173/', { waitUntil: 'networkidle0' })
await host.waitForSelector('input')
await host.click('input', { clickCount: 3 })
await host.type('input', 'Turgay')
await host.click('button.primary')
await host.waitForSelector('.big-code')
const code = await host.$eval('.big-code', (e) => e.textContent)

const guest = await openPage('guest')
await guest.goto(`http://localhost:5173/?oda=${code}`, { waitUntil: 'networkidle0' })
await guest.waitForSelector('input')
await guest.click('input', { clickCount: 3 })
await guest.type('input', 'Ayşe')
await guest.click('button.primary')
await sleep(500)

await host.bringToFront()
const buttons = await host.$$('button.primary')
await buttons[buttons.length - 1].click()
// Işıklar: geri sayım 3 sn; roket start için gaza son anda bas.
await sleep(1200)
await host.screenshot({ path: `${OUT}/1-isiklar.png` })
await sleep(1300)
await host.keyboard.down('ArrowUp')
await sleep(900)
await host.screenshot({ path: `${OUT}/2-roket-start.png` })
// Düzlükte hızlan, kısa bir drift: kıvılcım ve lastik izi.
await sleep(500)
await host.keyboard.down('Space')
await host.keyboard.down('ArrowRight')
await sleep(450)
await host.screenshot({ path: `${OUT}/3-drift.png` })
await host.keyboard.up('ArrowRight')
await host.keyboard.up('Space')
await host.keyboard.down('ArrowLeft')
await sleep(250)
await host.keyboard.up('ArrowLeft')
await sleep(300)
await host.screenshot({ path: `${OUT}/4-iz.png` })
await sleep(1500)
await host.keyboard.up('ArrowUp')
await host.keyboard.press('KeyC')
await sleep(2500)
await host.screenshot({ path: `${OUT}/5-genel.png` })
const fps = await host.evaluate(
  () =>
    new Promise((resolve) => {
      let n = 0
      const t0 = performance.now()
      const tick = () => (++n < 60 ? requestAnimationFrame(tick) : resolve(Math.round((60 * 1000) / (performance.now() - t0))))
      requestAnimationFrame(tick)
    }),
)
console.log('fps (headless yazılım render):', fps)
await browser.close()
