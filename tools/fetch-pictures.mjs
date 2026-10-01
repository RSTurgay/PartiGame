// Bulmaca resimli soruları için Wikimedia Commons'tan açık lisanslı fotoğraf indirir.
// Sadece kamu malı / CC0 / CC BY / CC BY-SA kabul edilir; yazar, lisans ve kaynak kaydedilir.
// Kullanım: cd tools && node fetch-pictures.mjs   (sonra contact-sheet ile gözden geçir, yanlışları ele)
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT_DIR = new URL('../frontend/public/bulmaca/resim/', import.meta.url)
const META = new URL('../backend/src/main/resources/bulmaca/resimler.json', import.meta.url)
const UA = 'PartiGame/1.0 (https://github.com/RSTurgay/PartiGame)'
const ALLOWED = /^(public domain|pd|cc0|cc by(-sa)? \d|cc-by(-sa)?-\d)/i

// [cevap, soru, arama]
const TOPICS = [
  ['ATATÜRK', 'Resimdeki lider', 'Mustafa Kemal Atatürk portrait'],
  ['MANÇO', 'Resimdeki sanatçının soyadı', 'Baris Manco musician'],
  ['TARKAN', 'Resimdeki şarkıcı', 'Tarkan Tevetoğlu'],
  ['PAMUK', 'Resimdeki yazarın soyadı', 'Orhan Pamuk'],
  ['NAZIM', 'Resimdeki şairin adı', 'Nazım Hikmet'],
  ['EİNSTEİN', 'Resimdeki bilim insanı', 'Albert Einstein 1921 portrait'],
  ['MOZART', 'Resimdeki besteci', 'Wolfgang Amadeus Mozart portrait painting'],
  ['BEETHOVEN', 'Resimdeki besteci', 'Beethoven Stieler portrait'],
  ['NAPOLYON', 'Resimdeki imparator', 'Napoleon Bonaparte portrait David'],
  ['FATİH', 'Resimdeki padişahın unvanı', 'Mehmed II Bellini portrait'],
  ['KANUNİ', 'Resimdeki padişahın lakabı', 'File:EmperorSuleiman.jpg'],
  ['RONALDO', 'Resimdeki futbolcu', 'Cristiano Ronaldo Portugal'],
  ['KIZKULESİ', 'Resimdeki yapı', "Maiden's Tower Istanbul"],
  ['AYASOFYA', 'Resimdeki yapı', 'Hagia Sophia exterior'],
  ['EFES', 'Resimdeki antik kent', 'Library of Celsus Ephesus'],
  ['PAMUKKALE', 'Resimdeki doğa harikası', 'Pamukkale travertines'],
  ['NEMRUT', 'Resimdeki dağ', 'Mount Nemrut heads'],
  ['KAPADOKYA', 'Resimdeki bölge', 'Cappadocia balloons fairy chimneys'],
  ['SÜMELA', 'Resimdeki manastır', 'Sumela Monastery'],
  ['EYFEL', 'Resimdeki kulenin adı', 'Eiffel Tower Paris'],
  ['KOLEZYUM', 'Resimdeki yapı', 'Colosseum Rome exterior'],
  ['PİRAMİT', 'Resimdeki yapı', 'Pyramids of Giza'],
  ['TACMAHAL', 'Resimdeki yapı', 'Taj Mahal'],
  ['LONDRA', 'Resimdeki saat kulesinin şehri', 'Big Ben Westminster'],
  ['PİSA', 'Resimdeki eğik kulenin şehri', 'Leaning Tower of Pisa'],
  ['ÖZGÜRLÜK', 'Resimdeki ... Heykeli', 'File:Statue of Liberty 7.jpg'],
  ['MONALİSA', 'Resimdeki tablo', 'Mona Lisa Leonardo'],
  ['VANGOGH', 'Resimdeki tablonun ressamı', 'The Starry Night Van Gogh'],
  ['ÇIĞLIK', 'Resimdeki tablo', 'The Scream Munch 1893'],
  ['TERBİYECİ', 'Kaplumbağa ... (resimdeki tablo)', 'Tortoise Trainer Osman Hamdi'],
  ['PANDA', 'Resimdeki hayvan', 'Giant panda eating bamboo'],
  ['FLAMİNGO', 'Resimdeki kuş', 'Flamingo bird'],
  ['ZÜRAFA', 'Resimdeki hayvan', 'Giraffe'],
  ['PENGUEN', 'Resimdeki hayvan', 'Emperor penguin'],
  ['KOALA', 'Resimdeki hayvan', 'Koala in tree'],
  ['BAYKUŞ', 'Resimdeki kuş', 'Barn owl'],
  ['ZEBRA', 'Resimdeki hayvan', 'Plains zebra'],
  ['AHTAPOT', 'Resimdeki deniz canlısı', 'Octopus vulgaris'],
  ['KAPLAN', 'Resimdeki hayvan', 'Bengal tiger'],
  ['TAVUSKUŞU', 'Resimdeki kuş', 'Peacock displaying tail'],
  ['SEMAVER', 'Resimdeki çay aracı', 'Samovar Turkish'],
  ['NAZARLIK', 'Resimdeki uğur nesnesi', 'Nazar boncuk evil eye'],
  ['BAĞLAMA', 'Resimdeki çalgı', 'Bağlama saz instrument'],
  ['BAKLAVA', 'Resimdeki tatlı', 'Baklava'],
  ['SİMİT', 'Resimdeki yiyecek', 'Simit Turkish bagel'],
  ['LAHMACUN', 'Resimdeki yiyecek', 'Lahmacun'],
  ['MANTI', 'Resimdeki yemek', 'Turkish manti yogurt'],
  ['KÜNEFE', 'Resimdeki tatlı', 'Künefe dessert'],
  ['LALE', 'Resimdeki çiçek', 'Tulip flower red'],
  ['AYÇİÇEĞİ', 'Resimdeki çiçek', 'Sunflower field'],
  ['VOLKAN', 'Resimdeki doğa olayı', 'Volcano eruption lava'],
  ['GÖKKUŞAĞI', 'Resimdeki doğa olayı', 'Rainbow over landscape'],
]

