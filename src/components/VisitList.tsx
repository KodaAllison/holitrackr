import { useState } from 'react'
import type { CountryVisit, VisitedCountry } from '../types'
import { isPendingVisit, visitValuesOf } from '../lib/countryVisits'
import type { JournalValues } from '../lib/journal'
import { formatVisitMonth } from '../lib/visitDate'
import VisitEditor from './VisitEditor'

interface VisitListProps {
  country: VisitedCountry
  onAdd: (values: JournalValues) => void
  onUpdate: (id: number, values: JournalValues) => void
  onRemove: (id: number) => void
}

const EMPTY: JournalValues = { notes: '', place: '', visitedAt: '', rating: undefined, tags: [] }

function Summary({ visitedAt, place, rating }: Pick<CountryVisit, 'place' | 'rating'> & { visitedAt?: string }) {
  return (
    <span className="min-w-0 flex-1 truncate text-sm text-[#1E293B]">
      <span className="font-medium">{formatVisitMonth(visitedAt) ?? 'No date yet'}</span>
      {place && <span className="text-[#5B6675]"> · {place}</span>}
      {rating && <span className="ml-1 text-xs text-[#A86B0C]" aria-label={`${rating} out of 5`}>{'★'.repeat(rating)}</span>}
    </span>
  )
}

/**
 * A visited country's visits: the first one (the journal above) and any
 * extra visits, each with its own journal, plus "Add another visit".
 */
export default function VisitList({ country, onAdd, onUpdate, onRemove }: VisitListProps) {
  // Which form is open: a new visit, an existing visit's id, or none.
  const [editing, setEditing] = useState<'new' | number | null>(null)
  const visits = country.visits ?? []
  const row = 'flex min-h-11 items-center gap-3 rounded-lg border border-[#C7D0D9] px-3 py-2'
  const action = 'text-[13px] font-medium hover:underline disabled:opacity-40 disabled:no-underline'

  return (
    <section aria-label="Visits" className="flex flex-col gap-2 border-t border-[#E4E9EE] pt-4">
      <h3 className="text-[15px] font-bold text-[#1E293B]">
        Visits <span className="font-normal text-[#5B6675]">({visits.length + 1})</span>
      </h3>
      <ol className="space-y-2">
        <li className={row}>
          <Summary visitedAt={country.visitedAt} place={country.place} rating={country.rating} />
          <span className="text-[13px] text-[#5B6675]">First visit · above</span>
        </li>
        {visits.map(visit => (
          <li key={visit.id}>
            {editing === visit.id ? (
              <VisitEditor
                initial={visitValuesOf(visit)}
                idPrefix={`visit-${visit.id}`}
                saveLabel="Save visit"
                onSave={values => { onUpdate(visit.id, values); setEditing(null) }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className={row}>
                <Summary visitedAt={visit.visitedAt} place={visit.place} rating={visit.rating} />
                {isPendingVisit(visit.id) ? (
                  <span role="status" className="text-[13px] text-[#5B6675]">Saving…</span>
                ) : (
                  <>
                    <button type="button" className={`${action} text-[#2563EB]`} disabled={editing !== null}
                      aria-label={`Edit visit, ${formatVisitMonth(visit.visitedAt)}`} onClick={() => setEditing(visit.id)}>
                      Edit
                    </button>
                    <button type="button" className={`${action} text-[#B42318]`}
                      aria-label={`Remove visit, ${formatVisitMonth(visit.visitedAt)}`} onClick={() => onRemove(visit.id)}>
                      Remove
                    </button>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      {editing === 'new' ? (
        <VisitEditor
          initial={EMPTY}
          idPrefix="visit-new"
          saveLabel="Add visit"
          onSave={values => { onAdd(values); setEditing(null) }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          disabled={editing !== null}
          onClick={() => setEditing('new')}
          className="h-10 w-full rounded-lg border border-dashed border-[#C7D0D9] text-sm font-medium text-[#2563EB] hover:border-[#2563EB] hover:bg-[#F5F8FF] disabled:opacity-40"
        >
          + Add another visit
        </button>
      )}
    </section>
  )
}
