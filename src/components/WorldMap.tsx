import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Country, MapFilter, VisitedCountry } from '../types'
import { countryKey, type CountryIdentity } from '../lib/visitedCountries'
import type { IndexedCountry } from '../lib/mapEngine/countryIndex'
import { useWorldCountries } from '../lib/mapEngine/useWorldCountries'
import type { ViewTransform } from '../lib/mapEngine/renderer'
import type { MapViewOptions } from '../lib/mapEngine/useFlatMap'
import { DEFAULT_GLOBE, type GlobeView } from '../lib/mapEngine/views'
import { introPlayed, markIntroPlayed, readMapView, writeMapView } from '../lib/mapViewPreference'
import { SHOW_ALL, shownStatus } from '../lib/mapFilter'
import { useMediaQuery } from '../lib/useMediaQuery'
import FlatMapSurface from './FlatMapSurface'
import GlobeMapSurface from './GlobeMapSurface'
import IntroMapSurface from './IntroMapSurface'
import { atlasProgress } from '../lib/atlasProgress'
import MapChrome from './MapChrome'
import MapOverlays, { type Pointed } from './MapOverlays'
import type { MapView } from './MapViewToggle'
import MorphMapSurface from './MorphMapSurface'

interface WorldMapProps {
  visitedCountries: VisitedCountry[]
  onCountriesLoaded?: (countries: Country[]) => void
  /** A click on a country opens it (in the sidebar). */
  onSelectCountry?: (country: Country) => void
  /** The open country, outlined on the map. */
  selected?: CountryIdentity | null
  /** "‹ World view": close the open country (the map also zooms back out). */
  onWorldView?: () => void
  /** Which marked countries are filled in; the "Show" filter edits it. */
  filter?: MapFilter
  onFilterChange?: (filter: MapFilter) => void
  /** The countries are still loading. */
  loading?: boolean
  /** Centred over the map once it is interactive (the first-run welcome card). */
  welcome?: ReactNode
  /** Hide the how-to hint (e.g. while a toast sits in its place). */
  quiet?: boolean
  /** Bring this country to the front (e.g. after picking it in search). */
  focus?: { country: Country; seq: number; pulse?: boolean } | null
}

/** Desktop gets the globe (or flat, by choice); smaller screens are always flat. */
const DESKTOP_QUERY = '(min-width: 1024px)'
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
const SURFACE = 'relative w-full h-full select-none'
const IDENTITY: ViewTransform = { k: 1, x: 0, y: 0 }
const HINTS: Record<MapView, string> = {
  globe: 'Drag to spin · Scroll to zoom · Click a country to open it',
  flat: 'Click a country to open it',
}

export default function WorldMap(props: WorldMapProps) {
  const { visitedCountries, onCountriesLoaded, onSelectCountry, selected, onWorldView, filter = SHOW_ALL } = props
  const { onFilterChange, loading, welcome, quiet, focus } = props
  const desktop = useMediaQuery(DESKTOP_QUERY)
  const reducedMotion = useMediaQuery(REDUCED_QUERY)
  const { countries, motionCountries, failed } = useWorldCountries(onCountriesLoaded)
  const [hovered, setHovered] = useState<Pointed | null>(null)
  const [interacted, setInteracted] = useState(false)
  const [worldViewSeq, setWorldViewSeq] = useState(0)
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
  // What the map fills in: the "Show" filter hides whole statuses.
  const { visited: showVisited, bucketlist: showBucket } = filter
  const statusOf = useCallback(
    (c: IndexedCountry) => shownStatus(statusByKey.get(countryKey(c.identity)), { visited: showVisited, bucketlist: showBucket }),
    [statusByKey, showVisited, showBucket]
  )

  const options: MapViewOptions = {
    countries,
    statusOf,
    hoveredKey: hovered ? countryKey(hovered.country) : null,
    selectedKey: selected ? countryKey(selected) : null,
    onHover: (c, x, y) => setHovered(c ? { country: c.identity, x, y } : null),
    onPick: c => { setHovered(null); setInteracted(true); onSelectCountry?.(c.identity) },
    onMoveStart: () => setInteracted(true),
    worldViewSeq,
  }

  const switchView = (to: MapView) => {
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
  const canFit = visitedCountries.length > 0
  const overlays = (
    <MapOverlays
      loading={!countries && !motionCountries}
      failed={failed}
      hovered={morph ? null : hovered}
      statusOf={country => statusByKey.get(countryKey(country))}
    />
  )
  const showHint = !interacted && !quiet && !selected && !morph && !welcome && countries !== null

  return (
    <div className="relative h-full overflow-hidden bg-[#EEF2F6]">
      {showIntro ? (
        <IntroMapSurface countries={motionCountries ?? countries} statusOf={statusOf} onDone={finishIntro} className={SURFACE} />
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
          canFit={canFit}
          className={SURFACE}
        >
          {overlays}
        </GlobeMapSurface>
      ) : (
        <FlatMapSurface options={{ ...options, fitOnOpen: true, viewRef: flatView }} canFit={canFit} className={SURFACE}>
          {overlays}
        </FlatMapSurface>
      )}
      {!showIntro && (
        <>
          <MapChrome
            desktop={desktop}
            view={morph ? morph.to : preferred}
            morphing={morph !== null}
            onViewChange={switchView}
            progress={atlasProgress(visitedCountries)}
            loading={loading}
            selected={Boolean(selected)}
            onWorldView={() => { setWorldViewSeq(s => s + 1); onWorldView?.() }}
            filter={filter}
            onFilterChange={f => onFilterChange?.(f)}
            showLegend={Boolean(onFilterChange) && canFit}
            hint={showHint ? HINTS[view] : null}
          />
          {welcome}
        </>
      )}
    </div>
  )
}
