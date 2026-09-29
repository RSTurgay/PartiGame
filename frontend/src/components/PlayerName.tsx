import type { PlayerView } from '../net/protocol'

interface Props {
  player: Pick<PlayerView, 'name' | 'color'>
  isMe?: boolean
  isHost?: boolean
}

export function PlayerName({ player, isMe, isHost }: Props) {
  return (
    <span className="player-name">
      <span className="dot" style={{ background: player.color }} />
      {player.name}
      {isMe && <span className="muted"> (sen)</span>}
      {isHost && <span title="Oda sahibi"> 👑</span>}
    </span>
  )
}
