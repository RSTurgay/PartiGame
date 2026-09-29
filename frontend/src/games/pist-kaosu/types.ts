// Backend: PistKaosuSession.Init / Snapshot / CarView
// Sunucu 2D düzlemde hesaplar: x → Three.js x, y → Three.js z.

export interface RaceInit {
  width: number
  height: number
  trackWidth: number
  laps: number
  points: [number, number][]
  boostPads: BoostPad[]
  /** Sürpriz kutularının yerleri; snapshot.boxes aynı sırayla durumlarını verir. */
  itemBoxes: [number, number][]
  players: { id: string; name: string; color: string; team: number }[]
}

/** Pist üzerinde, gidiş yönüne hizalı turbo şeridi (sunucu koordinatı). */
export interface BoostPad {
  x: number
  y: number
  angle: number
  length: number
  width: number
}

export interface CarState {
  id: string
  x: number
  y: number
  a: number
  speed: number
  /** Yana kayma hızı; lastik izi için. */
  slip: number
  /** -1 sol, 0 düz, 1 sağ */
  steer: number
  /** 0 yok, 1 drift (şarj yok), 2 mavi, 3 turuncu turbo şarjı */
  drift: number
  boost: boolean
  lap: number
  place: number
  finished: boolean
  onTrack: boolean
  item: ItemKind | null
  /** Eşya çarkı dönüyor. */
  rolling: boolean
  /** Muza bastı, dönüyor. */
  spin: boolean
  frozen: boolean
  shield: boolean
}

export type ItemKind = 'TURBO' | 'BANANA' | 'ICE' | 'SHIELD'

/**
 * pickup: kutu alındı, use: eşya kullanıldı, hit: isabet, block: kalkan engelledi.
 * other: use/ICE'da hedef, hit/block'ta saldıran.
 */
export interface ItemEvent {
  type: 'pickup' | 'use' | 'hit' | 'block'
  playerId: string
  item: ItemKind | null
  other: string | null
}

export interface RaceSnapshot {
  phase: 'COUNTDOWN' | 'RACE' | 'DONE'
  countdown: number
  time: number
  finishTimer: number
  cars: CarState[]
  boxes: boolean[]
  bananas: [number, number][]
  /** Sadece bu snapshot'a ait olaylar; her snapshot bir kez işlenmeli. */
  events: ItemEvent[]
}
