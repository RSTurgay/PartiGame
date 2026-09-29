import * as THREE from 'three'
import type { GameClient } from '../../net/GameClient'
import { TEAM_COLORS } from '../../net/protocol'
import type { GameStart } from '../registry'
import { CarModel, WHEEL_RADIUS } from './car'
import { DustEffect, SparkEffect } from './effects'
import { Hud } from './hud'
import { KeyboardInput } from './input'
import { ItemVisuals } from './items'
import { SkidMarks } from './skids'
import type { CarState, ItemEvent, RaceInit, RaceSnapshot } from './types'
import { buildWorld, type World } from './world'

const INPUT_RESEND_MS = 200
/** Sunucu durumuna yaklaşma hızı; büyüdükçe keskin, küçüldükçe yumuşak. */
const SMOOTHING = 18
const CAMERA_SMOOTHING = 4
/** Takip kamerasının arabaya göre konumu: yukarıda ve biraz güneyde, yüksek açı. */
const FOLLOW_OFFSET = new THREE.Vector3(0, 360, 270)
const MAX_SPEED = 340
/** Bu yavaşlamanın (birim/sn²) üstünde stop lambaları yanar. */
const BRAKE_DECELERATION = 250
/** Çimdeyken saniyede çıkan toz parçası (tam hızda). */
const DUST_PER_SECOND = 40
/** Drift'te her arka tekerlekten saniyede çıkan kıvılcım. */
const SPARKS_PER_SECOND = 45
/** Bu yana kayma hızının üstünde asfaltta iz kalır. */
const SKID_SLIP = 85
/** İki lastik izi arasındaki mesafe. */
const SKID_SPACING = 5
const FOV_NORMAL = 50
const FOV_BOOST = 64
/** Arka tekerleklerin araba merkezine göre yeri (yerel x geri, z yan). */
const REAR_WHEELS: [number, number][] = [
  [-13, 12],
  [-13, -12],
]

interface CarView {
  model: CarModel
  x: number
  z: number
  a: number
  placed: boolean
  spin: number
  roll: number
  pitch: number
  steer: number
  lastSpeed: number
  braking: boolean
  dustDebt: number
  sparkDebt: number
  /** Son lastik izinin bırakıldığı yer; iz aralığını sabit tutmak için. */
  lastSkidX: number
  lastSkidZ: number
}

type CameraMode = 'follow' | 'overview'

