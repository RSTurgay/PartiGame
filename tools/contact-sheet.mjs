// İndirilen bulmaca resimlerini cevaplarıyla tek sayfada gösterir; yanlış eşleşmeleri gözle elemek için.
// Kullanım: cd tools && node contact-sheet.mjs [çıktı.png]
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const OUT = process.argv[2] ?? 'screenshots/resimler.png'
const meta = JSON.parse(readFileSync(new URL('../backend/src/main/resources/bulmaca/resimler.json', import.meta.url)))
const publicDir = fileURLToPath(new URL('../frontend/public', import.meta.url)).replace(/\\/g, '/')
const cells = meta
  .map(
    (m) => `<figure><img src="file:///${publicDir}${m.dosya}"><figcaption><b>${m.cevap}</b><br>${m.soru}</figcaption></figure>`,
  )
  .join('')
const html = `<html><body style="margin:0;background:#222;color:#fff;font:12px sans-serif">
<div style="display:grid;grid-template-columns:repeat(8,160px);gap:6px;padding:6px">${cells}</div>
<style>figure{margin:0}img{width:160px;height:110px;object-fit:cover;display:block}</style></body></html>`
const htmlPath = fileURLToPath(new URL('./screenshots/_sheet.html', import.meta.url))
writeFileSync(htmlPath, html)

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--allow-file-access-from-files'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1340, height: 900 })
await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' })
await page.screenshot({ path: OUT, fullPage: true })
await browser.close()
console.log('kaydedildi:', OUT)
