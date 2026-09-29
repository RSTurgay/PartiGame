import * as THREE from 'three'

export const WHEEL_RADIUS = 5
/** Ön tekerleklerin tam direksiyonda döndüğü açı (radyan). */
const MAX_STEER_ANGLE = 0.5

export interface CarPose {
  x: number
  z: number
  angle: number
  /** Tekerleklerin kendi ekseni etrafındaki dönüşü. */
  wheelSpin: number
  /** -1..1, yumuşatılmış direksiyon. */
  steer: number
  /** Viraj yatması ve gaz/fren eğilmesi (radyan). */
  roll: number
  pitch: number
  braking: boolean
  boost: boolean
  shield: boolean
  frozen: boolean
  /** Saniye; kalkanın nabız animasyonu için. */
  time: number
}

/** Low-poly araba. Yerel +x ileri yöndür; {@link CarModel.root} sunucu açısıyla döndürülür. */
export class CarModel {
  readonly root = new THREE.Group()
  private readonly body = new THREE.Group()
  private readonly wheels: THREE.Object3D[] = []
  private readonly steerPivots: THREE.Group[] = []
  private readonly brakeLight: THREE.MeshStandardMaterial
  private readonly brakeGlow: THREE.Mesh
  private readonly flames: THREE.Group[] = []
  private readonly shieldBubble: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  private readonly iceBlock: THREE.Mesh
  private readonly label: THREE.Sprite
  private readonly disposables: { dispose(): void }[] = []

