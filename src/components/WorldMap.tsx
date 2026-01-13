import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import { useEffect, useState, useRef } from 'react'
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import type { PathOptions } from 'leaflet'
import type { GeoJSON as LeafletGeoJSON } from 'leaflet'

interface WorldMapProps {
  visitedCountries: string[]
  onCountryClick: (countryCode: string) => void
}

export default function WorldMap({ visitedCountries, onCountryClick }: WorldMapProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null)
  const geoJsonRef = useRef<LeafletGeoJSON | null>(null)

  useEffect(() => {
    // Load GeoJSON data from a reliable source
    fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
      .then(response => response.json())
      .then(data => {
        console.log('GeoJSON loaded successfully', data)
        setGeoData(data)
      })
      .catch(error => {
        console.error('Error loading GeoJSON:', error)
        // Fallback to alternative source
        fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
          .then(response => response.json())
          .then(data => setGeoData(data))
          .catch(err => console.error('Fallback also failed:', err))
      })
  }, [])

  const getCountryStyle = (feature?: Feature<Geometry, GeoJsonProperties>): PathOptions => {
    const countryCode = 
    feature?.properties?.['ISO3166-1-Alpha-3'] ||
    feature?.properties?.['ISO3166-1-Alpha-2']  
    
    const isVisited = countryCode && visitedCountries.includes(countryCode as string)
    
    return {
      fillColor: isVisited ? '#10b981' : '#e5e7eb',
      fillOpacity: isVisited ? 0.7 : 0.5,
      color: '#fff',
      weight: 1,
    }
  }

  const onEachCountry = (feature: Feature<Geometry, GeoJsonProperties>, layer: any) => {
    const countryName = feature.properties?.name || feature.properties?.ADMIN || 'Unknown'
    
    // Check all possible property names for country code
    const countryCode = 
      feature.properties?.['ISO3166-1-Alpha-3'] 
    
    // Log first feature to see structure
    if (!countryCode) {
      console.log('Missing code for:', countryName, 'Properties:', feature.properties)
    }
    
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
          console.log('Country clicked:', countryName, 'Code:', countryCode)
          onCountryClick(countryCode as string)
          // Update the style immediately after click
          setTimeout(() => {
            layer.setStyle(getCountryStyle(feature))
          }, 0)
        } else {
          console.warn('No country code found for:', countryName)
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

  // Re-style all layers when visitedCountries changes
  useEffect(() => {
    console.log('Visited countries updated:', visitedCountries)
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
            ref={geoJsonRef}
            data={geoData}
            style={getCountryStyle}
            onEachFeature={onEachCountry}
          />
        </MapContainer>
      </div>
    </div>
  )
}
