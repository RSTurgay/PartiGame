import * as THREE from 'three'
import { Nature, seededRandom } from './nature'
import type { RaceInit, RaceSnapshot } from './types'

const CURB_WIDTH = 12
const ASPHALT = 0x3b3f4a
const SKY = 0xa8dcff

export interface World {
  /** @param time saniye; rüzgâr ve start ışıkları için */
  update(time: number, snap: RaceSnapshot | null): void
}

/** Pist, çim, dekor ve ışıkları sahneye ekler. Pistin tamamı sunucudan gelen noktalardan üretilir. */
export function buildWorld(scene: THREE.Scene, race: RaceInit): World {
  scene.background = new THREE.Color(SKY)
  scene.fog = new THREE.Fog(SKY, 1800, 4200)

  addLights(scene, race)
  addGround(scene, race)
  addTrack(scene, race)
  const startLights = addStartLine(scene, race)
  addBarriers(scene, race)
  const nature = new Nature(scene, race, CURB_WIDTH)
  addGrandstand(scene, race)

  return {
    update(time, snap) {
      nature.update(time)
      if (snap) startLights.update(snap)
    },
  }
}

function addLights(scene: THREE.Scene, race: RaceInit) {
  scene.add(new THREE.HemisphereLight(0xdff1ff, 0x4a6b3a, 1.4))

  const sun = new THREE.DirectionalLight(0xfff4e0, 2.2)
  const cx = race.width / 2
  const cz = race.height / 2
  sun.position.set(cx + 500, 900, cz - 700)
  sun.target.position.set(cx, 0, cz)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const s = sun.shadow.camera
  s.left = -1100
  s.right = 1100
  s.top = 900
  s.bottom = -900
  s.near = 100
  s.far = 2500
  sun.shadow.bias = -0.0005
  scene.add(sun, sun.target)
}

function addGround(scene: THREE.Scene, race: RaceInit) {
  // Biçilmiş çim görünümü için açık-koyu şeritler.
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 1
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#4c9a4f'
  ctx.fillRect(0, 0, 1, 1)
  ctx.fillStyle = '#458f48'
  ctx.fillRect(1, 0, 1, 1)
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.wrapS = THREE.RepeatWrapping
  texture.repeat.set(30, 1)
  texture.colorSpace = THREE.SRGBColorSpace

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(5000, 4000),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.set(race.width / 2, 0, race.height / 2)
  ground.receiveShadow = true
  scene.add(ground)
}

/** Her noktada pistin sağ tarafını gösteren birim vektör (2D, sunucu koordinatı). */
function normals(points: [number, number][]): [number, number][] {
  const n = points.length
  return points.map((_, i) => {
    const [px, py] = points[(i - 1 + n) % n]
    const [nx, ny] = points[(i + 1) % n]
    const dx = nx - px
    const dy = ny - py
    const len = Math.hypot(dx, dy) || 1
    return [-dy / len, dx / len]
  })
}

/**
 * Orta çizgiye paralel bir şerit: normal yönünde [from, to] aralığı.
 * {@code color} her segment için renk döner; null dönerse o segment çizilmez.
 */
function ribbon(
  points: [number, number][],
  from: number,
  to: number,
  y: number,
  color: (segment: number) => number | null,
) {
  const norms = normals(points)
  const positions: number[] = []
  const colors: number[] = []
  const c = new THREE.Color()
  const n = points.length
  for (let i = 0; i < n; i++) {
    const hex = color(i)
    if (hex === null) continue
    const j = (i + 1) % n
    const at = (k: number, d: number): [number, number, number] => [
      points[k][0] + norms[k][0] * d,
      y,
      points[k][1] + norms[k][1] * d,
    ]
    const a = at(i, from)
    const b = at(i, to)
    const cc = at(j, to)
    const d = at(j, from)
    // Saat yönünün tersi (yukarıdan bakınca) → yüzey normali +y
    positions.push(...a, ...b, ...cc, ...a, ...cc, ...d)
    c.setHex(hex, THREE.SRGBColorSpace)
    for (let v = 0; v < 6; v++) colors.push(c.r, c.g, c.b)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }),
  )
  mesh.receiveShadow = true
  return mesh
}

function addTrack(scene: THREE.Scene, race: RaceInit) {
  const half = race.trackWidth / 2
  const pts = race.points
  scene.add(ribbon(pts, -half, half, 0.5, () => ASPHALT))
  const curb = (i: number) => (i % 2 === 0 ? 0xe03a3a : 0xf4f4f4)
  scene.add(ribbon(pts, half, half + CURB_WIDTH, 0.8, curb))
  scene.add(ribbon(pts, -half - CURB_WIDTH, -half, 0.8, curb))
  scene.add(ribbon(pts, -2, 2, 0.9, (i) => (i % 2 === 0 ? 0xdddddd : null)))
}

