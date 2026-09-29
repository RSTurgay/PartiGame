import type { GameClient } from '../net/GameClient'
import type { GameMode, PlayerView } from '../net/protocol'
import { pistKaosu } from './pist-kaosu'

/** Bir maç başlarken oyuna verilen bilgiler. */
export interface GameStart {
  gameId: string
  mode: GameMode
  init: unknown
  myId: string
  players: PlayerView[]
}

/**
 * İstemci tarafında bir mini oyun. Oyun, verilen DOM elemanına kendini çizer ve
 * temizleme fonksiyonu döner. Phaser kullanmak zorunlu değildir.
 */
export interface ClientGame {
  id: string
  /** Lobide gösterilen kısa kontrol açıklaması. */
  controls: string
  mount(parent: HTMLElement, client: GameClient, start: GameStart): () => void
}

const games: ClientGame[] = [pistKaosu]

export function findGame(id: string): ClientGame | undefined {
  return games.find((g) => g.id === id)
}
