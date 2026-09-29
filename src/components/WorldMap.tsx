import { MapContainer, TileLayer, GeoJSON, Popup } from 'react-leaflet'
import { useEffect, useState, useRef } from 'react'
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import type { PathOptions } from 'leaflet'
import type { TooltipOptions } from 'leaflet'
import type { GeoJSON as LeafletGeoJSON } from 'leaflet'
import type { Country, VisitedCountry } from '../types'
import { findCountry } from '../lib/visitedCountries'
import { featureIdentity, featureName } from '../lib/featureIdentity'
import { loadWorld } from '../lib/worldAtlas'

interface WorldMapProps {
  visitedCountries: VisitedCountry[]
  onCountryAction: (code: string, name: string, status: 'visited' | 'bucketlist') => void
  onCountriesLoaded?: (countries: Country[]) => void
  onOpenJournal?: (code: string, name: string) => void
}

export default function WorldMap({ visitedCountries, onCountryAction, onCountriesLoaded, onOpenJournal }: WorldMapProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null)
  const [activePopup, setActivePopup] = useState<{ code: string; name: string; latlng: [number, number] } | null>(null)
  const geoJsonRef = useRef<LeafletGeoJSON | null>(null)
  const visitedCountriesRef = useRef<VisitedCountry[]>(visitedCountries)

  // Keep ref in sync with prop
  useEffect(() => {
    visitedCountriesRef.current = visitedCountries
  }, [visitedCountries])

  useEffect(() => {
    let cancelled = false
    loadWorld('detail')
      .then(data => {
        if (cancelled) return
        setGeoData(data)

        // Extract country list for search
        if (onCountriesLoaded) {
          const countries = data.features
            .map(featureIdentity)
            .filter((c): c is Country => c !== null)
            .sort((a, b) => a.name.localeCompare(b.name))

          onCountriesLoaded(countries)
        }
      })
      .catch(error => console.error('Error loading world atlas:', error))
    return () => { cancelled = true }
  }, [onCountriesLoaded])

  const getCountryStyle = (feature?: Feature<Geometry, GeoJsonProperties>): PathOptions => {
    const identity = featureIdentity(feature)
    const entry = identity ? findCountry(visitedCountries, identity) : undefined

    return {
      fillColor: entry?.status === 'visited' ? '#10b981' : entry?.status === 'bucketlist' ? '#f59e0b' : '#e5e7eb',
      fillOpacity: entry ? 0.7 : 0.5,
      color: '#fff',
      weight: 1,
    }
  }

  const onEachCountry = (
    feature: Feature<Geometry, GeoJsonProperties>,
    layer: unknown
  ) => {
    const identity = featureIdentity(feature)

    const leafletLayer = layer as unknown as {
      bindTooltip: (content: string, options: TooltipOptions) => void
      setStyle: (style: PathOptions) => void
      on: (handlers: {
        mouseover: () => void
        mouseout: () => void
        click: (e: { latlng: { lat: number; lng: number } }) => void
      }) => void
    }
    
    // Bind tooltip that shows automatically on hover
    leafletLayer.bindTooltip(featureName(feature) ?? 'Unknown', {
      permanent: false,
      sticky: true,
      opacity: 1
    })
    
    leafletLayer.on({
      mouseover: () => {
        leafletLayer.setStyle({
          fillOpacity: 0.9,
          weight: 2,
        })
      },
      mouseout: () => {
        const currentEntry = identity
          ? findCountry(visitedCountriesRef.current, identity)
          : undefined
        leafletLayer.setStyle({
          fillColor: currentEntry?.status === 'visited' ? '#10b981' : currentEntry?.status === 'bucketlist' ? '#f59e0b' : '#e5e7eb',
          fillOpacity: currentEntry ? 0.7 : 0.5,
          weight: 1,
        })
      },
      click: (e: { latlng: { lat: number; lng: number } }) => {
        if (identity) {
          setActivePopup({ ...identity, latlng: [e.latlng.lat, e.latlng.lng] })
        }
      },
    })
  }

  // Re-style all layers when visitedCountries changes
  useEffect(() => {
    if (geoJsonRef.current) {
      geoJsonRef.current.eachLayer((layer) => {
        const leafletLayer = layer as unknown as {
          feature?: Feature<Geometry, GeoJsonProperties>
          setStyle: (style: PathOptions) => void
        }

        if (leafletLayer.feature) {
          leafletLayer.setStyle(getCountryStyle(leafletLayer.feature))
        }
      })
    }
  }, [visitedCountries, getCountryStyle])

  if (!geoData) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-600">Loading map...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 h-full min-h-0 flex flex-col relative">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '420px', width: '100%' }}
          scrollWheelZoom={true}
          maxBounds={[[-85, -180], [85, 180]]}
          maxBoundsViscosity={1}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            noWrap={true}
          />
          <GeoJSON
            ref={geoJsonRef}
            data={geoData}
            style={getCountryStyle}
            onEachFeature={onEachCountry}
          />
          {activePopup && (() => {
            const entry = findCountry(visitedCountries, activePopup)
            return (
              <Popup
                position={activePopup.latlng}
                eventHandlers={{ remove: () => setActivePopup(null) }}
              >
                <div className="text-sm min-w-[160px]">
                  <p className="font-semibold text-gray-800 mb-2">{activePopup.name}</p>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => { onCountryAction(activePopup.code, activePopup.name, 'visited'); setActivePopup(null) }}
                      className={`flex-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${
                        entry?.status === 'visited'
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'border-emerald-500 text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >Visited</button>
                    <button
                      onClick={() => { onCountryAction(activePopup.code, activePopup.name, 'bucketlist'); setActivePopup(null) }}
                      className={`flex-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${
                        entry?.status === 'bucketlist'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'border-amber-500 text-amber-600 hover:bg-amber-50'
                      }`}
                    >Bucket List</button>
                  </div>
                  {entry && onOpenJournal && (
                    <button
                      onClick={() => { onOpenJournal(activePopup.code, activePopup.name); setActivePopup(null) }}
                      className="w-full px-2 py-1 rounded text-xs font-medium border border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      Edit Journal
                    </button>
                  )}
                </div>
              </Popup>
            )
          })()}
        </MapContainer>
        <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-md border border-gray-200 px-3 py-2 text-xs space-y-1">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Visited</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Bucket List</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gray-300 inline-block" /> Not visited</div>
        </div>
    </div>
  )
}
