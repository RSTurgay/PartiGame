# Kare bulmaca kelime dosyalarını denetler ve temizler:
# yer tutucu ipuçları ("x"), cevabını içeren ipuçları, harf dışı karakter ve tekrarlar atılır.
# Kullanım: python tools/check-words.py   (repo kökünden)
import glob
import json
import re
from collections import Counter

LETTERS = re.compile(r'^[A-ZÇĞİÖŞÜ]+$')
REMOVE = {'PALE', 'UMAN', 'BOĞAN', 'AŞURE', 'BEKLEME', 'OKULLAR', 'TOPRAKLI', 'SABAHLEYİN', 'VAZGEÇ'}
FIX = {'UNVAN': 'Rütbe, sıfat', 'BİN': 'Yüzün on katı', 'İTÜ': 'İstanbul Teknik Üniv. (kısaca)'}


def tr_upper(s):
    return s.replace('i', 'İ').replace('ı', 'I').upper()


total = Counter()
for path in sorted(glob.glob('backend/src/main/resources/bulmaca/kare-*.json')):
    data = json.load(open(path, encoding='utf-8'))
    out, seen = [], set()
    for d in data:
        k, i = d['k'], d['i'].strip()
        if k in FIX:
            i = d['i'] = FIX[k]
        problems = []
        if k in REMOVE:
            problems.append('kaldırıldı')
        if not LETTERS.match(k) or not 2 <= len(k) <= 11:
            problems.append('geçersiz cevap')
        if len(i) < 2 or i.lower() == 'x':
            problems.append('yer tutucu ipucu')
        if len(k) >= 3 and k in tr_upper(i).replace(' ', ''):
            problems.append('ipucu cevabı içeriyor')
        if (k, i) in seen:
            problems.append('tekrar')
        if problems:
            print(f'  {path.split("/")[-1]}: {k} ({i}) -> {", ".join(problems)}')
            continue
        seen.add((k, i))
        out.append(d)
    with open(path, 'w', encoding='utf-8') as f:
        f.write('[\n' + ',\n'.join(json.dumps(d, ensure_ascii=False) for d in out) + '\n]\n')
    total.update(len(d['k']) for d in out)
    print(f'{path.split("/")[-1]}: {len(data)} -> {len(out)}')
print('Harf sayısına göre toplam:', dict(sorted(total.items())), 'toplam', sum(total.values()))