const strip = (html) => (html ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

async function search(query) {
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  // "File:..." ile başlayan sorgu doğrudan o dosyayı getirir; diğerleri aranır.
  const target = query.startsWith('File:')
    ? { titles: query }
    : { generator: 'search', gsrsearch: `${query} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '10' }
  Object.entries({
    action: 'query',
    ...target,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size|mime',
    iiurlwidth: '360',
    format: 'json',
  }).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  const json = await res.json()
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  for (const p of pages) {
    const info = p.imageinfo?.[0]
    if (!info || !['image/jpeg', 'image/png'].includes(info.mime) || info.width < 320) continue
    const meta = info.extmetadata ?? {}
    const license = strip(meta.LicenseShortName?.value)
    if (!ALLOWED.test(license)) continue
    return {
      thumb: info.thumburl,
      page: info.descriptionurl,
      license,
      author: strip(meta.Artist?.value).slice(0, 80) || 'Bilinmiyor',
      title: p.title,
    }
  }
  return null
}

mkdirSync(OUT_DIR, { recursive: true })
const result = []
for (const [cevap, soru, query] of TOPICS) {
  const found = await search(query)
  if (!found) {
    console.log('BULUNAMADI', cevap)
    continue
  }
  // Dosya adı ASCII olsun: sunucularda Türkçe karakterli yollar sorun çıkarabilir.
  const file = `${asciiName(cevap)}.jpg`
  const img = await fetch(found.thumb, { headers: { 'User-Agent': UA } })
  writeFileSync(new URL(file, OUT_DIR), Buffer.from(await img.arrayBuffer()))
  result.push({ cevap, soru, dosya: `/bulmaca/resim/${file}`, yazar: found.author, lisans: found.license, kaynak: found.page })
  console.log('OK', cevap, '|', found.title, '|', found.license)
  await new Promise((r) => setTimeout(r, 300))
}
writeFileSync(META, JSON.stringify(result, null, 2) + '\n')
writeCredits(result)
console.log(`${result.length}/${TOPICS.length} resim kaydedildi`)

function asciiName(text) {
  const map = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u' }
  return [...text.toLocaleLowerCase('tr-TR')].map((ch) => map[ch] ?? ch).join('').replace(/[^a-z]/g, '')
}

/** Lisans gereği atıf listesi (KAYNAKLAR.md). */
function writeCredits(items) {
  const lines = [
    '# Bulmaca resim kaynakları',
    '',
    "Bu klasördeki fotoğraflar Wikimedia Commons'tan alınmıştır ve kendi lisanslarıyla kullanılmaktadır.",
    'Her fotoğraf oyunda küçültülmüş olarak, yazar ve lisans bilgisiyle gösterilir.',
    '',
    '| Dosya | Yazar | Lisans | Kaynak |',
    '|---|---|---|---|',
    ...items.map((r) => `| ${r.dosya.split('/').pop()} | ${r.yazar.replaceAll('|', '/')} | ${r.lisans} | ${r.kaynak} |`),
  ]
  writeFileSync(new URL('KAYNAKLAR.md', OUT_DIR), lines.join('\n') + '\n')
}
