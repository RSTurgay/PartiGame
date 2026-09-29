import * as THREE from 'three'

const MAX_MARKS = 1400
const MARK_LENGTH = 7
const MARK_WIDTH = 4

/**
 * Asfalttaki lastik izleri. Tek bir InstancedMesh; en eski iz yenisiyle değiştirilir,
 * böylece izler yarış boyunca birikir ama bellek sabit kalır.
 */
export class SkidMarks {
  private readonly mesh: THREE.InstancedMesh
  private readonly matrix = new THREE.Matrix4()
  private readonly position = new THREE.Vector3()
  private readonly rotation = new THREE.Quaternion()
  private readonly scale = new THREE.Vector3(1, 1, 1)
  private readonly up = new THREE.Vector3(0, 1, 0)
  private next = 0
  private total = 0

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.PlaneGeometry(MARK_LENGTH, MARK_WIDTH)
    geometry.rotateX(-Math.PI / 2)
    const material = new THREE.MeshBasicMaterial({
      color: 0x111114,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
    this.mesh = new THREE.InstancedMesh(geometry, material, MAX_MARKS)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 1
    scene.add(this.mesh)
  }

  /** (x, z) noktasına, {@code angle} yönüne hizalı bir iz bırakır. */
  add(x: number, z: number, angle: number) {
    this.position.set(x, 1.0, z)
    this.rotation.setFromAxisAngle(this.up, -angle)
    this.matrix.compose(this.position, this.rotation, this.scale)
    this.mesh.setMatrixAt(this.next, this.matrix)
    this.next = (this.next + 1) % MAX_MARKS
    this.total++
    this.mesh.count = Math.min(this.total, MAX_MARKS)
    this.mesh.instanceMatrix.needsUpdate = true
  }

  dispose() {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
    this.mesh.removeFromParent()
  }
}
