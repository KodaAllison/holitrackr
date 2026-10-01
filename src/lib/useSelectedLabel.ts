import { useCallback, useEffect, useRef } from 'react'
import type { MapInset } from './mapEngine/views'
import { placeLabel, type Point } from './selectedLabel'

/**
 * Positions the selected country's name label straight from the map
 * engine's frames: `place` writes the label's transform and visibility on
 * the DOM node, so following a pan, spin or inertia costs no React renders.
 * The label stays inside its offset parent, less `inset` (e.g. the mobile
 * search above and sheet below).
 */
export function useSelectedLabel(inset: MapInset) {
  const ref = useRef<HTMLDivElement | null>(null)
  const latestInset = useRef(inset)
  useEffect(() => { latestInset.current = inset })

  const place = useCallback((anchor: Point | null) => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const { top, right, bottom, left } = latestInset.current
    const spot = placeLabel(
      anchor,
      { width: el.offsetWidth, height: el.offsetHeight },
      { left, top, right: parent.clientWidth - right, bottom: parent.clientHeight - bottom },
    )
    if (!spot) {
      el.style.visibility = 'hidden'
      return
    }
    el.style.transform = `translate3d(${Math.round(spot.x)}px, ${Math.round(spot.y)}px, 0)`
    el.style.visibility = 'visible'
  }, [])

  return { ref, place }
}
