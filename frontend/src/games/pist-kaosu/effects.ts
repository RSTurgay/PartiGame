import * as THREE from 'three'

interface ParticleOptions {
  count: number
  lifetime: number
  geometry: THREE.BufferGeometry
  material: () => THREE.MeshBasicMaterial | THREE.MeshLambertMaterial
  /** Yatay hızın saniyedeki sönme oranı. */
  drag: number
  /** Dikey ivme (negatif: düşer). */
  gravity: number
  /** Ömür boyunca boyut çarpanı: başta {@code from}, sonda {@code to}. */
  scale: { from: number; to: number }
  opacity: number
}

interface Particle {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial | THREE.MeshLambertMaterial>
  age: number
  vx: number
  vy: number
  vz: number
  size: number
}

/** Sabit havuzlu basit parçacık sistemi; çalışırken yeni nesne üretmez. */
class Particles {
  private readonly particles: Particle[] = []
  private readonly options: ParticleOptions
  private next = 0

  constructor(scene: THREE.Scene, options: ParticleOptions) {
    this.options = options
    for (let i = 0; i < options.count; i++) {
      const mesh = new THREE.Mesh(options.geometry, options.material())
      mesh.visible = false
      scene.add(mesh)
      this.particles.push({ mesh, age: options.lifetime, vx: 0, vy: 0, vz: 0, size: 1 })
    }
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, color?: number) {
    const p = this.particles[this.next]
    this.next = (this.next + 1) % this.particles.length
    Object.assign(p, { age: 0, vx, vy, vz, size })
    p.mesh.position.set(x, y, z)
    p.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0)
    if (color !== undefined) p.mesh.material.color.setHex(color)
    p.mesh.visible = true
  }

  update(dt: number) {
    const { lifetime, drag, gravity, scale, opacity } = this.options
    for (const p of this.particles) {
      if (p.age >= lifetime) continue
      p.age += dt
      const t = p.age / lifetime
      if (t >= 1) {
        p.mesh.visible = false
        continue
      }
      p.vy += gravity * dt
      p.mesh.position.x += p.vx * dt
      p.mesh.position.y = Math.max(0.5, p.mesh.position.y + p.vy * dt)
      p.mesh.position.z += p.vz * dt
      p.vx *= Math.max(0, 1 - drag * dt)
      p.vz *= Math.max(0, 1 - drag * dt)
      p.mesh.scale.setScalar(p.size * (scale.from + (scale.to - scale.from) * t))
      p.mesh.material.opacity = opacity * (1 - t)
    }
  }

  dispose() {
    this.options.geometry.dispose()
    for (const p of this.particles) {
      p.mesh.material.dispose()
      p.mesh.removeFromParent()
    }
  }
}

/** Çime çıkan arabaların arkasından kalkan toz. */
export class DustEffect {
  private readonly particles: Particles

  constructor(scene: THREE.Scene) {
    this.particles = new Particles(scene, {
      count: 160,
      lifetime: 0.9,
      geometry: new THREE.IcosahedronGeometry(1, 0),
      material: () => new THREE.MeshLambertMaterial({ color: 0xc9b48a, transparent: true, depthWrite: false }),
      drag: 2,
      gravity: 0,
      scale: { from: 0.6, to: 2.2 },
      opacity: 0.7,
    })
  }

  /** (x, z) noktasından, {@code angle} yönünün tersine doğru bir toz parçası çıkarır. */
  emit(x: number, z: number, angle: number, speed: number) {
    const back = -0.25 * speed
    this.particles.emit(
      x + (Math.random() - 0.5) * 10,
      3,
      z + (Math.random() - 0.5) * 10,
      Math.cos(angle) * back + (Math.random() - 0.5) * 30,
      12 + Math.random() * 14,
      Math.sin(angle) * back + (Math.random() - 0.5) * 30,
      4 + Math.random() * 4,
    )
  }

  update(dt: number) {
    this.particles.update(dt)
  }

  dispose() {
    this.particles.dispose()
  }
}

/** Drift şarj seviyesine göre kıvılcım rengi: şarjsız, mavi, turuncu. */
const SPARK_COLORS = [0xfff6c2, 0x4db8ff, 0xff9a2e]

/** Drift yapan arabanın arka tekerleklerinden saçılan kıvılcımlar. */
export class SparkEffect {
  private readonly particles: Particles

  constructor(scene: THREE.Scene) {
    this.particles = new Particles(scene, {
      count: 220,
      lifetime: 0.35,
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: () =>
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      drag: 4,
      gravity: -260,
      scale: { from: 1, to: 0.3 },
      opacity: 1,
    })
  }

  /** @param level 0 şarjsız, 1 mavi, 2 turuncu */
  emit(x: number, z: number, angle: number, level: number) {
    const spread = (Math.random() - 0.5) * 1.6
    const speed = 60 + Math.random() * 80
    const color = SPARK_COLORS[Math.min(level, SPARK_COLORS.length - 1)]
    this.particles.emit(
      x,
      2,
      z,
      -Math.cos(angle + spread) * speed,
      40 + Math.random() * 60,
      -Math.sin(angle + spread) * speed,
      2.5 + level * 1.2 + Math.random() * 1.5,
      color,
    )
  }

  update(dt: number) {
    this.particles.update(dt)
  }

  dispose() {
    this.particles.dispose()
  }
}
