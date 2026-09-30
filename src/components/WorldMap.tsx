import { useCallback, useMemo, useRef, useState } from 'react'
import type { Country, MapFilter, VisitedCountry } from '../types'
import { countryKey } from '../lib/visitedCountries'
import type { IndexedCountry } from '../lib/mapEngine/countryIndex'
import { useWorldCountries } from '../lib/mapEngine/useWorldCountries'
import type { ViewTransform } from '../lib/mapEngine/renderer'
import type { MapViewOptions } from '../lib/mapEngine/useFlatMap'
import { DEFAULT_GLOBE, type GlobeView } from '../lib/mapEngine/views'
import { introPlayed, markIntroPlayed, readMapView, writeMapView } from '../lib/mapViewPreference'
import { useMediaQuery } from '../lib/useMediaQuery'
import FlatMapSurface from './FlatMapSurface'
import GlobeMapSurface from './GlobeMapSurface'
import IntroMapSurface from './IntroMapSurface'
import { atlasProgress } from '../lib/atlasProgress'
import MapLegend from './MapLegend'
import MapSummaryChip from './MapSummaryChip'
import MapOverlays, { type Pointed } from './MapOverlays'
import MapViewToggle, { type MapView } from './MapViewToggle'
import MorphMapSurface from './MorphMapSurface'
import MobileMapControls from './MobileMapControls'

interface WorldMapProps {
  visitedCountries: VisitedCountry[]
  onCountryAction: (code: string, name: string, status: 'visited' | 'bucketlist') => void
  onCountriesLoaded?: (countries: Country[]) => void
  onOpenJournal?: (code: string, name: string) => void
  /** Bring this country to the front (e.g. after picking it in search). */
  focus?: { country: Country; seq: number; pulse?: boolean } | null
  /** Which marked countries to colour in; both when omitted. */
  mapFilter?: MapFilter
  onMapFilterChange?: (filter: MapFilter) => void
}

/** Desktop gets the globe (or flat, by choice); smaller screens are always flat. */
const DESKTOP_QUERY = '(min-width: 1024px)'
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
const SURFACE = 'relative w-full h-full select-none'
const IDENTITY: ViewTransform = { k: 1, x: 0, y: 0 }
const SHOW_ALL: MapFilter = { visited: true, bucketlist: true }

export default function WorldMap({ visitedCountries, onCountryAction, onCountriesLoaded, onOpenJournal, focus, mapFilter, onMapFilterChange }: WorldMapProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY)
  const reducedMotion = useMediaQuery(REDUCED_QUERY)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const { countries, motionCountries, failed } = useWorldCountries(onCountriesLoaded)
  const [hovered, setHovered] = useState<Pointed | null>(null)
  const [popup, setPopup] = useState<Pointed | null>(null)
  const [preferred, setPreferred] = useState<MapView>(readMapView)
  const [morph, setMorph] = useState<{ to: MapView; globe: GlobeView; flat: ViewTransform } | null>(null)
  const globeView = useRef<GlobeView | null>(null)
  const flatView = useRef<ViewTransform | null>(null)
  const savedGlobe = useRef<GlobeView | undefined>(undefined)
  // Once per session, desktop only, and never with reduced motion.
  const [intro, setIntro] = useState(() => !introPlayed())
  const showIntro = intro && desktop && !reducedMotion

  const statusByKey = useMemo(
    () => new Map(visitedCountries.map(v => [countryKey(v), v.status] as const)),
    [visitedCountries]
  )
  const filter = mapFilter ?? SHOW_ALL
  const { visited: showVisited, bucketlist: showBucket } = filter
  const statusOf = useCallback((c: IndexedCountry) => {
    const status = statusByKey.get(countryKey(c.identity))
    return status && (status === 'visited' ? showVisited : showBucket) ? status : undefined
  }, [statusByKey, showVisited, showBucket])

  const options: MapViewOptions = {
    countries,
    statusOf,
    hoveredKey: hovered ? countryKey(hovered.country) : null,
    selectedKey: popup ? countryKey(popup.country) : null,
    onHover: (c, x, y) => setHovered(c ? { country: c.identity, x, y } : null),
    onPick: (c, x, y) => {
      setHovered(null)
      // Mobile: a marked country opens straight into the sheet; unmarked ones get the popup to mark them.
      if (!desktop && onOpenJournal && statusByKey.has(countryKey(c.identity))) {
        setPopup(null)
        onOpenJournal(c.identity.code, c.identity.name)
        return
      }
      setPopup({ country: c.identity, x, y })
    },
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

  const finishIntro = () => {
    markIntroPlayed()
    setIntro(false)
    // A saved Flat preference finishes the intro with the unroll.
    if (preferred === 'flat') setMorph({ to: 'flat', globe: DEFAULT_GLOBE, flat: IDENTITY })
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
    <div ref={cardRef} className="relative h-full overflow-hidden bg-[#EEF2F6]">
      {showIntro ? (
        <IntroMapSurface
          countries={motionCountries ?? countries}
          statusOf={statusOf}
          onDone={finishIntro}
          className={SURFACE}
        />
      ) : morph && (motionCountries ?? countries) ? (
        <MorphMapSurface
          direction={morph.to === 'flat' ? 'toFlat' : 'toGlobe'}
          globe={morph.globe}
          flat={morph.flat}
          countries={motionCountries ?? countries ?? []}
          statusOf={statusOf}
          onDone={() => setMorph(null)}
          className={SURFACE}
        />
      ) : view === 'globe' ? (
        <GlobeMapSurface
          options={{ ...options, motionCountries, focus, initialView: savedGlobe.current, viewRef: globeView }}
          className={SURFACE}
        >
          {overlays}
        </GlobeMapSurface>
      ) : (
        <FlatMapSurface
          options={{ ...options, fitOnOpen: true, viewRef: flatView }}
          className={SURFACE}
          controls={desktop ? undefined : fit => <MobileMapControls onFit={fit} filter={filter} onFilterChange={onMapFilterChange} />}
        >
          {overlays}
        </FlatMapSurface>
      )}
      {!showIntro && (
        <>
          {/* Desktop: Globe / Flat and the summary, top-left. Mobile: the chip places itself under the search. */}
          <div className="lg:absolute lg:top-5 lg:left-5 lg:z-10 flex items-center gap-2">
            {desktop && <MapViewToggle view={morph ? morph.to : preferred} disabled={morph !== null} onChange={switchView} />}
            <MapSummaryChip progress={atlasProgress(visitedCountries)} />
          </div>
          <MapLegend />
        </>
      )}
    </div>
  )
}
