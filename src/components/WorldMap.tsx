import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import { useEffect, useState, useRef } from 'react'
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import type { PathOptions } from 'leaflet'
import type { GeoJSON as LeafletGeoJSON } from 'leaflet'
import type { Country } from '../types'

interface WorldMapProps {
  visitedCountries: string[]
  onCountryClick: (countryCode: string) => void
  onCountriesLoaded?: (countries: Country[]) => void
}

export default function WorldMap({ visitedCountries, onCountryClick, onCountriesLoaded }: WorldMapProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null)
  const geoJsonRef = useRef<LeafletGeoJSON | null>(null)
  const visitedCountriesRef = useRef<string[]>(visitedCountries)
  
  // Keep ref in sync with prop
  useEffect(() => {
    visitedCountriesRef.current = visitedCountries
  }, [visitedCountries])

  useEffect(() => {
    // Load GeoJSON data from a reliable source
    fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
      .then(response => response.json())
      .then(data => {
        console.log('GeoJSON loaded successfully', data)
        setGeoData(data)
        
        // Extract country list for search
        if (onCountriesLoaded && data.features) {
          const countries = data.features
            .map((feature: any) => ({
              name: feature.properties?.name || feature.properties?.ADMIN || 'Unknown',
              code: feature.properties?.['ISO3166-1-Alpha-3'] || ''
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
    feature?.properties?.['ISO3166-1-Alpha-3'] 
    
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
    const countryCode = feature.properties?.['ISO3166-1-Alpha-3']
    
    // Log first feature to see structure
    if (!countryCode) {
      console.log('Missing code for:', countryName, 'Properties:', feature.properties)
    }
    
    // Bind tooltip that shows automatically on hover
    console.log('Binding tooltip for:', countryName)
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
        // Use ref to get current visited state
        const isCurrentlyVisited = countryCode && visitedCountriesRef.current.includes(countryCode)
        layer.setStyle({
          fillColor: isCurrentlyVisited ? '#10b981' : '#e5e7eb',
          fillOpacity: isCurrentlyVisited ? 0.7 : 0.5,
          weight: 1,
        })
      },
      click: (e: any) => {
        
        if (countryCode) {
          console.log('Country clicked:', countryName, 'Code:', countryCode)
          onCountryClick(countryCode as string)
        } else {
          console.warn('No country code found for:', countryName)
        }
      },
    })
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
