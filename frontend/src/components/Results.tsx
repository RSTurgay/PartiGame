import { client } from '../net/GameClient'
import type { RoomView } from '../net/protocol'
import { TEAM_COLORS, TEAM_NAMES } from '../net/protocol'
import { PlayerName } from './PlayerName'

interface Props {
  room: RoomView
  myId: string
  onLeave: () => void
}

const MEDALS = ['🥇', '🥈', '🥉']

export function Results({ room, myId, onLeave }: Props) {
  const isHost = room.hostId === myId
  const results = room.lastResults

  const teamTotals =
    room.mode === 'TEAMS'
      ? [...new Set(results.map((r) => r.team))]
          .map((team) => ({
            team,
            points: results.filter((r) => r.team === team).reduce((sum, r) => sum + r.points, 0),
          }))
          .sort((a, b) => b.points - a.points)
      : []

  const leaderboard = [...room.players].sort((a, b) => b.score - a.score)

  return (
    <div className="lobby">
      <section className="card">
        <h2>Sonuçlar</h2>
        {teamTotals.length > 0 && (
          <div className="team-results">
            {teamTotals.map((t, i) => (
              <div key={t.team} className="team-result" style={{ borderColor: TEAM_COLORS[t.team] }}>
                <span>
                  {MEDALS[i] ?? `${i + 1}.`}{' '}
                  <strong style={{ color: TEAM_COLORS[t.team] }}>{TEAM_NAMES[t.team]} takım</strong>
                </span>
                <strong>{t.points} puan</strong>
              </div>
            ))}
          </div>
        )}
        <ol className="results">
          {results.map((r) => (
            <li key={r.playerId} className={r.playerId === myId ? 'me' : ''}>
              <span className="place">{MEDALS[r.place - 1] ?? `${r.place}.`}</span>
              <PlayerName player={r} isMe={r.playerId === myId} />
              <span className="muted">{r.detail}</span>
              <strong>+{r.points}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2>Parti puan tablosu</h2>
        <ol className="players">
          {leaderboard.map((p) => (
            <li key={p.id}>
              <PlayerName player={p} isMe={p.id === myId} isHost={p.id === room.hostId} />
              <strong>{p.score}</strong>
            </li>
          ))}
        </ol>
        <div className="lobby-actions">
          <button onClick={onLeave}>Odadan çık</button>
          {isHost ? (
            <button className="primary" onClick={() => client.send({ type: 'lobby' })}>
              Lobiye dön
            </button>
          ) : (
            <span className="muted">Oda sahibi yeni oyunu seçiyor…</span>
          )}
        </div>
      </section>
    </div>
  )
}
