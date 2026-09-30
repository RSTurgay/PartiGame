// Backend'deki com.partigame.room.Messages ve net.ClientMessage ile birebir eşleşir.

export type GameMode = 'FFA' | 'TEAMS' | 'DUEL'
export type RoomPhase = 'LOBBY' | 'PLAYING' | 'RESULTS'

/** Oyunun lobide seçilebilen ayarı (backend game/GameOption). */
export interface GameOptionInfo {
  key: string
  label: string
  choices: { value: string; label: string }[]
  defaultValue: string
}

export interface GameInfo {
  id: string
  name: string
  description: string
  minPlayers: number
  maxPlayers: number
  modes: GameMode[]
  options: GameOptionInfo[]
}

export interface PlayerView {
  id: string
  name: string
  color: string
  team: number
  score: number
}

export interface ResultView {
  playerId: string
  name: string
  color: string
  team: number
  place: number
  points: number
  detail: string
}

export interface RoomView {
  code: string
  hostId: string
  phase: RoomPhase
  gameId: string
  mode: GameMode
  /** Seçili oyunun ayarları: anahtar → seçilen değer. */
  options: Record<string, string>
  players: PlayerView[]
  lastResults: ResultView[]
}

export type ServerMessage =
  | { type: 'welcome'; games: GameInfo[] }
  | { type: 'joined'; code: string; playerId: string }
  | { type: 'room'; room: RoomView }
  | { type: 'gameStart'; gameId: string; mode: GameMode; init: unknown }
  | { type: 'state'; state: unknown }
  | { type: 'gameEnd'; results: ResultView[] }
  | { type: 'error'; message: string }

export type ClientMessage =
  | { type: 'create'; name: string }
  | { type: 'join'; name: string; code: string }
  | { type: 'leave' }
  | { type: 'selectGame'; gameId?: string; mode?: GameMode }
  | { type: 'setOption'; key: string; value: string }
  | { type: 'setTeam'; team: number }
  | { type: 'start' }
  | { type: 'lobby' }
  | { type: 'input'; input: Record<string, unknown> }

export const MODE_LABELS: Record<GameMode, string> = {
  FFA: 'Herkes tek',
  TEAMS: '2\'şer kişilik takımlar',
  DUEL: 'Düello (1v1)',
}

export const TEAM_COLORS = ['', '#ff5a5f', '#3ea6ff', '#48d597', '#ffc93c']
export const TEAM_NAMES = ['', 'Kırmızı', 'Mavi', 'Yeşil', 'Sarı']
