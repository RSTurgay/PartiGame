// Bulmaca Kapışması tarayıcı testi: iki oyuncu, lobide ayar seçimi, doğru/yanlış cevap, harf alma, pas, sıra değişimi.
// Cevaplar istemciye gönderilmediği için ekrandaki ipucu soru bankasında aranır.
// Kullanım: cd tools && node bulmaca-test.mjs [çıktı-klasörü] [KARE|KLASIK]   (backend :8080 ve Vite :5173 açık olmalı)
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const OUT = process.argv[2] ?? 'screenshots'
const STYLE = process.argv[3] ?? 'KARE'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// İpucu → olası cevaplar (aynı ipucunun birden çok cevabı olabilir: "Bir nota" gibi)
const resources = new URL('../backend/src/main/resources/bulmaca/', import.meta.url)
const answersFor = new Map()
const addAnswer = (clue, answer) => answersFor.set(clue, [...(answersFor.get(clue) ?? []), answer])
for (const q of JSON.parse(readFileSync(new URL('sorular.json', resources)))) addAnswer(q.ipucu, q.cevap)
for (const f of readdirSync(resources).filter((f) => f.startsWith('kare-'))) {
  for (const w of JSON.parse(readFileSync(new URL(f, resources)))) addAnswer(w.i, w.k)
}
for (const p of JSON.parse(readFileSync(new URL('resimler.json', resources)))) addAnswer(p.soru, p.cevap)

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

async function openPage(label) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1366, height: 860 })
  page.on('pageerror', (e) => console.log(`[${label} pageerror]`, e.message))
  page.on('console', (m) => m.type() === 'error' && console.log(`[${label} console.error]`, m.text()))
  return page
}

async function clickByText(page, selector, text) {
  const handles = await page.$$(selector)
  for (const h of handles) {
    if ((await h.evaluate((e) => e.textContent)).includes(text)) {
      await h.click()
      return
    }
  }
  throw new Error(`Bulunamadı: ${selector} "${text}"`)
}

/** Seçili kelimenin ipucu ve uzunluğu ("▶ Soldan sağa Başkentimiz (6)" → ["Başkentimiz", 6]). */
async function selectedClue(page) {
  const raw = await page.$eval('.bm-answer-clue', (e) => e.textContent)
  const length = Number(raw.match(/\((\d+)\)\s*$/)[1])
  const clue = raw
    .replace(/^(\d+\.\s*)?(▶ |▼ |📷 )?(Soldan sağa|Yukarıdan aşağıya|Resim sorusu)\s*/, '')
    .replace(/\s*\(\d+\)\s*$/, '')
  return [clue, length]
}

/** Seçili kelimeyi bilene kadar aday cevapları dener; bildiyse cevabı döner. */
async function solveSelected(page, label) {
  const [clue, length] = await selectedClue(page)
  const candidates = (answersFor.get(clue) ?? []).filter((a) => [...a].length === length)
  console.log(`${label} ipucu: ${clue} (${length}) → adaylar: ${candidates.join(', ')}`)
  for (const answer of candidates) {
    const before = await page.$eval('.bm-score', (e) => e.textContent)
    await page.type('.bm-answer-row input', answer.toLocaleLowerCase('tr-TR'))
    await page.keyboard.press('Enter')
    await sleep(700)
    const after = await page.$eval('.bm-score', (e) => e.textContent).catch(() => before)
    if (after !== before) return answer
  }
  return null
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
// Arka plandaki sekmeyi Chrome dondurur; her sayfayla çalışmadan önce öne getir.
await host.bringToFront()

await clickByText(host, '.game-card', 'Bulmaca')
await sleep(300)
await clickByText(host, '.chip', '45 sn')
await clickByText(host, '.chip', 'Kolay')
await clickByText(host, '.chip', STYLE === 'KARE' ? 'Gazete' : 'Klasik')
await sleep(300)
const guestSees = await guest.$$eval('.chip.selected', (els) => els.map((e) => e.textContent))
console.log('misafirin gördüğü seçimler:', guestSees)
await host.screenshot({ path: `${OUT}/b1-lobi.png` })

const buttons = await host.$$('button.primary')
await buttons[buttons.length - 1].click()
await host.waitForSelector('.bm-answer', { timeout: 10000 })
await sleep(300)
await host.screenshot({ path: `${OUT}/b2-sira-bende.png` })

// Doğru cevap
console.log('bilinen:', await solveSelected(host, 'host'))
const scoreAfterCorrect = await host.$eval('.bm-score', (e) => e.textContent)
console.log('doğru cevaptan sonra puan satırı:', scoreAfterCorrect)
await host.screenshot({ path: `${OUT}/b3-dogru.png` })

// Yanlış cevap
await host.type('.bm-answer-row input', 'zzz')
await host.keyboard.press('Enter')
await sleep(200)
await host.screenshot({ path: `${OUT}/b4-yanlis.png` })

// Harf al ve pas
await clickByText(host, '.bm-answer-row button', 'Harf al')
await sleep(300)
await clickByText(host, '.bm-answer-row button', 'Pas geç')
await sleep(3200)

// Misafirin sırası (izleyen ekranı sonra host'ta çekilir)
await guest.bringToFront()
await guest.waitForSelector('.bm-answer', { timeout: 5000 })
console.log('misafirin bildiği:', await solveSelected(guest, 'misafir'))
await guest.screenshot({ path: `${OUT}/b5-misafir.png` })
await host.bringToFront()
await host.screenshot({ path: `${OUT}/b6-izleyen.png` })
const feed = await host.$$eval('.bm-feed-line', (els) => els.map((e) => e.textContent))
console.log('olay akışı (host):', feed)
await browser.close()
