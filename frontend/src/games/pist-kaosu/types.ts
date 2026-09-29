// Backend: PistKaosuSession.Init / Snapshot / CarView
// Sunucu 2D düzlemde hesaplar: x → Three.js x, y → Three.js z.

export interface RaceInit {
  width: number
  height: number
  trackWidth: number
  laps: number
  points: [number, number][]
  boostPads: BoostPad[]
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
}

export interface RaceSnapshot {
  phase: 'COUNTDOWN' | 'RACE' | 'DONE'
  countdown: number
  time: number
  finishTimer: number
  cars: CarState[]
}
