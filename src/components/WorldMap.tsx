import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Country, VisitedCountry } from '../types'
import { countryKey } from '../lib/visitedCountries'
import { loadWorld } from '../lib/worldAtlas'
import { buildCountryIndex, type IndexedCountry } from '../lib/mapEngine/countryIndex'
import type { ViewTransform } from '../lib/mapEngine/renderer'
import type { MapViewOptions } from '../lib/mapEngine/useFlatMap'
import { DEFAULT_GLOBE, type GlobeView } from '../lib/mapEngine/views'
import { readMapView, writeMapView } from '../lib/mapViewPreference'
import { useMediaQuery } from '../lib/useMediaQuery'
import FlatMapSurface from './FlatMapSurface'
import GlobeMapSurface from './GlobeMapSurface'
import MapLegend from './MapLegend'
import MapOverlays, { type Pointed } from './MapOverlays'
import MapViewToggle, { type MapView } from './MapViewToggle'
import MorphMapSurface from './MorphMapSurface'

interface WorldMapProps {
  visitedCountries: VisitedCountry[]
  onCountryAction: (code: string, name: string, status: 'visited' | 'bucketlist') => void
  onCountriesLoaded?: (countries: Country[]) => void
  onOpenJournal?: (code: string, name: string) => void
  /** Bring this country to the front (e.g. after picking it in search). */
  focus?: { country: Country; seq: number } | null
}

/** Desktop gets the globe (or flat, by choice); smaller screens are always flat. */
const DESKTOP_QUERY = '(min-width: 1024px)'
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
const SURFACE = 'relative w-full select-none'
const IDENTITY: ViewTransform = { k: 1, x: 0, y: 0 }

export default function WorldMap({ visitedCountries, onCountryAction, onCountriesLoaded, onOpenJournal, focus }: WorldMapProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY)
  const reducedMotion = useMediaQuery(REDUCED_QUERY)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [countries, setCountries] = useState<IndexedCountry[] | null>(null)
  const [motionCountries, setMotionCountries] = useState<IndexedCountry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [hovered, setHovered] = useState<Pointed | null>(null)
  const [popup, setPopup] = useState<Pointed | null>(null)
  const [preferred, setPreferred] = useState<MapView>(readMapView)
  const [morph, setMorph] = useState<{ to: MapView; globe: GlobeView; flat: ViewTransform } | null>(null)
  const globeView = useRef<GlobeView | null>(null)
  const flatView = useRef<ViewTransform | null>(null)
  const savedGlobe = useRef<GlobeView | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    loadWorld('motion')
      .then(world => { if (!cancelled) setMotionCountries(buildCountryIndex(world)) })
      .catch(error => console.error('Error loading world atlas (motion):', error))
    loadWorld('detail')
      .then(world => {
        if (cancelled) return
        const index = buildCountryIndex(world)
        setCountries(index)
        onCountriesLoaded?.(index.map(c => c.identity).sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(error => {
        console.error('Error loading world atlas:', error)
        if (!cancelled) setFailed(true)
      })
    return () => { cancelled = true }
  }, [onCountriesLoaded])

  const statusByKey = useMemo(
    () => new Map(visitedCountries.map(v => [countryKey(v), v.status] as const)),
    [visitedCountries]
  )
  const statusOf = useCallback((c: IndexedCountry) => statusByKey.get(countryKey(c.identity)), [statusByKey])

  const options: MapViewOptions = {
    countries,
    statusOf,
    hoveredKey: hovered ? countryKey(hovered.country) : null,
    selectedKey: popup ? countryKey(popup.country) : null,
    onHover: (c, x, y) => setHovered(c ? { country: c.identity, x, y } : null),
    onPick: (c, x, y) => { setHovered(null); setPopup({ country: c.identity, x, y }) },
    onMoveStart: () => setPopup(null),
  }

  const switchView = (to: MapView) => {
    setPopup(null)
    setHovered(null)
    // Leaving the globe saves where it was; coming back restores it.
    if (to === 'flat') savedGlobe.current = globeView.current ?? savedGlobe.current
    const globe = savedGlobe.current ?? DEFAULT_GLOBE
    setPreferred(to)
    writeMapView(to)
    const shapes = motionCountries ?? countries
    if (!reducedMotion && shapes) {
      setMorph({ to, globe, flat: to === 'flat' ? IDENTITY : flatView.current ?? IDENTITY })
    }
  }

  const view: MapView = desktop ? preferred : 'flat'
  const overlays = (
    <MapOverlays
      loading={!countries && !motionCountries}
      failed={failed}
      hovered={morph ? null : hovered}
      popup={morph ? null : popup}
      statusOf={country => statusByKey.get(countryKey(country))}
      containerWidth={cardRef.current?.clientWidth ?? 0}
      onAction={(country, status) => { onCountryAction(country.code, country.name, status); setPopup(null) }}
      onOpenJournal={onOpenJournal && (country => { onOpenJournal(country.code, country.name); setPopup(null) })}
      onClose={() => setPopup(null)}
    />
  )

  return (
    <div ref={cardRef} className="relative bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
      {morph && (motionCountries ?? countries) ? (
        <MorphMapSurface
          direction={morph.to === 'flat' ? 'toFlat' : 'toGlobe'}
          globe={morph.globe}
          flat={morph.flat}
          countries={motionCountries ?? countries ?? []}
          statusOf={statusOf}
          onDone={() => setMorph(null)}
          className={`${SURFACE} h-[420px]`}
        />
      ) : view === 'globe' ? (
        <GlobeMapSurface
          options={{ ...options, motionCountries, focus, initialView: savedGlobe.current, viewRef: globeView }}
          className={`${SURFACE} h-[420px] bg-gradient-to-b from-white to-gray-50`}
        >
          {overlays}
        </GlobeMapSurface>
      ) : (
        <FlatMapSurface
          options={{ ...options, fitOnOpen: true, viewRef: flatView }}
          className={`${SURFACE} aspect-[2/1] sm:aspect-auto sm:h-[420px]`}
        >
          {overlays}
        </FlatMapSurface>
      )}
      {desktop && <MapViewToggle view={morph ? morph.to : preferred} disabled={morph !== null} onChange={switchView} />}
      <MapLegend />
    </div>
  )
}
