import { useEffect, useState } from 'react'
import { GameView } from './components/GameView'
import { Home } from './components/Home'
import { Lobby } from './components/Lobby'
import { Results } from './components/Results'
import type { GameStart } from './games/registry'
import { client } from './net/GameClient'
import type { GameInfo, RoomView } from './net/protocol'

export default function App() {
  const [connected, setConnected] = useState(false)
  const [games, setGames] = useState<GameInfo[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [room, setRoom] = useState<RoomView | null>(null)
  const [start, setStart] = useState<Omit<GameStart, 'players'> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const subs = [
      client.onStatus((ok) => {
        setConnected(ok)
        if (!ok) {
          setRoom(null)
          setStart(null)
        }
      }),
      client.on('welcome', (m) => setGames(m.games)),
      client.on('joined', (m) => {
        setMyId(m.playerId)
        const url = new URL(location.href)
        url.searchParams.set('oda', m.code)
        history.replaceState(null, '', url)
      }),
      client.on('room', (m) => setRoom(m.room)),
      client.on('gameStart', (m) => setStart({ gameId: m.gameId, mode: m.mode, init: m.init, myId: '' })),
      client.on('error', (m) => setError(m.message)),
    ]
    // Dinleyiciler hazır olduktan sonra bağlan; yoksa ilk mesajlar kaçabilir.
    client.connect()
    return () => subs.forEach((unsub) => unsub())
  }, [])

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 3500)
    return () => clearTimeout(timer)
  }, [error])

  const leave = () => {
    client.send({ type: 'leave' })
    setRoom(null)
    setStart(null)
    const url = new URL(location.href)
    url.searchParams.delete('oda')
    history.replaceState(null, '', url)
  }

  let screen
  if (!connected) {
    screen = <div className="card center">Sunucuya bağlanılıyor…</div>
  } else if (!room || !myId) {
    screen = <Home />
  } else if (room.phase === 'PLAYING' && start) {
    screen = <GameView start={{ ...start, myId, players: room.players }} />
  } else if (room.phase === 'RESULTS') {
    screen = <Results room={room} myId={myId} onLeave={leave} />
  } else {
    screen = <Lobby room={room} myId={myId} games={games} onLeave={leave} />
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">🎉 Parti Game</span>
        {room && <span className="room-chip">Oda {room.code}</span>}
      </header>
      <main>{screen}</main>
      {error && <div className="toast">{error}</div>}
    </div>
  )
}
