// Backend: games/bulmaca/BulmacaSession içindeki Init / Snapshot / Event / Score / WordView

export interface WordView {
  id: number
  number: number
  /** true soldan sağa, false yukarıdan aşağıya */
  across: boolean
  row: number
  col: number
  length: number
  clue: string
}

export interface BulmacaInit {
  rows: number
  cols: number
  words: WordView[]
  turnSeconds: number
  difficulty: string
  players: { id: string; name: string; color: string; team: number }[]
}

export interface BulmacaEvent {
  type: 'solved' | 'wrong' | 'hint' | 'turn' | 'reveal'
  /** turn olayında virgülle ayrılmış sıradaki oyuncular */
  playerId: string
  word: number
  /** wrong olayında yanlış tahmin */
  guess: string | null
  points: number
}

export interface BulmacaSnapshot {
  phase: 'INTRO' | 'TURN' | 'SWITCH' | 'DONE'
  round: number
  /** Sıradaki oyuncu(lar); takım modunda takımın tamamı */
  turn: string[]
  /** TURN'de kalan süre, diğer fazlarda faz süresi */
  timer: number
  /** Satır başına: '#' boş hücre, '_' açılmamış harf, diğerleri açık harf */
  grid: string[]
  /** Kelime sırasıyla: çözen oyuncu, "" kendiliğinden tamamlandı, null çözülmedi */
  solvedBy: (string | null)[]
  scores: { playerId: string; points: number; words: number }[]
  events: BulmacaEvent[]
}
