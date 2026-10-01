import { useMemo } from 'react'
import type { BulmacaInit, BulmacaSnapshot, WordView } from './types'

const FLASH_MS = 1200

interface Props {
  init: BulmacaInit
  snap: BulmacaSnapshot
  selectedId: number | null
  /** Sıra bende mi; değilse tıklamalar bir şey seçmez. */
  active: boolean
  flash: Record<number, number>
  solverColor: (w: WordView) => string | undefined
  onSelectWord: (id: number) => void
  onSelectCell: (r: number, c: number) => void
}

/**
 * Gazete tipi kare bulmaca: sorular kutuların içinde, ok yönünde cevap başlar.
 * Sol üstteki resmin sorusu, resmin sağındaki satırdır.
 */
export function KareBoard({ init, snap, selectedId, active, flash, solverColor, onSelectWord, onSelectCell }: Props) {
  const layout = init.layout ?? []

  // Soru kutusu → içindeki sorular (önce soldan sağa); harf hücresi → geçen kelimeler.
  const { cluesAt, wordsAt } = useMemo(() => {
    const clues = new Map<string, WordView[]>()
    const words = new Map<string, WordView[]>()
    for (const w of init.words) {
      if (w.clueRow >= 0) {
        const key = `${w.clueRow}:${w.clueCol}`
        clues.set(key, [...(clues.get(key) ?? []), w].sort((a, b) => Number(b.across) - Number(a.across)))
      }
      for (let i = 0; i < w.length; i++) {
        const key = w.across ? `${w.row}:${w.col + i}` : `${w.row + i}:${w.col}`
        words.set(key, [...(words.get(key) ?? []), w])
      }
    }
    return { cluesAt: clues, wordsAt: words }
  }, [init])

  const selected = selectedId === null ? null : init.words[selectedId]
  const inSelected = (r: number, c: number) =>
    !!selected &&
    (selected.across
      ? r === selected.row && c >= selected.col && c < selected.col + selected.length
      : c === selected.col && r >= selected.row && r < selected.row + selected.length)

  const picture = init.picture
  const pictureWord = init.words.find((w) => w.clueRow < 0)

  return (
    <div
      className="kb-grid"
      style={{
        gridTemplateColumns: `repeat(${init.cols}, var(--kc))`,
        gridTemplateRows: `repeat(${init.rows}, var(--kc))`,
        ['--kb-cols' as string]: init.cols,
        ['--kb-rows' as string]: init.rows,
      }}
    >
      {layout.flatMap((row, r) =>
        [...row].map((kind, c) => {
          const key = `${r}:${c}`
          if (kind === 'I') {
            if (r !== 0 || c !== 0 || !picture) return null
            const solved = pictureWord && solverColor(pictureWord)
            return (
              <div
                key={key}
                className={`kb-image ${pictureWord?.id === selectedId ? 'selected' : ''}`}
                style={{ gridRow: '1 / span 3', gridColumn: '1 / span 3' }}
                onClick={() => active && pictureWord && !solved && onSelectWord(pictureWord.id)}
              >
                <img src={picture.image} alt="Resimli soru" />
                <div className="kb-image-q">📷 {picture.question}</div>
                <span className="kb-image-arrow">▶</span>
                <a
                  className="kb-credit"
                  href={picture.source}
                  target="_blank"
                  rel="noreferrer"
                  title={`Fotoğraf: ${picture.author} · ${picture.license} · Wikimedia Commons`}
                  onClick={(e) => e.stopPropagation()}
                >
                  ⓘ
                </a>
              </div>
            )
          }
          if (kind === 'C') {
            const clues = cluesAt.get(key) ?? []
            if (clues.length === 0) return <div key={key} className="kb-clue empty" />
            return (
              <div key={key} className={`kb-clue ${clues.length > 1 ? 'double' : ''}`}>
                {clues.map((w) => {
                  const color = solverColor(w)
                  return (
                    <button
                      key={w.id}
                      className={`kb-clue-part ${color ? 'solved' : ''} ${w.id === selectedId ? 'selected' : ''}`}
                      title={w.clue}
                      disabled={!active || !!color}
                      onClick={() => onSelectWord(w.id)}
                    >
                      <span className="kb-clue-text">{w.clue}</span>
                      <span className={`kb-arrow ${w.across ? 'across' : 'down'}`}>{w.across ? '▶' : '▼'}</span>
                    </button>
                  )
                })}
              </div>
            )
          }
          const ch = snap.grid[r]?.[c] ?? '_'
          const words = wordsAt.get(key) ?? []
          const solvedWord = words.find((w) => solverColor(w))
          const color = solvedWord ? solverColor(solvedWord) : undefined
          const flashing = words.some((w) => Date.now() - (flash[w.id] ?? 0) < FLASH_MS)
          return (
            <div
              key={key}
              className={`kb-letter ${inSelected(r, c) ? 'selected' : ''} ${flashing ? 'flash' : ''}`}
              style={color ? { background: `color-mix(in srgb, ${color} 38%, #f4f1e8)` } : undefined}
              onClick={() => onSelectCell(r, c)}
            >
              {ch === '_' ? '' : ch}
            </div>
          )
        }),
      )}
    </div>
  )
}
