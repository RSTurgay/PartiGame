import type { ClientMessage, ServerMessage } from './protocol'

type MessageOf<T extends ServerMessage['type']> = Extract<ServerMessage, { type: T }>
type Handler<T extends ServerMessage['type']> = (msg: MessageOf<T>) => void

/** Sunucuyla tek WebSocket bağlantısı. Mesaj tiplerine abone olunur, abonelik fonksiyonu geri döner. */
export class GameClient {
  private socket: WebSocket | null = null
  private handlers = new Map<string, Set<(msg: ServerMessage) => void>>()
  private statusListeners = new Set<(connected: boolean) => void>()

  /** Birden fazla çağrılabilir; bağlantı zaten varsa bir şey yapmaz. */
  connect() {
    if (this.socket) return
    this.open()
  }

  private open() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
    const socket = new WebSocket(`${protocol}://${location.host}/ws`)
    this.socket = socket
    socket.onopen = () => this.statusListeners.forEach((l) => l(true))
    socket.onclose = () => {
      this.statusListeners.forEach((l) => l(false))
      // Bağlantı koparsa kısa bir süre sonra yeniden dene.
      setTimeout(() => {
        if (this.socket === socket) this.open()
      }, 1500)
    }
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ServerMessage
      this.handlers.get(msg.type)?.forEach((h) => h(msg))
    }
  }

  send(msg: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg))
    }
  }

  on<T extends ServerMessage['type']>(type: T, handler: Handler<T>): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    const h = handler as (msg: ServerMessage) => void
    set.add(h)
    return () => set.delete(h)
  }

  onStatus(listener: (connected: boolean) => void): () => void {
    this.statusListeners.add(listener)
    listener(this.socket?.readyState === WebSocket.OPEN)
    return () => this.statusListeners.delete(listener)
  }
}

export const client = new GameClient()
