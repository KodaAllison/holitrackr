import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import { useEffect, useState, useRef } from 'react'
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import type { PathOptions } from 'leaflet'
import type { GeoJSON as LeafletGeoJSON } from 'leaflet'
import type { Country, VisitedCountry } from '../types'

interface WorldMapProps {
  visitedCountries: VisitedCountry[]
  onCountryClick: (countryCode: string, countryName: string) => void
  onCountriesLoaded?: (countries: Country[]) => void
}

export default function WorldMap({ visitedCountries, onCountryClick, onCountriesLoaded }: WorldMapProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null)
  const geoJsonRef = useRef<LeafletGeoJSON | null>(null)
  const visitedCountriesRef = useRef<VisitedCountry[]>(visitedCountries)

  // Keep ref in sync with prop
  useEffect(() => {
    visitedCountriesRef.current = visitedCountries
  }, [visitedCountries])

  const isCountryVisited = (code: string, name: string) =>
    visitedCountriesRef.current.some(
      v => v.code === code && v.name === name
    )

  useEffect(() => {
    // Load GeoJSON data from a reliable source
    fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
      .then(response => response.json())
      .then(data => {
        setGeoData(data)
        
        // Extract country list for search
        if (onCountriesLoaded && data.features) {
          const countries = data.features
            .map((feature: any) => ({
              name: feature.properties?.name || feature.properties?.ADMIN || 'Unknown',
              code:
                feature.properties?.['ISO3166-1-Alpha-3'] ||
                feature.properties?.ISO_A3 ||
                '',
            }))
            .filter((c: any) => c.code && c.name !== 'Unknown')
            .sort((a: any, b: any) => a.name.localeCompare(b.name))
          
          onCountriesLoaded(countries)
        }
      })
      .catch(error => {
        console.error('Error loading GeoJSON:', error)
        // Fallback to alternative source
        fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
          .then(response => response.json())
          .then(data => setGeoData(data))
          .catch(err => console.error('Fallback also failed:', err))
      })
  }, [onCountriesLoaded])

  const getCountryStyle = (feature?: Feature<Geometry, GeoJsonProperties>): PathOptions => {
    const countryCode =
      feature?.properties?.['ISO3166-1-Alpha-3'] ||
      feature?.properties?.ISO_A3
    const countryName =
      feature?.properties?.name || feature?.properties?.ADMIN || ''

    const isVisited =
      countryCode &&
      countryName &&
      visitedCountries.some(
        v => v.code === countryCode && v.name === countryName
      )
    
    return {
      fillColor: isVisited ? '#10b981' : '#e5e7eb',
      fillOpacity: isVisited ? 0.7 : 0.5,
      color: '#fff',
      weight: 1,
    }
  }

  const onEachCountry = (feature: Feature<Geometry, GeoJsonProperties>, layer: any) => {
    const countryName =
      feature.properties?.name || feature.properties?.ADMIN || 'Unknown'

    const countryCode =
      feature.properties?.['ISO3166-1-Alpha-3'] ||
      feature.properties?.ISO_A3
    
    // Bind tooltip that shows automatically on hover
    layer.bindTooltip(countryName, {
      permanent: false,
      sticky: true,
      opacity: 1
    })
    
    layer.on({
      mouseover: () => {
        layer.setStyle({
          fillOpacity: 0.9,
          weight: 2,
        })
      },
      mouseout: () => {
        const isCurrentlyVisited =
          countryCode && isCountryVisited(countryCode, countryName)
        layer.setStyle({
          fillColor: isCurrentlyVisited ? '#10b981' : '#e5e7eb',
          fillOpacity: isCurrentlyVisited ? 0.7 : 0.5,
          weight: 1,
        })
      },
      click: () => {
        if (countryCode && countryName !== 'Unknown') {
          onCountryClick(countryCode as string, countryName)
        }
      },
    })
  }

  // Re-style all layers when visitedCountries changes
  useEffect(() => {
    if (geoJsonRef.current) {
      geoJsonRef.current.eachLayer((layer: any) => {
        if (layer.feature) {
          layer.setStyle(getCountryStyle(layer.feature))
        }
      })
    }
  }, [visitedCountries])

  if (!geoData) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-600">Loading map...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 h-full min-h-0 flex flex-col">
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
        </MapContainer>
    </div>
  )
}
