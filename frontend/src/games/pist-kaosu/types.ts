// Backend: PistKaosuSession.Init / Snapshot / CarView
// Sunucu 2D düzlemde hesaplar: x → Three.js x, y → Three.js z.

export interface RaceInit {
  width: number
  height: number
  trackWidth: number
  laps: number
  points: [number, number][]
  players: { id: string; name: string; color: string; team: number }[]
}

export interface CarState {
  id: string
  x: number
  y: number
  a: number
  speed: number
  /** -1 sol, 0 düz, 1 sağ */
  steer: number
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
