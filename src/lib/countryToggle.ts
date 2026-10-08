import type { Country, VisitedCountry } from '../types'
import { detectMilestone, type Milestone } from './milestones'
import { nextVisitedState, statusOf, type StatusAction } from './visitedCountries'

/** Everything a status toggle needs, all derived from one `before` list. */
export interface CountryToggle {
  /** The list after the toggle (the optimistic state). */
  next: VisitedCountry[]
  /** What the server must do to match `next`. */
  action: StatusAction
  /** The country's status before the toggle, for Undo (undefined: unmarked). */
  previous: VisitedCountry['status'] | undefined
  /** The milestone this toggle reaches, if any (whether already seen is the caller's call). */
  milestone: Milestone | null
}

/**
 * Plan a status toggle as a pure function of the current list, so the
 * optimistic state, the save and the milestone check can't disagree.
 */
export function planCountryToggle(
  before: VisitedCountry[],
  country: Country,
  explicitStatus?: VisitedCountry['status']
): CountryToggle {
  const { next, action } = nextVisitedState(before, country, explicitStatus)
  return {
    next,
    action,
    previous: statusOf(before, country),
    milestone: detectMilestone(before, next, country),
  }
}
