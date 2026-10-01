import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameClient } from '../../net/GameClient'
import { TEAM_COLORS, TEAM_NAMES } from '../../net/protocol'
import type { GameStart } from '../registry'
import { KareBoard } from './KareBoard'
import type { BulmacaEvent, BulmacaInit, BulmacaSnapshot, WordView } from './types'

const HINT_COST = 3

/** Olay akışında ipucunu kısaltarak göster (cevap istemcide olmadığı için kelime yerine ipucu yazılır). */
function shortClue(clue: string | undefined) {
  if (!clue) return ''
  return clue.length > 26 ? `${clue.slice(0, 25)}…` : clue
}
const FEED_SECONDS = 5
const FEED_MAX = 5
/** Yeni çözülen kelimenin parlama süresi (ms). */
const FLASH_MS = 1200

interface FeedItem {
  id: number
  text: string
  tone: 'good' | 'bad' | 'info'
}

interface Props {
  client: GameClient
  start: GameStart
}

export function BulmacaGame({ client, start }: Props) {
  const init = start.init as BulmacaInit
  const myId = start.myId
  const teamMode = start.mode === 'TEAMS'
  const players = useMemo(() => new Map(init.players.map((p) => [p.id, p])), [init])
  const words = useMemo(() => [...init.words].sort((a, b) => a.number - b.number || (a.across ? -1 : 1)), [init])

  const [snap, setSnap] = useState<BulmacaSnapshot | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [flash, setFlash] = useState<Record<number, number>>({})
  /** Oyuncunun en son seçtiği kelime; çözülmüşse ekranda sıradaki çözülmemiş kelime gösterilir. */
  const [selected, setSelected] = useState<number | null>(null)
  /** Yazılan cevap, hangi kelime için yazıldığıyla birlikte; kelime değişince kendiliğinden boşalır. */
  const [draft, setDraft] = useState<{ word: number | null; text: string }>({ word: null, text: '' })
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const feedId = useRef(0)

  const name = (id: string) => players.get(id)?.name ?? '?'

  useEffect(() => {
    const nameOf = (id: string) => players.get(id)?.name ?? '?'
    const addFeed = (text: string, tone: FeedItem['tone']) => {
      const item = { id: feedId.current++, text, tone }
      setFeed((f) => [item, ...f].slice(0, FEED_MAX))
      setTimeout(() => setFeed((f) => f.filter((x) => x.id !== item.id)), FEED_SECONDS * 1000)
    }
    const handle = (e: BulmacaEvent) => {
      const word = init.words[e.word]
      if (e.type === 'solved') {
        addFeed(`✓ ${nameOf(e.playerId)} · ${shortClue(word?.clue)} +${e.points}`, 'good')
        setFlash((f) => ({ ...f, [e.word]: Date.now() }))
      } else if (e.type === 'wrong') {
        addFeed(`✗ ${nameOf(e.playerId)}: ${e.guess}`, 'bad')
        if (e.playerId === myId) {
          setShake(true)
          setTimeout(() => setShake(false), 450)
        }
      } else if (e.type === 'hint') {
        addFeed(`💡 ${nameOf(e.playerId)} harf aldı (−${HINT_COST})`, 'info')
      } else if (e.type === 'reveal') {
        addFeed('🔓 Kimse bilemedi, her kelimeden bir harf açıldı!', 'info')
      }
    }
    return client.on('state', (msg) => {
      const s = msg.state as BulmacaSnapshot
      setSnap(s)
      s.events.forEach(handle)
    })
  }, [client, init, myId, players])

  const myTurn = snap?.phase === 'TURN' && snap.turn.includes(myId)
  const isSolved = (w: WordView) => snap?.solvedBy[w.id] != null

  // Seçili kelime çözüldüyse (ya da hiç seçilmediyse) listede ondan sonraki ilk çözülmemiş kelime.
  const selectedWord: WordView | null = (() => {
    if (!myTurn || !snap) return null
    const current = selected === null ? undefined : init.words[selected]
    if (current && snap.solvedBy[current.id] == null) return current
    const from = current ? words.indexOf(current) : -1
    return [...words.slice(from + 1), ...words.slice(0, from + 1)].find((w) => snap.solvedBy[w.id] == null) ?? null
  })()
  const text = draft.word === selectedWord?.id ? draft.text : ''
  const setText = (value: string) => setDraft({ word: selectedWord?.id ?? null, text: value })
  const select = (id: number) => {
    setSelected(id)
    setDraft({ word: id, text: '' })
  }

  useEffect(() => {
    if (myTurn) inputRef.current?.focus()
  }, [myTurn, selectedWord?.id])

  // Hücre → o hücreden geçen kelimeler ve (varsa) başlangıç numarası.
  const cells = useMemo(() => {
    const map = new Map<string, { number?: number; words: WordView[] }>()
    for (const w of init.words) {
      for (let i = 0; i < w.length; i++) {
        const r = w.across ? w.row : w.row + i
        const c = w.across ? w.col + i : w.col
        const key = `${r}:${c}`
        const cell = map.get(key) ?? { words: [] }
        cell.words.push(w)
        if (i === 0) cell.number = w.number
        map.set(key, cell)
      }
    }
    return map
  }, [init])

  if (!snap) {
    return <div className="bm-root bm-center">Bulmaca hazırlanıyor…</div>
  }

  const inSelected = (r: number, c: number) =>
    !!selectedWord &&
    myTurn &&
    (selectedWord.across
      ? r === selectedWord.row && c >= selectedWord.col && c < selectedWord.col + selectedWord.length
      : c === selectedWord.col && r >= selectedWord.row && r < selectedWord.row + selectedWord.length)

  const selectCell = (r: number, c: number) => {
    if (!myTurn) return
    const options = (cells.get(`${r}:${c}`)?.words ?? []).filter((w) => !isSolved(w))
    if (options.length === 0) return
    // Aynı hücreye tekrar tıklayınca diğer yöndeki kelimeye geç.
    const current = options.find((w) => w.id === selectedWord?.id)
    const other = options.find((w) => w.id !== selectedWord?.id)
    select(current && other ? other.id : options[0].id)
  }

  const submit = () => {
    if (!selectedWord || !text) return
    client.send({ type: 'input', input: { action: 'answer', word: selectedWord.id, text } })
    setText('')
  }

  const turnName = (() => {
    if (snap.turn.length === 0) return ''
    const first = players.get(snap.turn[0])
    if (teamMode && first && first.team > 0) {
      return `${TEAM_NAMES[first.team]} takım (${snap.turn.map(name).join(', ')})`
    }
    return snap.turn.map(name).join(', ')
  })()

  const solverColor = (w: WordView) => {
    const by = snap.solvedBy[w.id]
    return by ? players.get(by)?.color : by === '' ? '#8a8fa8' : undefined
  }

  const scores = [...snap.scores].sort((a, b) => b.points - a.points)
  const timerRatio = snap.phase === 'TURN' ? Math.max(0, snap.timer / init.turnSeconds) : 0

  const kare = init.style === 'KARE'

  const header = (
    <header className={`bm-turn ${myTurn ? 'mine' : ''}`}>
      <div className="bm-turn-text">
        {snap.phase === 'INTRO' && `Bulmaca hazır! İlk sıra: ${turnName}`}
        {snap.phase === 'TURN' && (myTurn ? '✍️ Sıra sende!' : `✍️ Sıra: ${turnName}`)}
        {snap.phase === 'SWITCH' && `Sıradaki: ${turnName}`}
        {snap.phase === 'DONE' && '🎉 Bulmaca tamamlandı!'}
      </div>
      <div className="bm-turn-meta">
        <span>Tur {snap.round}</span>
        <span>{init.difficulty}</span>
        {snap.phase === 'TURN' && <strong className="bm-seconds">{Math.ceil(snap.timer)} sn</strong>}
      </div>
      <div className="bm-timer">
        <div className={`bm-timer-fill ${timerRatio < 0.25 ? 'low' : ''}`} style={{ width: `${timerRatio * 100}%` }} />
      </div>
    </header>
  )

  const classicBoard = (
    <div
      className="bm-grid"
      style={{
        gridTemplateColumns: `repeat(${init.cols}, var(--bm-cell))`,
        ['--bm-cols' as string]: init.cols,
        ['--bm-rows' as string]: init.rows,
      }}
    >
      {snap.grid.flatMap((row, r) =>
        [...row].map((ch, c) => {
          if (ch === '#') return <div key={`${r}:${c}`} className="bm-cell empty" />
          const cell = cells.get(`${r}:${c}`)
          const solvedWord = cell?.words.find((w) => solverColor(w))
          const color = solvedWord ? solverColor(solvedWord) : undefined
          const flashing = cell?.words.some((w) => Date.now() - (flash[w.id] ?? 0) < FLASH_MS)
          return (
            <div
              key={`${r}:${c}`}
              className={`bm-cell ${inSelected(r, c) ? 'selected' : ''} ${flashing ? 'flash' : ''}`}
              style={color ? { background: `color-mix(in srgb, ${color} 38%, #f4f1e8)` } : undefined}
              onClick={() => selectCell(r, c)}
            >
              {cell?.number && <span className="bm-num">{cell.number}</span>}
              <span className="bm-letter">{ch === '_' ? '' : ch}</span>
            </div>
          )
        }),
      )}
    </div>
  )

  const kareBoard = (
    <KareBoard
      init={init}
      snap={snap}
      selectedId={selectedWord?.id ?? null}
      active={myTurn}
      flash={flash}
      solverColor={solverColor}
      onSelectWord={select}
      onSelectCell={selectCell}
    />
  )

  const answerTitle = (w: WordView) => {
    if (w.clueRow < 0 && kare) return '📷 Resim sorusu'
    if (kare) return w.across ? '▶ Soldan sağa' : '▼ Yukarıdan aşağıya'
    return `${w.number}. ${w.across ? 'Soldan sağa' : 'Yukarıdan aşağıya'}`
  }

  const answerPanel = myTurn && selectedWord && (
    <div className={`bm-answer ${shake ? 'shake' : ''}`}>
      <div className="bm-answer-clue">
        <strong>{answerTitle(selectedWord)}</strong> {selectedWord.clue} ({selectedWord.length})
      </div>
      <div className="bm-slots" onClick={() => inputRef.current?.focus()}>
        {Array.from({ length: selectedWord.length }, (_, i) => {
          const r = selectedWord.across ? selectedWord.row : selectedWord.row + i
          const c = selectedWord.across ? selectedWord.col + i : selectedWord.col
          const known = snap.grid[r][c]
          const typed = text[i]
          return (
            <span key={i} className={`bm-slot ${typed ? 'typed' : known !== '_' ? 'known' : ''}`}>
              {typed ?? (known !== '_' ? known : '')}
            </span>
          )
        })}
      </div>
      <div className="bm-answer-row">
        <input
          ref={inputRef}
          value={text}
          maxLength={selectedWord.length}
          placeholder="Cevabı yaz, Enter'a bas"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) =>
            setText(e.target.value.toLocaleUpperCase('tr-TR').replace(/[^\p{L}]/gu, '').slice(0, selectedWord.length))
          }
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="primary" onClick={submit} disabled={!text}>
          Gönder
        </button>
        <button
          onClick={() => client.send({ type: 'input', input: { action: 'hint', word: selectedWord.id } })}
          title={`Rastgele bir harf aç (−${HINT_COST} puan)`}
        >
          💡 Harf al
        </button>
        <button onClick={() => client.send({ type: 'input', input: { action: 'pass' } })}>Pas geç</button>
      </div>
    </div>
  )

  const waiting = !myTurn && snap.phase === 'TURN' && (
    <div className="bm-waiting">{turnName} düşünüyor… Sıran gelince bir soruya tıklayıp cevabı yazabilirsin.</div>
  )

  const scoreList = (
    <div className="bm-scores">
      {scores.map((s) => {
        const p = players.get(s.playerId)
        const active = snap.turn.includes(s.playerId) && snap.phase !== 'DONE'
        return (
          <div key={s.playerId} className={`bm-score ${active ? 'active' : ''}`}>
            <span className="dot" style={{ background: p?.color }} />
            <span className="bm-score-name">
              {p?.name}
              {s.playerId === myId && <span className="muted"> (sen)</span>}
              {teamMode && p && p.team > 0 && (
                <span className="bm-team" style={{ color: TEAM_COLORS[p.team] }}>
                  {' '}
                  · {TEAM_NAMES[p.team]}
                </span>
              )}
            </span>
            <strong>{s.points}</strong>
          </div>
        )
      })}
    </div>
  )

  const feedList = (
    <div className="bm-feed">
      {feed.map((f) => (
        <div key={f.id} className={`bm-feed-line ${f.tone}`}>
          {f.text}
        </div>
      ))}
    </div>
  )

  const clueLists = [true, false].map((across) => (
    <div key={String(across)} className="bm-clues">
      <h3>{across ? 'Soldan sağa' : 'Yukarıdan aşağıya'}</h3>
      {words
        .filter((w) => w.across === across)
        .map((w) => {
          const color = solverColor(w)
          return (
            <button
              key={w.id}
              className={`bm-clue ${color ? 'solved' : ''} ${w.id === selectedWord?.id ? 'selected' : ''}`}
              disabled={!myTurn || !!color}
              onClick={() => select(w.id)}
            >
              <span className="bm-clue-num">{w.number}.</span>
              <span>
                {w.clue} ({w.length})
              </span>
              {color && <span className="dot" style={{ background: color }} />}
            </button>
          )
        })}
    </div>
  ))

  if (kare) {
    return (
      <div className="bm-root">
        {header}
        <div className="bm-main kare">
          <section className="bm-board">{kareBoard}</section>
          <aside className="bm-side">
            {answerPanel}
            {waiting}
            {scoreList}
            {feedList}
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="bm-root">
      {header}
      <div className="bm-main">
        <section className="bm-board">
          {classicBoard}
          {answerPanel}
          {waiting}
        </section>
        <aside className="bm-side">
          {scoreList}
          {feedList}
          {clueLists}
        </aside>
      </div>
    </div>
  )
}
