import { useState } from 'react'
import { client } from '../net/GameClient'

const NAME_KEY = 'partigame.name'

function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // Tarayıcı depolamayı engelliyorsa isim sadece hatırlanmaz.
  }
}

export function Home() {
  const [name, setName] = useState(loadName)
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('oda') ?? '')
  const invited = code.length > 0

  const create = () => {
    saveName(name)
    client.send({ type: 'create', name })
  }
  const join = () => {
    saveName(name)
    client.send({ type: 'join', name, code })
  }

  return (
    <div className="card home">
      <h1>Parti Game</h1>
      <p className="muted">Arkadaşlarınla mini oyunlarda kapış. Oda kur, linki paylaş, başla!</p>

      <label>
        Adın
        <input
          value={name}
          maxLength={16}
          placeholder="Örn. Turgay"
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (invited ? join() : create())}
        />
      </label>

      <div className="home-actions">
        <div className="join-row">
          <input
            className="code-input"
            value={code}
            maxLength={4}
            placeholder="KOD"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && join()}
          />
          <button className={invited ? 'primary' : ''} disabled={code.length !== 4} onClick={join}>
            Odaya katıl
          </button>
        </div>
        <span className="muted or">veya</span>
        <button className={invited ? '' : 'primary'} onClick={create}>
          Yeni oda kur
        </button>
      </div>
    </div>
  )
}
