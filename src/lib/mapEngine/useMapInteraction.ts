import { useCallback, useEffect, useRef } from 'react'
import type { Cluster } from './clusters'
import { countryAt, type IndexedCountry } from './countryIndex'
import { findIndexed, hitAt, hoverTarget } from './hitTest'
import type { MapFocus, MapViewOptions } from './mapView'
import { useReducedMotion } from './mapView'
import { createHatch, drawMap, screenAnchor, type ShapeCache, type ViewTransform } from './renderer'
import type { Size } from './views'

/** A ref that always holds the latest value (for imperative frame and pointer paths). */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => { ref.current = value })
  return ref
}

/** What a view does with the shared interactions; each view keeps its own motion. */
export interface MapMotion {
  /** [lon, lat] under screen point (x, y), or null off the map (e.g. beside the globe). */
  locate: (x: number, y: number) => [number, number] | null
  /** "World view": zoom back out to the whole world. */
  onWorldView: () => void
  /**
   * Bring `country` into view. `fresh` is false for a focus that was already
   * there when the view opened (e.g. set before switching views).
   */
  onFocus: (country: IndexedCountry, focus: MapFocus, fresh: boolean) => void
  /** Hold focus requests until the view can move (default true). */
  focusReady?: boolean
}

export interface FrameInput {
  size: Size
  shapes: ShapeCache
  transform: ViewTransform
  countries: IndexedCountry[]
  /** The globe's rim. */
  rim?: boolean
  /** Countries to place the selected label from (default `countries`). */
  anchorCountries?: IndexedCountry[]
}

/**
 * The interaction core both map views share: latest props, the single
 * reduced-motion source, drawing a frame (and keeping its clusters),
 * hit-testing, hover, "World view" and focus requests. The globe and flat
 * hooks only own how they move.
 */
export function useMapInteraction<O extends MapViewOptions>(options: O, motion: MapMotion) {
  const latest = useLatest(options)
  const motionRef = useLatest(motion)
  const reduced = useLatest(useReducedMotion())
  const clusters = useRef<Cluster<IndexedCountry>[]>([])
  const hatch = useRef<CanvasPattern | null>(null)

  /** Draws one frame on `canvas`; returns its context (CSS px, for overlays) or null if nothing drew. */
  const drawFrame = useCallback((canvas: HTMLCanvasElement | null, input: FrameInput) => {
    const ctx = canvas?.getContext('2d')
    if (!ctx || input.size.width === 0) return null
    const opts = latest.current
    hatch.current ??= createHatch(ctx)
    clusters.current = drawMap({
      ctx, ...input.size, dpr: window.devicePixelRatio || 1,
      shapes: input.shapes, transform: input.transform,
      countries: input.countries, statusOf: opts.statusOf, rim: input.rim,
      hoveredKey: opts.hoveredKey, selectedKey: opts.selectedKey, hatch: hatch.current,
    })
    const anchorFrom = input.anchorCountries ?? input.countries
    opts.onSelectedAnchor?.(screenAnchor(input.shapes, input.transform, anchorFrom, opts.selectedKey))
    return ctx
  }, [latest])

  const hitTest = useCallback((x: number, y: number) => hitAt(clusters.current, x, y, (px, py) => {
    const list = latest.current.countries
    const lonLat = list && motionRef.current.locate(px, py)
    return lonLat ? countryAt(list, lonLat) : null
  }), [latest, motionRef])

  /** Hover at (x, y) on `canvas`: the cursor, and the country named in the tooltip. */
  const hoverAt = useCallback((x: number, y: number, canvas: HTMLCanvasElement) => {
    const hit = hitTest(x, y)
    canvas.style.cursor = hit ? 'pointer' : 'grab'
    latest.current.onHover(hoverTarget(hit), x, y)
  }, [hitTest, latest])

  // "World view". Only a change after mount counts, not the value a remount starts with.
  const worldViewSeq = options.worldViewSeq
  const seenWorldView = useRef(worldViewSeq)
  useEffect(() => {
    if (worldViewSeq === seenWorldView.current) return
    seenWorldView.current = worldViewSeq
    motionRef.current.onWorldView()
  }, [worldViewSeq, motionRef])

  // Focus (e.g. picked in search), once the country is known and the view can move.
  const focusSeq = options.focus?.seq
  const openingFocus = useRef(focusSeq)
  const { countries } = options
  const focusReady = motion.focusReady ?? true
  useEffect(() => {
    const target = latest.current.focus
    if (!target || !focusReady) return
    const match = findIndexed(countries, target.country)
    if (match) motionRef.current.onFocus(match, target, target.seq !== openingFocus.current)
  }, [focusSeq, countries, focusReady, latest, motionRef])

  return { latest, reduced, drawFrame, hitTest, hoverAt }
}
