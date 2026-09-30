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
    <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
      <span className="font-medium">{formatVisitMonth(visitedAt) ?? 'No date yet'}</span>
      {place && <span className="text-gray-500"> · {place}</span>}
      {rating && <span className="ml-1 text-xs text-amber-400" aria-label={`${rating} out of 5`}>{'★'.repeat(rating)}</span>}
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
  const row = 'flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2'
  const action = 'text-xs font-medium disabled:opacity-40'

  return (
    <section aria-label="Visits" className="space-y-2 border-t border-gray-100 pt-4">
      <h3 className="text-sm font-semibold text-gray-700">
        Visits <span className="font-normal text-gray-400">({visits.length + 1})</span>
      </h3>
      <ol className="space-y-2">
        <li className={row}>
          <Summary visitedAt={country.visitedAt} place={country.place} rating={country.rating} />
          <span className="text-xs text-gray-400">First visit · above</span>
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
                  <span role="status" className="text-xs text-gray-400">Saving…</span>
                ) : (
                  <>
                    <button type="button" className={`${action} text-blue-600 hover:text-blue-700`} disabled={editing !== null}
                      aria-label={`Edit visit, ${formatVisitMonth(visit.visitedAt)}`} onClick={() => setEditing(visit.id)}>
                      Edit
                    </button>
                    <button type="button" className={`${action} text-red-600 hover:text-red-700`}
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
          className="w-full rounded-lg border border-dashed border-blue-300 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-40"
        >
          + Add another visit
        </button>
      )}
    </section>
  )
}
