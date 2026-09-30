import { useEffect, useRef } from 'react'
import { findGame, type GameStart } from '../games/registry'
import { client } from '../net/GameClient'

export function GameView({ start }: { start: GameStart }) {
  const container = useRef<HTMLDivElement>(null)
  const game = findGame(start.gameId)
  // Oyuncu listesi oyun sırasında değişse de oyunu yeniden kurmamak için ilk hali sabitlenir.
  const startRef = useRef(start)

  useEffect(() => {
    if (!container.current || !game) return
    return game.mount(container.current, client, startRef.current)
  }, [game])

  if (!game) {
    return <div className="card center">Bu oyun istemcide bulunamadı: {start.gameId}</div>
  }
  return <div className={`game-view game-${game.id}`} ref={container} />
}
