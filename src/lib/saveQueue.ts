/**
 * Serialised, coalescing saves for autosave. At most one save is in flight;
 * values pushed meanwhile wait for it, and only the latest of them is sent
 * next (the ones it replaced settle with its result). So saves reach the
 * server in the order they were made, even on serverless where two
 * concurrent PATCHes could land in either order.
 */
export interface SaveQueue<T> {
  /** Save `values` after any in-flight save; settles with the save that carries them (or later values). */
  push(values: T): Promise<void>
}

interface Waiter {
  resolve: () => void
  reject: (reason: unknown) => void
}

export function createSaveQueue<T>(save: (values: T) => Promise<void>): SaveQueue<T> {
  let busy = false
  let queued: { values: T; waiters: Waiter[] } | null = null

  const run = (values: T): Promise<void> => {
    busy = true
    // new Promise also turns a synchronous throw into a rejection.
    const result = new Promise<void>(resolve => resolve(save(values)))
    const next = () => {
      busy = false
      const waiting = queued
      queued = null
      if (!waiting) return
      const later = run(waiting.values)
      for (const w of waiting.waiters) later.then(w.resolve, w.reject)
    }
    result.then(next, next)
    return result
  }

  return {
    push(values: T): Promise<void> {
      if (!busy) return run(values)
      return new Promise<void>((resolve, reject) => {
        queued = { values, waiters: [...(queued?.waiters ?? []), { resolve, reject }] }
      })
    },
  }
}
