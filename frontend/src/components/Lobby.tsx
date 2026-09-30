import { useState } from 'react'
import { findGame } from '../games/registry'
import { client } from '../net/GameClient'
import type { GameInfo, RoomView } from '../net/protocol'
import { MODE_LABELS, TEAM_COLORS, TEAM_NAMES } from '../net/protocol'
import { PlayerName } from './PlayerName'

interface Props {
  room: RoomView
  myId: string
  games: GameInfo[]
  onLeave: () => void
}

const TEAM_COUNT = 4

export function Lobby({ room, myId, games, onLeave }: Props) {
  const isHost = room.hostId === myId
  const game = games.find((g) => g.id === room.gameId)
  const [copied, setCopied] = useState(false)

  const invite = async () => {
    const url = `${location.origin}${location.pathname}?oda=${room.code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('Davet linki:', url)
    }
  }

  return (
    <div className="lobby">
      <section className="card">
        <div className="lobby-head">
          <div>
            <div className="muted">Oda kodu</div>
            <div className="big-code">{room.code}</div>
          </div>
          <button onClick={invite}>{copied ? 'Kopyalandı ✓' : 'Davet linkini kopyala'}</button>
        </div>

        <h2>Oyuncular ({room.players.length})</h2>
        {room.mode === 'TEAMS' ? (
          <div className="teams">
            {Array.from({ length: TEAM_COUNT }, (_, i) => i + 1).map((team) => {
              const members = room.players.filter((p) => p.team === team)
              const mine = members.some((p) => p.id === myId)
              return (
                <div key={team} className="team" style={{ borderColor: TEAM_COLORS[team] }}>
                  <div className="team-title" style={{ color: TEAM_COLORS[team] }}>
                    {TEAM_NAMES[team]} takım
                  </div>
                  {members.map((p) => (
                    <PlayerName key={p.id} player={p} isMe={p.id === myId} isHost={p.id === room.hostId} />
                  ))}
                  {!mine && members.length < 2 && (
                    <button className="small" onClick={() => client.send({ type: 'setTeam', team })}>
                      Katıl
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <ul className="players">
            {room.players.map((p) => (
              <li key={p.id}>
                <PlayerName player={p} isMe={p.id === myId} isHost={p.id === room.hostId} />
                <span className="muted">{p.score} puan</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Oyun</h2>
        <div className="game-list">
          {games.map((g) => (
            <button
              key={g.id}
              className={`game-card ${g.id === room.gameId ? 'selected' : ''}`}
              disabled={!isHost}
              onClick={() => client.send({ type: 'selectGame', gameId: g.id })}
            >
              <strong>{g.name}</strong>
              <span className="muted">{g.description}</span>
            </button>
          ))}
        </div>

        <h2>Mod</h2>
        <div className="chips">
          {game?.modes.map((m) => (
            <button
              key={m}
              className={`chip ${m === room.mode ? 'selected' : ''}`}
              disabled={!isHost}
              onClick={() => client.send({ type: 'selectGame', mode: m })}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {game?.options.map((option) => (
          <div key={option.key}>
            <h2>{option.label}</h2>
            <div className="chips">
              {option.choices.map((choice) => (
                <button
                  key={choice.value}
                  className={`chip ${room.options[option.key] === choice.value ? 'selected' : ''}`}
                  disabled={!isHost}
                  onClick={() => client.send({ type: 'setOption', key: option.key, value: choice.value })}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {game && <p className="muted">🎮 {findGame(game.id)?.controls}</p>}

        <div className="lobby-actions">
          <button onClick={onLeave}>Odadan çık</button>
          {isHost ? (
            <button className="primary" onClick={() => client.send({ type: 'start' })}>
              Oyunu başlat
            </button>
          ) : (
            <span className="muted">Oda sahibinin başlatması bekleniyor…</span>
          )}
        </div>
      </section>
    </div>
  )
}
