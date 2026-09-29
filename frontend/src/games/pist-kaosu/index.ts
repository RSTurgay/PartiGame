import type { ClientGame } from '../registry'
import { PistKaosu3D } from './PistKaosu3D'

export const pistKaosu: ClientGame = {
  id: 'pist-kaosu',
  controls: 'Yön tuşları veya WASD ile sür · C ile kamerayı değiştir',
  mount(parent, client, start) {
    const game = new PistKaosu3D(parent, client, start)
    return () => game.dispose()
  },
}
