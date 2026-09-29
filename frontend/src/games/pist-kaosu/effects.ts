import * as THREE from 'three'

const POOL_SIZE = 160
const LIFETIME = 0.9

interface Particle {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>
  age: number
  vx: number
  vy: number
  vz: number
  size: number
}

/** Çime çıkan arabaların arkasından kalkan toz. Sabit havuz; yeni nesne üretmez. */
export class DustEffect {
  private readonly geometry = new THREE.IcosahedronGeometry(1, 0)
  private readonly particles: Particle[] = []
  private next = 0

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(
        this.geometry,
        new THREE.MeshLambertMaterial({ color: 0xc9b48a, transparent: true, depthWrite: false }),
      )
      mesh.visible = false
      scene.add(mesh)
      this.particles.push({ mesh, age: LIFETIME, vx: 0, vy: 0, vz: 0, size: 1 })
    }
  }

  /** (x, z) noktasından, {@code angle} yönünün tersine doğru bir toz parçası çıkarır. */
  emit(x: number, z: number, angle: number, speed: number) {
    const p = this.particles[this.next]
    this.next = (this.next + 1) % POOL_SIZE
    const back = -0.25 * speed
    p.age = 0
    p.size = 4 + Math.random() * 4
    p.vx = Math.cos(angle) * back + (Math.random() - 0.5) * 30
    p.vz = Math.sin(angle) * back + (Math.random() - 0.5) * 30
    p.vy = 12 + Math.random() * 14
    p.mesh.position.set(x + (Math.random() - 0.5) * 10, 3, z + (Math.random() - 0.5) * 10)
    p.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0)
    p.mesh.visible = true
  }

  update(dt: number) {
    for (const p of this.particles) {
      if (p.age >= LIFETIME) continue
      p.age += dt
      const t = p.age / LIFETIME
      if (t >= 1) {
        p.mesh.visible = false
        continue
      }
      p.mesh.position.x += p.vx * dt
      p.mesh.position.y += p.vy * dt
      p.mesh.position.z += p.vz * dt
      p.vx *= 1 - 2 * dt
      p.vz *= 1 - 2 * dt
      p.mesh.scale.setScalar(p.size * (0.6 + t * 1.6))
      p.mesh.material.opacity = 0.7 * (1 - t)
    }
  }

  dispose() {
    this.geometry.dispose()
    for (const p of this.particles) {
      p.mesh.material.dispose()
      p.mesh.removeFromParent()
    }
  }
}
