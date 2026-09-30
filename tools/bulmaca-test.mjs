// Bulmaca Kapışması tarayıcı testi: iki oyuncu, lobide ayar seçimi, doğru/yanlış cevap, harf alma, pas, sıra değişimi.
// Cevaplar istemciye gönderilmediği için ekrandaki ipucu soru bankasında aranır.
// Kullanım: cd tools && node bulmaca-test.mjs [çıktı-klasörü]   (backend :8080 ve Vite :5173 açık olmalı)
import { mkdirSync, readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const OUT = process.argv[2] ?? 'screenshots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const bank = JSON.parse(readFileSync(new URL('../backend/src/main/resources/bulmaca/sorular.json', import.meta.url)))
const answerFor = (clueText) => bank.find((q) => q.ipucu === clueText)?.cevap

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

/** Seçili kelimenin ipucu metni ("3. Soldan sağa Başkentimiz (6)" → "Başkentimiz"). */
async function selectedClue(page) {
  const raw = await page.$eval('.bm-answer-clue', (e) => e.textContent)
  return raw.replace(/^\d+\.\s*(Soldan sağa|Yukarıdan aşağıya)\s*/, '').replace(/\s*\(\d+\)\s*$/, '')
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
const clue = await selectedClue(host)
const answer = answerFor(clue)
console.log('ipucu:', clue, '→', answer)
await host.type('.bm-answer-row input', answer.toLocaleLowerCase('tr-TR'))
await host.keyboard.press('Enter')
await sleep(600)
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
const guestClue = await selectedClue(guest)
const guestAnswer = answerFor(guestClue)
console.log('misafir ipucu:', guestClue, '→', guestAnswer)
await guest.type('.bm-answer-row input', guestAnswer)
await guest.keyboard.press('Enter')
await sleep(600)
await guest.screenshot({ path: `${OUT}/b5-misafir.png` })
await host.bringToFront()
await host.screenshot({ path: `${OUT}/b6-izleyen.png` })
const feed = await host.$$eval('.bm-feed-line', (els) => els.map((e) => e.textContent))
console.log('olay akışı (host):', feed)
await browser.close()
