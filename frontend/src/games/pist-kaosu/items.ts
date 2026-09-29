import * as THREE from 'three'
import type { ItemKind, RaceInit, RaceSnapshot } from './types'

export const ITEM_ICONS: Record<ItemKind, string> = {
  TURBO: '⚡',
  BANANA: '🍌',
  ICE: '🧊',
  SHIELD: '🛡️',
}

const BOX_SIZE = 18
const MAX_BANANAS = 12
const SHARD_FLIGHT_SECONDS = 0.35

interface Box {
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  /** Geri gelirken büyüme animasyonu için 0..1. */
  grow: number
  phase: number
}

interface Shard {
  mesh: THREE.Mesh
  from: THREE.Vector3
  targetId: string
  age: number
}

/** Sürpriz kutuları, yerdeki muzlar ve buz atışının uçan parçası. */
export class ItemVisuals {
  private readonly scene: THREE.Scene
  private readonly boxes: Box[] = []
  private readonly bananas: THREE.Group[] = []
  private readonly shards: Shard[] = []
  private readonly disposables: { dispose(): void }[] = []
  private readonly shardGeometry: THREE.OctahedronGeometry
  private readonly shardMaterial: THREE.MeshStandardMaterial

  constructor(scene: THREE.Scene, race: RaceInit) {
    this.scene = scene
    this.createBoxes(race)
    this.createBananas()
    this.shardGeometry = this.track(new THREE.OctahedronGeometry(7, 0))
    this.shardMaterial = this.track(
      new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: 0x5ec8ff, emissiveIntensity: 0.8, flatShading: true }),
    )
  }

  private createBoxes(race: RaceInit) {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(0, 0, 64, 64)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 5
    ctx.strokeRect(3, 3, 58, 58)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 44px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('?', 32, 35)
    const texture = this.track(new THREE.CanvasTexture(canvas))
    texture.colorSpace = THREE.SRGBColorSpace
    const geometry = this.track(new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE))

    race.itemBoxes.forEach(([x, y], i) => {
      const material = this.track(
        new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          opacity: 0.85,
          emissiveIntensity: 0.6,
          roughness: 0.2,
        }),
      )
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(x, 18, y)
      mesh.castShadow = true
      this.scene.add(mesh)
      this.boxes.push({ mesh, grow: 1, phase: i * 0.7 })
    })
  }

  private createBananas() {
    const peel = this.track(new THREE.MeshStandardMaterial({ color: 0xffd93d, roughness: 0.5 }))
    const tip = this.track(new THREE.MeshStandardMaterial({ color: 0x5b3a1a, roughness: 0.8 }))
    // Yay şeklinde gövde: yarım torus.
    const bodyGeo = this.track(new THREE.TorusGeometry(7, 2.6, 8, 14, Math.PI))
    const tipGeo = this.track(new THREE.CylinderGeometry(0.9, 1.2, 3, 6))
    for (let i = 0; i < MAX_BANANAS; i++) {
      const group = new THREE.Group()
      const body = new THREE.Mesh(bodyGeo, peel)
      body.rotation.x = -Math.PI / 2
      body.castShadow = true
      const end = new THREE.Mesh(tipGeo, tip)
      end.position.set(7, 0, 0)
      group.add(body, end)
      group.visible = false
      this.scene.add(group)
      this.bananas.push(group)
    }
  }

  /** Buz kullanıldı: kullanan arabadan hedefe uçan bir buz parçası. */
  launchIce(from: THREE.Vector3, targetId: string) {
    const mesh = new THREE.Mesh(this.shardGeometry, this.shardMaterial)
    mesh.position.copy(from)
    this.scene.add(mesh)
    this.shards.push({ mesh, from: from.clone(), targetId, age: 0 })
  }

  /** @param carPosition oyuncu kimliğinden arabanın şu anki görüntü konumu */
  update(time: number, dt: number, snap: RaceSnapshot | null, carPosition: (id: string) => THREE.Vector3 | null) {
    const hue = (time * 0.15) % 1
    this.boxes.forEach((box, i) => {
      const active = snap?.boxes[i] ?? true
      if (!active) {
        box.grow = 0
        box.mesh.visible = false
        return
      }
      box.grow = Math.min(1, box.grow + dt * 3)
      box.mesh.visible = true
      box.mesh.scale.setScalar(box.grow)
      box.mesh.rotation.set(time * 0.7 + box.phase, time * 1.1 + box.phase, 0)
      box.mesh.position.y = 18 + Math.sin(time * 2.5 + box.phase) * 3
      // Gökkuşağı gibi renk değiştirir.
      box.mesh.material.emissive.setHSL((hue + i * 0.08) % 1, 0.9, 0.45)
      box.mesh.material.color.setHSL((hue + i * 0.08) % 1, 0.7, 0.65)
    })

    const bananas = snap?.bananas ?? []
    this.bananas.forEach((group, i) => {
      const pos = bananas[i]
      group.visible = pos !== undefined
      if (pos) {
        group.position.set(pos[0], 3, pos[1])
        group.rotation.y = i * 1.3
      }
    })

    for (let i = this.shards.length - 1; i >= 0; i--) {
      const shard = this.shards[i]
      shard.age += dt
      const target = carPosition(shard.targetId)
      const t = Math.min(1, shard.age / SHARD_FLIGHT_SECONDS)
      if (!target || t >= 1) {
        shard.mesh.removeFromParent()
        this.shards.splice(i, 1)
        continue
      }
      // Kavisli uçuş
      shard.mesh.position.lerpVectors(shard.from, target, t)
      shard.mesh.position.y += 30 + Math.sin(t * Math.PI) * 40
      shard.mesh.rotation.set(time * 12, time * 9, 0)
    }
  }

  dispose() {
    this.boxes.forEach((b) => b.mesh.removeFromParent())
    this.bananas.forEach((b) => b.removeFromParent())
    this.shards.forEach((s) => s.mesh.removeFromParent())
    this.disposables.forEach((d) => d.dispose())
  }

  private track<T extends { dispose(): void }>(resource: T): T {
    this.disposables.push(resource)
    return resource
  }
}