  constructor(color: string, name: string, labelColor: string, isMe: boolean) {
    const paint = this.track(new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2 }))
    const dark = this.track(new THREE.MeshStandardMaterial({ color: 0x1d2433, roughness: 0.3, metalness: 0.4 }))
    const trim = this.track(new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7 }))
    const light = this.track(
      new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xffe680, emissiveIntensity: 0.8 }),
    )
    this.brakeLight = this.track(
      new THREE.MeshStandardMaterial({ color: 0x7a1010, emissive: 0xff2020, emissiveIntensity: 0 }),
    )

    this.addBox(this.body, [40, 8, 22], [0, 9, 0], paint) // gövde
    this.addBox(this.body, [12, 3, 20], [13, 13.5, 0], paint) // kaput
    this.addBox(this.body, [18, 7, 18], [-3, 16.5, 0], dark) // kabin
    this.addBox(this.body, [6, 2, 24], [-19, 17, 0], paint) // spoiler
    this.addBox(this.body, [2, 5, 2], [-19, 14, -8], trim)
    this.addBox(this.body, [2, 5, 2], [-19, 14, 8], trim)
    this.addBox(this.body, [3, 3, 23], [20, 6, 0], trim) // ön tampon
    this.addBox(this.body, [3, 3, 23], [-20, 6, 0], trim) // arka tampon
    this.addBox(this.body, [2, 3, 5], [20.2, 10, -7], light) // farlar
    this.addBox(this.body, [2, 3, 5], [20.2, 10, 7], light)
    this.addBox(this.body, [2.5, 4, 7], [-20.3, 10.5, -6.5], this.brakeLight) // stop lambaları
    this.addBox(this.body, [2.5, 4, 7], [-20.3, 10.5, 6.5], this.brakeLight)
    this.brakeGlow = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(22, 34)),
      this.track(
        new THREE.MeshBasicMaterial({
          color: 0xff2020,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    )
    // Fren yapınca arkadaki asfaltta kırmızı parlama
    this.brakeGlow.rotation.x = -Math.PI / 2
    this.brakeGlow.position.set(-30, 1.5, 0)
    this.brakeGlow.visible = false
    this.body.add(this.brakeGlow)
    this.addBox(this.body, [4, 3, 2], [-2, 16, 10.5], paint) // yan aynalar
    this.addBox(this.body, [4, 3, 2], [-2, 16, -10.5], paint)
    this.root.add(this.body)

    this.addWheels()
    this.addExhaust(trim)

    this.shieldBubble = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(32, 20, 14)),
      this.track(
        new THREE.MeshBasicMaterial({
          color: 0x6fe3ff,
          transparent: true,
          opacity: 0.25,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    )
    this.shieldBubble.position.y = 10
    this.shieldBubble.visible = false
    this.root.add(this.shieldBubble)

    this.iceBlock = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(50, 30, 34)),
      this.track(
        new THREE.MeshStandardMaterial({
          color: 0xcff4ff,
          transparent: true,
          opacity: 0.55,
          roughness: 0.05,
          metalness: 0.1,
          emissive: 0x3aa9d8,
          emissiveIntensity: 0.25,
        }),
      ),
    )
    this.iceBlock.position.y = 14
    this.iceBlock.visible = false
    this.root.add(this.iceBlock)

    if (isMe) {
      const ring = new THREE.Mesh(
        this.track(new THREE.RingGeometry(26, 31, 32)),
        this.track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 1.2
      this.root.add(ring)
    }

    this.label = this.createLabel(isMe ? `${name} (sen)` : name, labelColor)
  }

  /**
   * Her tekerlek: [direksiyon pivotu (sadece ön)] → [tekerlek dönüşü] → lastik + jant.
   * Jant beşgen olduğu için dönüşü gözle görülür.
   */
  private addWheels() {
    const tireGeo = this.track(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 5, 14))
    const rimGeo = this.track(new THREE.CylinderGeometry(WHEEL_RADIUS * 0.6, WHEEL_RADIUS * 0.6, 5.4, 5))
    const hubGeo = this.track(new THREE.BoxGeometry(1.2, 5.8, WHEEL_RADIUS * 1.1))
    const rubber = this.track(new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }))
    const rimMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xc9ced8, roughness: 0.3, metalness: 0.8, flatShading: true }),
    )

    for (const [x, z, front] of [
      [13, 12, true],
      [13, -12, true],
      [-13, 12, false],
      [-13, -12, false],
    ] as const) {
      const spin = new THREE.Group()
      const tire = new THREE.Mesh(tireGeo, rubber)
      const rim = new THREE.Mesh(rimGeo, rimMat)
      const hub = new THREE.Mesh(hubGeo, rimMat)
      tire.castShadow = true
      spin.add(tire, rim, hub)
      // Silindir ekseni (y) aks yönüne (z) yatırılır; dönüş z ekseni etrafında olur.
      const axle = new THREE.Group()
      axle.rotation.x = Math.PI / 2
      axle.add(spin)

      const holder = new THREE.Group()
      holder.position.set(x, WHEEL_RADIUS, z)
      holder.add(axle)
      this.root.add(holder)
      this.wheels.push(spin)
      if (front) this.steerPivots.push(holder)
    }
  }

  /** İki egzoz borusu ve turboda çıkan alevler (dış turuncu, iç sarı koni). */
  private addExhaust(pipeMaterial: THREE.Material) {
    const pipeGeo = this.track(new THREE.CylinderGeometry(1.6, 1.6, 4, 8))
    const outerGeo = this.track(new THREE.ConeGeometry(3.2, 16, 10))
    const innerGeo = this.track(new THREE.ConeGeometry(1.8, 10, 8))
    const flameMaterial = (color: number) =>
      this.track(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
    const outerMat = flameMaterial(0xff7a1a)
    const innerMat = flameMaterial(0xfff0a0)

    for (const z of [-5, 5]) {
      const pipe = new THREE.Mesh(pipeGeo, pipeMaterial)
      pipe.rotation.z = Math.PI / 2
      pipe.position.set(-21, 6, z)
      this.body.add(pipe)

      // Koni ucu +y'dedir; z etrafında +90° döndürünce uç arkaya (-x) bakar.
      const flame = new THREE.Group()
      const outer = new THREE.Mesh(outerGeo, outerMat)
      const inner = new THREE.Mesh(innerGeo, innerMat)
      outer.position.y = 8
      inner.position.y = 5
      flame.add(outer, inner)
      flame.rotation.z = Math.PI / 2
      flame.position.set(-23, 6, z)
      flame.visible = false
      this.body.add(flame)
      this.flames.push(flame)
    }
  }

  /** Etiket arabayla dönmesin diye ayrı eklenir. */
  addTo(scene: THREE.Scene) {
    scene.add(this.root, this.label)
  }

  update(pose: CarPose) {
    this.root.position.set(pose.x, 0, pose.z)
    this.root.rotation.y = -pose.angle
    this.body.rotation.x = pose.roll
    this.body.rotation.z = pose.pitch
    for (const w of this.wheels) w.rotation.y = pose.wheelSpin
    for (const p of this.steerPivots) p.rotation.y = -pose.steer * MAX_STEER_ANGLE
    this.brakeLight.emissiveIntensity = pose.braking ? 3 : 0
    this.brakeGlow.visible = pose.braking
    this.shieldBubble.visible = pose.shield
    if (pose.shield) {
      const pulse = 1 + Math.sin(pose.time * 6) * 0.04
      this.shieldBubble.scale.setScalar(pulse)
      this.shieldBubble.material.opacity = 0.2 + Math.sin(pose.time * 6) * 0.06
    }
    this.iceBlock.visible = pose.frozen
    for (const flame of this.flames) {
      flame.visible = pose.boost
      // Alevin boyu her karede biraz değişir, titreşir.
      if (pose.boost) flame.scale.set(0.9 + Math.random() * 0.3, 0.7 + Math.random() * 0.6, 0.9 + Math.random() * 0.3)
    }
    this.label.position.set(pose.x, 54, pose.z)
  }

  setVisible(visible: boolean) {
    this.root.visible = visible
    this.label.visible = visible
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose())
    this.root.removeFromParent()
    this.label.removeFromParent()
  }

  private addBox(
    parent: THREE.Object3D,
    size: [number, number, number],
    pos: [number, number, number],
    material: THREE.Material,
  ) {
    const mesh = new THREE.Mesh(this.track(new THREE.BoxGeometry(...size)), material)
    mesh.position.set(...pos)
    mesh.castShadow = true
    parent.add(mesh)
  }

  private createLabel(text: string, color: string) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const font = 'bold 44px system-ui, sans-serif'
    ctx.font = font
    canvas.width = Math.ceil(ctx.measureText(text).width) + 24
    canvas.height = 60
    ctx.font = font
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 10
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2)
    ctx.fillStyle = color
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)

    const texture = this.track(new THREE.CanvasTexture(canvas))
    texture.colorSpace = THREE.SRGBColorSpace
    const sprite = new THREE.Sprite(
      this.track(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })),
    )
    const height = 16
    sprite.scale.set((height * canvas.width) / canvas.height, height, 1)
    sprite.renderOrder = 10
    return sprite
  }

  private track<T extends { dispose(): void }>(resource: T): T {
    this.disposables.push(resource)
    return resource
  }
}
