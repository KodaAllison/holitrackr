import { useState } from 'react'

interface StarRatingProps {
  value: number | undefined
  onChange: (rating: number | undefined) => void
}

const STAR = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'

/** Five 40×44 star buttons; clicking the current rating clears it. */
export default function StarRating({ value, onChange }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const shown = hovered ?? value ?? 0

  return (
    <div role="radiogroup" aria-label="Rating" className="-ml-2 flex h-11 items-center" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map(star => {
        const filled = star <= shown
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={star === 1 ? '1 star' : `${star} stars`}
            onMouseEnter={() => setHovered(star)}
            onClick={() => onChange(value === star ? undefined : star)}
            className="flex h-11 w-10 items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? '#A86B0C' : 'none'} stroke={filled ? '#A86B0C' : '#5B6675'} strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
              <path d={STAR} />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
