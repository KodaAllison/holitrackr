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

export function writeMapView(view: MapView): void {
  try {
    window.localStorage.setItem(KEY, view)
  } catch {
    // Storage can be unavailable (private mode); the choice just won't persist.
  }
}
