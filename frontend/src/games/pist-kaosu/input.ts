const DRIVE_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight',
])

export interface DriveInput {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  drift: boolean
}

/** Pencere seviyesinde klavye takibi; sekme odağı kaybedilince tüm tuşlar bırakılır. */
export class KeyboardInput {
  private pressed = new Set<string>()
  private pressHandlers = new Map<string, () => void>()

  private onDown = (e: KeyboardEvent) => {
    if (DRIVE_KEYS.has(e.code)) {
      e.preventDefault()
      this.pressed.add(e.code)
    } else if (!e.repeat) {
      this.pressHandlers.get(e.code)?.()
    }
  }
  private onUp = (e: KeyboardEvent) => this.pressed.delete(e.code)
  private onBlur = () => this.pressed.clear()

  constructor() {
    window.addEventListener('keydown', this.onDown)
    window.addEventListener('keyup', this.onUp)
    window.addEventListener('blur', this.onBlur)
  }

  /** Tek seferlik tuş basışı (örn. kamera değiştirme). */
  onPress(code: string, handler: () => void) {
    this.pressHandlers.set(code, handler)
  }

  drive(): DriveInput {
    const p = this.pressed
    return {
      up: p.has('KeyW') || p.has('ArrowUp'),
      down: p.has('KeyS') || p.has('ArrowDown'),
      left: p.has('KeyA') || p.has('ArrowLeft'),
      right: p.has('KeyD') || p.has('ArrowRight'),
      drift: p.has('Space') || p.has('ShiftLeft') || p.has('ShiftRight'),
    }
  }

  dispose() {
    window.removeEventListener('keydown', this.onDown)
    window.removeEventListener('keyup', this.onUp)
    window.removeEventListener('blur', this.onBlur)
  }
}
