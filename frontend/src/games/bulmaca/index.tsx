import { createRoot } from 'react-dom/client'
import type { ClientGame } from '../registry'
import { BulmacaGame } from './BulmacaGame'

export const bulmaca: ClientGame = {
  id: 'bulmaca',
  controls: 'Sıran gelince ipucunu seç, cevabı yaz, Enter · Harf al: −3 puan · Arka arkaya bilene seri bonusu',
  mount(parent, client, start) {
    // Her kurulumda ayrı bir kap: StrictMode'da eski kök geç kapanırken yenisini bozmasın.
    const host = document.createElement('div')
    host.className = 'bm-host'
    parent.appendChild(host)
    const root = createRoot(host)
    root.render(<BulmacaGame client={client} start={start} />)
    return () => {
      // Üst bileşen render ederken kök senkron kapatılamaz; bir sonraki tura bırak.
      setTimeout(() => {
        root.unmount()
        host.remove()
      })
    }
  },
}
