import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import { useEffect, useState } from 'react'
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import type { PathOptions } from 'leaflet'

interface WorldMapProps {
  visitedCountries: string[]
  onCountryClick: (countryCode: string) => void
}

export default function WorldMap({ visitedCountries, onCountryClick }: WorldMapProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null)

  useEffect(() => {
    // We'll load GeoJSON data here
    // For now, using a placeholder
    fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
      .then(response => response.json())
      .then(data => setGeoData(data))
      .catch(error => console.error('Error loading GeoJSON:', error))
  }, [])

  const getCountryStyle = (feature?: Feature<Geometry, GeoJsonProperties>): PathOptions => {
    const countryCode = feature?.properties?.id || feature?.properties?.iso_a2 || feature?.id
    const isVisited = countryCode && visitedCountries.includes(countryCode)
    
    return {
      fillColor: isVisited ? '#10b981' : '#e5e7eb',
      fillOpacity: isVisited ? 0.7 : 0.5,
      color: '#fff',
      weight: 1,
    }
  }

  const onEachCountry = (feature: Feature<Geometry, GeoJsonProperties>, layer: any) => {
    const countryName = feature.properties?.name || 'Unknown'
    const countryCode = feature.properties?.id || feature.properties?.iso_a2 || feature.id
    
    layer.on({
      mouseover: () => {
        layer.setStyle({
          fillOpacity: 0.9,
          weight: 2,
        })
      },
      mouseout: () => {
        layer.setStyle(getCountryStyle(feature))
      },
      click: () => {
        if (countryCode) {
          onCountryClick(countryCode as string)
        }
      },
    })

    layer.bindPopup(`
      <div class="text-center">
        <h3 class="font-bold text-lg">${countryName}</h3>
        <p class="text-sm text-gray-600">Click to mark as ${visitedCountries.includes(countryCode as string) ? 'not visited' : 'visited'}</p>
      </div>
    `)
  }

  if (!geoData) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-600">Loading map...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '600px', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <GeoJSON
            data={geoData}
            style={getCountryStyle}
            onEachFeature={onEachCountry}
          />
        </MapContainer>
      </div>
    </div>
  )
}
