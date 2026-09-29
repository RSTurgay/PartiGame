import * as THREE from 'three'
import type { RaceInit } from './types'

/** Tekrarlanabilir rastgelelik: herkes aynı ağaçları aynı yerde görür. */
export function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function distanceToTrack(points: [number, number][], x: number, y: number) {
  let best = Infinity
  for (const [px, py] of points) best = Math.min(best, Math.hypot(px - x, py - y))
  return best
}

interface Spot {
  x: number
  y: number
  scale: number
  rotation: number
}

/** Ağaç, çalı ve kayalar. {@link update} rüzgâr animasyonunu ilerletir. */
export class Nature {
  private readonly time = { value: 0 }

  constructor(scene: THREE.Scene, race: RaceInit, curbWidth: number) {
    const random = seededRandom(42)
    const edge = race.trackWidth / 2 + curbWidth
    const taken: Spot[] = []
    const pick = (count: number, clearance: number, spacing: number, allowOutside: boolean) =>
      scatter(race, random, taken, count, edge + clearance, spacing, allowOutside)

    const pines = pick(60, 45, 40, true)
    const roundTrees = pick(45, 45, 40, true)
    const bushes = pick(45, 16, 22, false)
    const rocks = pick(25, 20, 25, false)

    this.addPines(scene, pines, random)
    this.addRoundTrees(scene, roundTrees, random)
    this.addBushes(scene, bushes, random)
    addRocks(scene, rocks, random)
  }

  update(time: number) {
    this.time.value = time
  }

  private addPines(scene: THREE.Scene, spots: Spot[], random: () => number) {
    addInstanced(scene, spots, new THREE.CylinderGeometry(2.5, 3.5, 14, 6), bark(), 7)
    const lower = swayMaterial(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), this.time, 26, 0.012)
    const upper = swayMaterial(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), this.time, 44, 0.02)
    const color = new THREE.Color()
    addInstanced(scene, spots, new THREE.ConeGeometry(17, 30, 7), lower, 26, () =>
      color.setHSL(0.33 + random() * 0.04, 0.55, 0.22 + random() * 0.06),
    )
    addInstanced(scene, spots, new THREE.ConeGeometry(11, 24, 7), upper, 44, (i) =>
      color.setHSL(0.33 + (i % 5) * 0.008, 0.5, 0.27 + (i % 3) * 0.03),
    )
  }

  private addRoundTrees(scene: THREE.Scene, spots: Spot[], random: () => number) {
    addInstanced(scene, spots, new THREE.CylinderGeometry(2.5, 3.5, 22, 6), bark(), 11)
    const crown = swayMaterial(new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), this.time, 34, 0.018)
    const color = new THREE.Color()
    addInstanced(scene, spots, new THREE.IcosahedronGeometry(16, 0), crown, 34, () =>
      // Arada bir sonbahar renginde ağaç
      random() < 0.15
        ? color.setHSL(0.07 + random() * 0.05, 0.75, 0.5)
        : color.setHSL(0.22 + random() * 0.08, 0.55, 0.36 + random() * 0.08),
    )
  }

  private addBushes(scene: THREE.Scene, spots: Spot[], random: () => number) {
    const material = swayMaterial(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), this.time, 5, 0.12)
    const color = new THREE.Color()
    addInstanced(scene, spots, new THREE.IcosahedronGeometry(8, 0), material, 5, () =>
      random() < 0.2
        ? color.setHSL(0.9 + random() * 0.08, 0.6, 0.6) // çiçekli çalı
        : color.setHSL(0.27 + random() * 0.06, 0.5, 0.33),
    )
  }
}

function scatter(
  race: RaceInit,
  random: () => number,
  taken: Spot[],
  count: number,
  clearance: number,
  spacing: number,
  allowOutside: boolean,
): Spot[] {
  const spots: Spot[] = []
  for (let tries = 0; tries < count * 40 && spots.length < count; tries++) {
    const margin = allowOutside ? 350 : -20
    const x = -margin + random() * (race.width + margin * 2)
    const y = -margin + random() * (race.height + margin * 2)
    const inside = x > 20 && x < race.width - 20 && y > 20 && y < race.height - 20
    const nearWall = !inside && x > -30 && x < race.width + 30 && y > -30 && y < race.height + 30
    if (nearWall || distanceToTrack(race.points, x, y) < clearance) continue
    if (taken.some((s) => Math.hypot(s.x - x, s.y - y) < spacing)) continue
    const spot = { x, y, scale: 0.7 + random() * 0.7, rotation: random() * Math.PI * 2 }
    spots.push(spot)
    taken.push(spot)
  }
  return spots
}

function bark() {
  return new THREE.MeshStandardMaterial({ color: 0x7a4f2c, roughness: 1 })
}

/** Her spot için bir kopya; {@code height} parçanın ölçeklenmemiş yerden yüksekliği. */
function addInstanced(
  scene: THREE.Scene,
  spots: Spot[],
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  height: number,
  color?: (i: number) => THREE.Color,
) {
  const mesh = new THREE.InstancedMesh(geometry, material, spots.length)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  spots.forEach((s, i) => {
    q.setFromAxisAngle(up, s.rotation)
    m.compose(new THREE.Vector3(s.x, height * s.scale, s.y), q, new THREE.Vector3(s.scale, s.scale, s.scale))
    mesh.setMatrixAt(i, m)
    if (color) mesh.setColorAt(i, color(i))
  })
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
  return mesh
}

function addRocks(scene: THREE.Scene, spots: Spot[], random: () => number) {
  const mesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(7, 0),
    new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
    spots.length,
  )
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const color = new THREE.Color()
  spots.forEach((s, i) => {
    q.setFromEuler(new THREE.Euler(random() * 3, s.rotation, random() * 3))
    const sx = s.scale * (0.8 + random() * 0.8)
    m.compose(new THREE.Vector3(s.x, 2, s.y), q, new THREE.Vector3(sx, s.scale * 0.6, s.scale))
    mesh.setMatrixAt(i, m)
    mesh.setColorAt(i, color.setHSL(0.08, 0.05, 0.45 + random() * 0.15))
  })
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
}

/**
 * Rüzgârda sallanma: vertex shader'da noktayı yüksekliğiyle orantılı kaydırır.
 * Her ağaç konumuna göre farklı fazda sallanır, böylece hepsi aynı anda eğilmez.
 * @param baseHeight parçanın merkezinin yerden yüksekliği; kök hiç kıpırdamaz
 */
function swayMaterial(
  material: THREE.MeshStandardMaterial,
  time: { value: number },
  baseHeight: number,
  strength: number,
) {
  // Ayarlar uniform olarak verilir: shader kodu tüm malzemelerde aynı kalır, böylece
  // Three.js'in program önbelleği farklı ayarlı malzemeleri birbirine karıştırmaz.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time
    shader.uniforms.uBaseHeight = { value: baseHeight }
    shader.uniforms.uStrength = { value: strength }
    const header = 'uniform float uTime;\nuniform float uBaseHeight;\nuniform float uStrength;\n'
    shader.vertexShader = (header + shader.vertexShader).replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec3 treeBase = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float bend = max(position.y + uBaseHeight, 0.0);
      bend = bend * bend * uStrength * 0.05;
      float phase = treeBase.x * 0.031 + treeBase.z * 0.017;
      transformed.x += (sin(uTime * 1.6 + phase) + 0.4 * sin(uTime * 3.7 + phase * 2.0)) * bend;
      transformed.z += cos(uTime * 1.2 + phase) * bend * 0.5;`,
    )
  }
  return material
}
