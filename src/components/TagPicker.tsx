import { useState } from 'react'
import { PRESET_TAGS } from '../lib/journal'

interface TagPickerProps {
  tags: string[]
  onToggle: (tag: string) => void
}

/** How many preset tags show before "More…". */
const FIRST = 6

/** Tag chips: the first few presets (plus any chosen ones), then "More…". */
export default function TagPicker({ tags, onToggle }: TagPickerProps) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? PRESET_TAGS : PRESET_TAGS.filter((tag, i) => i < FIRST || tags.includes(tag))
  const hidden = PRESET_TAGS.length - shown.length

  return (
    <div role="group" aria-label="Tags" className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-[#334155]">Tags</span>
      <div className="flex flex-wrap gap-1.5">
        {shown.map(tag => {
          const on = tags.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(tag)}
              className={`h-8 rounded-2xl border px-3 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1 ${
                on ? 'border-[#2563EB] bg-[#2563EB] font-medium text-white' : 'border-[#C7D0D9] bg-white text-[#334155] hover:border-[#2563EB]'
              }`}
            >
              {tag}
            </button>
          )
        })}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label={`Show ${hidden} more tags`}
            className="h-8 rounded-2xl border border-dashed border-[#C7D0D9] bg-white px-3 text-[13px] text-[#5B6675] hover:border-[#2563EB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          >
            More…
          </button>
        )}
      </div>
    </div>
  )
}
