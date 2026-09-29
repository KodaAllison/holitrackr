import type { MapView } from '../components/MapViewToggle'

const KEY = 'holitrackr:map-view'

/** The desktop map view the user last chose; the globe by default. */
export function readMapView(): MapView {
  try {
    return window.localStorage.getItem(KEY) === 'flat' ? 'flat' : 'globe'
  } catch {
    return 'globe'
  }
}

const INTRO_KEY = 'holitrackr:intro-played'

/** Whether the startup intro has already played in this browser session. */
export function introPlayed(): boolean {
  try {
    return window.sessionStorage.getItem(INTRO_KEY) === '1'
  } catch {
    return false
  }
}

export function markIntroPlayed(): void {
  try {
    window.sessionStorage.setItem(INTRO_KEY, '1')
  } catch {
    // Without storage the intro may replay on reload; harmless.
  }
}

export function writeMapView(view: MapView): void {
  try {
    window.localStorage.setItem(KEY, view)
  } catch {
    // Storage can be unavailable (private mode); the choice just won't persist.
  }
}
