import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Country, VisitedCountry } from '../types'
import { countryKey } from '../lib/visitedCountries'
import { loadWorld } from '../lib/worldAtlas'
import { buildCountryIndex, type IndexedCountry } from '../lib/mapEngine/countryIndex'
import { useFlatMap } from '../lib/mapEngine/useFlatMap'
import MapLegend from './MapLegend'
import MapPopup from './MapPopup'

interface WorldMapProps {
  visitedCountries: VisitedCountry[]
  onCountryAction: (code: string, name: string, status: 'visited' | 'bucketlist') => void
  onCountriesLoaded?: (countries: Country[]) => void
  onOpenJournal?: (code: string, name: string) => void
}

interface Pointed {
  country: Country
  x: number
  y: number
}

export default function WorldMap({ visitedCountries, onCountryAction, onCountriesLoaded, onOpenJournal }: WorldMapProps) {
  const [countries, setCountries] = useState<IndexedCountry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [hovered, setHovered] = useState<Pointed | null>(null)
  const [popup, setPopup] = useState<Pointed | null>(null)

  useEffect(() => {
    let cancelled = false
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

  const { containerRef, canvasRef, handlers } = useFlatMap({
    countries,
    statusOf,
    hoveredKey: hovered ? countryKey(hovered.country) : null,
    selectedKey: popup ? countryKey(popup.country) : null,
    onHover: (c, x, y) => setHovered(c ? { country: c.identity, x, y } : null),
    onPick: (c, x, y) => { setHovered(null); setPopup({ country: c.identity, x, y }) },
    onMoveStart: () => setPopup(null),
  })

  const closePopup = useCallback(() => setPopup(null), [])
  const hoveredStatus = hovered && statusByKey.get(countryKey(hovered.country))

  return (
    <div className="relative bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
      <div ref={containerRef} className="relative aspect-[2/1] sm:aspect-auto sm:h-[420px] w-full select-none">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full touch-none"
          {...handlers}
        />
        {!countries && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600">
            {failed ? 'The map could not be loaded.' : 'Loading map...'}
          </div>
        )}
        {hovered && !popup && (
          <div
            className="absolute z-10 pointer-events-none rounded-md bg-gray-900/90 text-white text-xs font-medium px-2 py-1 whitespace-nowrap"
            style={{ left: hovered.x + 12, top: hovered.y + 12 }}
          >
            {hovered.country.name}
            {hoveredStatus && (
              <span className="ml-1 text-gray-300">· {hoveredStatus === 'visited' ? 'Visited' : 'Bucket list'}</span>
            )}
          </div>
        )}
        {popup && (
          <MapPopup
            country={popup.country}
            status={statusByKey.get(countryKey(popup.country))}
            x={popup.x}
            y={popup.y}
            containerWidth={containerRef.current?.clientWidth ?? 0}
            onAction={status => { onCountryAction(popup.country.code, popup.country.name, status); closePopup() }}
            onOpenJournal={onOpenJournal && (() => { onOpenJournal(popup.country.code, popup.country.name); closePopup() })}
            onClose={closePopup}
          />
        )}
      </div>
      <MapLegend />
    </div>
  )
}
