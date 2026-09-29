import { useEffect, useState } from 'react'
import type { Country } from '../../types'
import { loadWorld } from '../worldAtlas'
import { buildCountryIndex, type IndexedCountry } from './countryIndex'

/**
 * Loads the world at both levels of detail and indexes it. The atlas files
 * are fetched once per session (loadWorld caches), so every map on the page
 * can call this.
 */
export function useWorldCountries(onCountriesLoaded?: (countries: Country[]) => void) {
  const [countries, setCountries] = useState<IndexedCountry[] | null>(null)
  const [motionCountries, setMotionCountries] = useState<IndexedCountry[] | null>(null)
  const [failed, setFailed] = useState(false)

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

  return { countries, motionCountries, failed }
}