export class PistKaosu3D {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true })
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(50, 16 / 9, 10, 6000)
  private readonly cameraFocus = new THREE.Vector3()
  private readonly cars = new Map<string, CarView>()
  private readonly input = new KeyboardInput()
  private readonly hud: Hud
  private readonly resizeObserver: ResizeObserver
  private readonly unsubscribe: () => void
  private readonly race: RaceInit
  private readonly world: World
  private readonly dust: DustEffect
  private readonly sparks: SparkEffect
  private readonly skids: SkidMarks
  private readonly items: ItemVisuals

  private snapshot: RaceSnapshot | null = null
  private cameraMode: CameraMode = 'follow'
  private frame = 0
  private lastFrame = performance.now()
  private lastInput = ''
  private lastInputSent = 0
  private readonly parent: HTMLElement
  private readonly client: GameClient
  private readonly myId: string

  constructor(parent: HTMLElement, client: GameClient, start: GameStart) {
    this.parent = parent
    this.client = client
    this.myId = start.myId
    this.race = start.init as RaceInit

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.className = 'pk-canvas'
    parent.appendChild(this.renderer.domElement)

    this.world = buildWorld(this.scene, this.race)
    this.dust = new DustEffect(this.scene)
    this.sparks = new SparkEffect(this.scene)
    this.skids = new SkidMarks(this.scene)
    this.items = new ItemVisuals(this.scene, this.race)
    const teamMode = start.mode === 'TEAMS'
    for (const p of this.race.players) {
      const labelColor = teamMode && p.team > 0 ? TEAM_COLORS[p.team] : '#ffffff'
      const model = new CarModel(p.color, p.name, labelColor, p.id === this.myId)
      model.addTo(this.scene)
      model.setVisible(false)
      this.cars.set(p.id, {
        model, x: 0, z: 0, a: 0, placed: false, spin: 0, roll: 0, pitch: 0,
        steer: 0, lastSpeed: 0, braking: false, dustDebt: 0, sparkDebt: 0, lastSkidX: 0, lastSkidZ: 0,
      })
    }

    this.hud = new Hud(parent, this.race, this.myId)
    this.input.onPress('KeyC', () => {
      this.cameraMode = this.cameraMode === 'follow' ? 'overview' : 'follow'
    })

    this.unsubscribe = client.on('state', (msg) => {
      this.snapshot = msg.state as RaceSnapshot
      // Olaylar snapshot başına bir kez işlenir; çizim döngüsü aynı snapshot'ı birkaç kez kullanabilir.
      this.handleEvents(this.snapshot.events)
    })

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(parent)
    this.resize()
    this.placeCamera(1)
    this.frame = requestAnimationFrame(this.loop)
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.unsubscribe()
    this.resizeObserver.disconnect()
    this.input.dispose()
    this.hud.dispose()
    this.cars.forEach((c) => c.model.dispose())
    this.dust.dispose()
    this.sparks.dispose()
    this.skids.dispose()
    this.items.dispose()
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
        materials.forEach((m: THREE.Material & { map?: THREE.Texture | null }) => {
          m.map?.dispose()
          m.dispose()
        })
      }
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private loop = (now: number) => {
    this.frame = requestAnimationFrame(this.loop)
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1)
    this.lastFrame = now

    this.sendInput(now)
    if (this.snapshot) {
      this.updateCars(this.snapshot, dt)
      this.hud.update(this.snapshot)
    }
    this.dust.update(dt)
    this.sparks.update(dt)
    this.items.update(now / 1000, dt, this.snapshot, (id) => this.carPosition(id))
    this.world.update(now / 1000, this.snapshot)
    this.placeCamera(1 - Math.exp(-CAMERA_SMOOTHING * dt))
    this.renderer.render(this.scene, this.camera)
  }

  private sendInput(now: number) {
    const input = this.input.drive()
    const key = JSON.stringify(input)
    // Değişince hemen, değişmese de ara ara gönder (kaybolan mesajlara karşı).
    if (key !== this.lastInput || now - this.lastInputSent > INPUT_RESEND_MS) {
      this.client.send({ type: 'input', input: { ...input } })
      this.lastInput = key
      this.lastInputSent = now
    }
  }

  private updateCars(snap: RaceSnapshot, dt: number) {
    const blend = 1 - Math.exp(-SMOOTHING * dt)
    const seen = new Set<string>()
    for (const s of snap.cars) {
      const car = this.cars.get(s.id)
      if (!car) continue
      seen.add(s.id)
      if (!car.placed) {
        Object.assign(car, { x: s.x, z: s.y, a: s.a, placed: true })
      }
      const prevA = car.a
      car.x += (s.x - car.x) * blend
      car.z += (s.y - car.z) * blend
      car.a += wrapAngle(s.a - car.a) * blend

      // Görsel süsler: tekerlek dönüşü, direksiyon, virajda yatma, gaz/frende eğilme.
      car.spin -= (s.speed * dt) / WHEEL_RADIUS
      car.steer += (s.steer - car.steer) * Math.min(1, dt * 10)
      const turnRate = dt > 0 ? wrapAngle(car.a - prevA) / dt : 0
      const targetRoll = clamp(turnRate * (s.speed / MAX_SPEED) * 0.08, 0.1)
      // Sunucu durumu ~30 Hz gelir; ivmeyi sadece hız değişince ölç.
      if (s.speed !== car.lastSpeed) {
        const accel = (s.speed - car.lastSpeed) * 30
        // Turbo bitince azami hıza inerken yanmasın.
        car.braking = s.speed > 5 && s.speed < MAX_SPEED && accel < -BRAKE_DECELERATION
        car.pitch += (clamp(accel * 0.00012, 0.05) - car.pitch) * 0.3
        car.lastSpeed = s.speed
      }
      car.pitch *= 1 - Math.min(1, dt * 3)
      car.roll += (targetRoll - car.roll) * Math.min(1, dt * 8)

      if (!s.onTrack && Math.abs(s.speed) > 30) {
        car.dustDebt += DUST_PER_SECOND * (Math.abs(s.speed) / MAX_SPEED) * dt
        for (; car.dustDebt >= 1; car.dustDebt--) {
          this.dust.emit(car.x - Math.cos(car.a) * 18, car.z - Math.sin(car.a) * 18, car.a, s.speed)
        }
      }

      this.emitDriftEffects(car, s, dt)

      car.model.update({
        x: car.x, z: car.z, angle: car.a, wheelSpin: car.spin, steer: car.steer,
        roll: car.roll, pitch: car.pitch, braking: car.braking, boost: s.boost,
        shield: s.shield, frozen: s.frozen, time: performance.now() / 1000,
      })
      car.model.setVisible(true)
    }
    // Oyundan çıkanları gizle.
    for (const [id, car] of this.cars) {
      if (!seen.has(id)) car.model.setVisible(false)
    }
  }

  private handleEvents(events: ItemEvent[]) {
    this.hud.onEvents(events)
    for (const e of events) {
      const from = this.carPosition(e.playerId)
      if (e.type === 'use' && e.item === 'ICE' && e.other && from) {
        this.items.launchIce(from, e.other)
      }
    }
  }

  private carPosition(id: string): THREE.Vector3 | null {
    const car = this.cars.get(id)
    return car?.placed ? new THREE.Vector3(car.x, 10, car.z) : null
  }

  /** Drift'te kıvılcım; drift, sert kayma ve frende asfaltta lastik izi. */
  private emitDriftEffects(car: CarView, s: CarState, dt: number) {
    const wheels = REAR_WHEELS.map(([lx, lz]) => localToWorld(car.x, car.z, car.a, lx, lz))

    if (s.drift > 0) {
      car.sparkDebt += SPARKS_PER_SECOND * dt
      for (; car.sparkDebt >= 1; car.sparkDebt--) {
        for (const [wx, wz] of wheels) this.sparks.emit(wx, wz, car.a, s.drift - 1)
      }
    }

    const skidding = s.onTrack && (s.drift > 0 || Math.abs(s.slip) > SKID_SLIP || (car.braking && s.speed > 150))
    if (!skidding) {
      car.lastSkidX = car.x
      car.lastSkidZ = car.z
      return
    }
    // Son izden bu yana gidilen yolu eşit aralıklı izlerle doldur; kare hızı düşükse de iz kesintisiz olur.
    const dx = car.x - car.lastSkidX
    const dz = car.z - car.lastSkidZ
    const steps = Math.floor(Math.hypot(dx, dz) / SKID_SPACING)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const px = car.lastSkidX + dx * t
      const pz = car.lastSkidZ + dz * t
      for (const [lx, lz] of REAR_WHEELS) {
        const [wx, wz] = localToWorld(px, pz, car.a, lx, lz)
        this.skids.add(wx, wz, car.a)
      }
    }
    if (steps > 0) {
      car.lastSkidX = car.x
      car.lastSkidZ = car.z
    }
  }

  /** @param blend 0-1 arası; 1 kamerayı doğrudan hedefe koyar. */
  private placeCamera(blend: number) {
    const target = new THREE.Vector3()
    const desired = new THREE.Vector3()
    const me = this.cars.get(this.myId)
    const mine = this.snapshot?.cars.find((c) => c.id === this.myId)

    if (this.cameraMode === 'follow' && me?.placed) {
      // Gidiş yönüne biraz önden bak; hızlandıkça daha önden.
      const lead = 90 * ((mine?.speed ?? 0) / MAX_SPEED)
      target.set(me.x + Math.cos(me.a) * lead, 0, me.z + Math.sin(me.a) * lead)
      desired.copy(target).add(FOLLOW_OFFSET)
    } else {
      target.set(this.race.width / 2, 0, this.race.height / 2)
      desired.set(this.race.width / 2, 1250, this.race.height / 2 + 800)
    }
    this.cameraFocus.lerp(target, blend)
    this.camera.position.lerp(desired, blend)
    if (mine?.boost && this.cameraMode === 'follow') {
      // Turboda hafif sarsıntı; yumuşatmadan sonra eklenir ki sönmesin.
      this.camera.position.x += (Math.random() - 0.5) * 3
      this.camera.position.y += (Math.random() - 0.5) * 3
    }
    this.camera.lookAt(this.cameraFocus)

    // Turboda görüş açısı genişler: hız hissi.
    const fov = mine?.boost && this.cameraMode === 'follow' ? FOV_BOOST : FOV_NORMAL
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, blend * 1.5)
      this.camera.updateProjectionMatrix()
    }
  }

  private resize() {
    const w = this.parent.clientWidth
    const h = this.parent.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }
}

/** (x, z)'de {@code angle} yönüne bakan arabanın yerel (lx, lz) noktasının dünya konumu. Yerel +x ileri, +z sağ. */
function localToWorld(x: number, z: number, angle: number, lx: number, lz: number): [number, number] {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [x + c * lx - s * lz, z + s * lx + c * lz]
}

function wrapAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

function clamp(v: number, limit: number) {
  return Math.max(-limit, Math.min(limit, v))
}