function addStartLine(scene: THREE.Scene, race: RaceInit) {
  const canvas = document.createElement('canvas')
  const cells = 12
  canvas.width = 2
  canvas.height = cells
  const ctx = canvas.getContext('2d')!
  for (let x = 0; x < 2; x++) {
    for (let y = 0; y < cells; y++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#111111'
      ctx.fillRect(x, y, 1, 1)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace

  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(18, race.trackWidth),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 }),
  )
  line.rotation.x = -Math.PI / 2
  line.receiveShadow = true
  const holder = new THREE.Group()
  const [x0, y0] = race.points[0]
  const [x1, y1] = race.points[1]
  holder.position.set(x0, 1, y0)
  holder.rotation.y = -Math.atan2(y1 - y0, x1 - x0)
  holder.add(line)
  scene.add(holder)

  // Başlangıç çizgisi üzerinde kemer
  const archMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.6 })
  const half = race.trackWidth / 2 + CURB_WIDTH + 8
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(6, 70, 6), archMat)
    post.position.set(0, 35, side * half)
    post.castShadow = true
    holder.add(post)
  }
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(14, 14, half * 2 + 6),
    new THREE.MeshStandardMaterial({ color: 0x1f2130, roughness: 0.5 }),
  )
  banner.position.set(0, 70, 0)
  banner.castShadow = true
  holder.add(banner)

  return new StartLights(holder)
}

const LIGHT_COUNT = 5
const RED = new THREE.Color(0xff2a2a)
const GREEN = new THREE.Color(0x3dff6a)
const OFF = new THREE.Color(0x000000)

/** F1 tarzı: geri sayımda kırmızılar tek tek yanar, start anında hepsi yeşil olur. */
class StartLights {
  private readonly materials: THREE.MeshStandardMaterial[] = []

  constructor(holder: THREE.Group) {
    const geometry = new THREE.SphereGeometry(5.5, 12, 8)
    for (let i = 0; i < LIGHT_COUNT; i++) {
      const material = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: OFF, emissiveIntensity: 3 })
      const light = new THREE.Mesh(geometry, material)
      light.position.set(0, 80, (i - (LIGHT_COUNT - 1) / 2) * 16)
      holder.add(light)
      this.materials.push(material)
    }
  }

  update(snap: RaceSnapshot) {
    let lit = 0
    let color = OFF
    if (snap.phase === 'COUNTDOWN') {
      // 3 saniyelik geri sayımı 5 ışığa böl.
      lit = Math.min(LIGHT_COUNT, Math.floor(((3 - snap.countdown) / 3) * LIGHT_COUNT) + 1)
      color = RED
    } else if (snap.time < 2) {
      lit = LIGHT_COUNT
      color = GREEN
    }
    this.materials.forEach((m, i) => m.emissive.copy(i < lit ? color : OFF))
  }
}

/** Sunucu arabaları dünya sınırında tutuyor; bunu görünür kılan bariyerler. */
function addBarriers(scene: THREE.Scene, race: RaceInit) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xf1f1f1, roughness: 0.6 })
  const stripe = new THREE.MeshStandardMaterial({ color: 0xe03a3a, roughness: 0.6 })
  const t = 8
  const h = 14
  const walls: [number, number, number, number][] = [
    [race.width / 2, -t / 2, race.width + t * 2, t],
    [race.width / 2, race.height + t / 2, race.width + t * 2, t],
    [-t / 2, race.height / 2, t, race.height],
    [race.width + t / 2, race.height / 2, t, race.height],
  ]
  for (const [x, z, w, d] of walls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    wall.position.set(x, h / 2, z)
    wall.castShadow = true
    wall.receiveShadow = true
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 3, d + 0.2), stripe)
    top.position.y = h / 2 - 1.5
    wall.add(top)
    scene.add(wall)
  }
}

/** Başlangıç düzlüğünün dışına, seyircili basit bir tribün. */
function addGrandstand(scene: THREE.Scene, race: RaceInit) {
  const [x0, y0] = race.points[0]
  const [x1, y1] = race.points[1]
  const heading = Math.atan2(y1 - y0, x1 - x0)
  // Pistin sol tarafı (sunucu koordinatında normalin tersi)
  const side = -1
  const offset = race.trackWidth / 2 + CURB_WIDTH + 70
  const nx = -Math.sin(heading) * side
  const ny = Math.cos(heading) * side
  const cx = x0 + nx * offset + Math.cos(heading) * 120
  const cy = y0 + ny * offset + Math.sin(heading) * 120

  const group = new THREE.Group()
  group.position.set(cx, 0, cy)
  group.rotation.y = -heading
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb8bcc8, roughness: 0.9 })
  const rows = 4
  const length = 260
  for (let r = 0; r < rows; r++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(length, 8 + r * 10, 16), concrete)
    step.position.set(0, (8 + r * 10) / 2, -r * 16 * -side)
    step.castShadow = true
    step.receiveShadow = true
    group.add(step)
  }

  const random = seededRandom(7)
  const crowd = new THREE.InstancedMesh(
    new THREE.BoxGeometry(6, 9, 6),
    new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    rows * 26,
  )
  const m = new THREE.Matrix4()
  const color = new THREE.Color()
  let i = 0
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < 26; k++) {
      m.makeTranslation(-length / 2 + 8 + k * 9.6 + random() * 3, 8 + r * 10 + 4.5, -r * 16 * -side)
      crowd.setMatrixAt(i, m)
      crowd.setColorAt(i, color.setHSL(random(), 0.7, 0.55))
      i++
    }
  }
  crowd.castShadow = true
  group.add(crowd)

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(length + 20, 4, rows * 16 + 20),
    new THREE.MeshStandardMaterial({ color: 0xff5a8a, roughness: 0.6 }),
  )
  roof.position.set(0, 62, -(rows - 1) * 8 * -side)
  roof.castShadow = true
  group.add(roof)
  scene.add(group)
}
