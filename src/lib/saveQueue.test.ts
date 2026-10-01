import { describe, expect, it } from 'vitest'
import { createSaveQueue } from './saveQueue'

function deferred() {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('createSaveQueue', () => {
  it('sends the first save at once', async () => {
    const sent: string[] = []
    const queue = createSaveQueue(async (v: string) => { sent.push(v) })
    await queue.push('a')
    expect(sent).toEqual(['a'])
  })

  it('waits for the in-flight save and coalesces edits made meanwhile', async () => {
    const sent: string[] = []
    const inFlight: ReturnType<typeof deferred>[] = []
    const queue = createSaveQueue((v: string) => {
      sent.push(v)
      const d = deferred()
      inFlight.push(d)
      return d.promise
    })
    const first = queue.push('a')
    const second = queue.push('b')
    const third = queue.push('c')
    await flush()
    expect(sent).toEqual(['a'])

    inFlight[0].resolve()
    await first
    await flush()
    expect(sent).toEqual(['a', 'c'])

    let settled = false
    void Promise.all([second, third]).then(() => { settled = true })
    await flush()
    expect(settled).toBe(false)
    inFlight[1].resolve()
    await Promise.all([second, third])
    expect(settled).toBe(true)
  })

  it('still sends queued values after a failed save, and reports each result', async () => {
    const sent: string[] = []
    const inFlight: ReturnType<typeof deferred>[] = []
    const queue = createSaveQueue((v: string) => {
      sent.push(v)
      const d = deferred()
      inFlight.push(d)
      return d.promise
    })
    const first = queue.push('a')
    const second = queue.push('b')
    inFlight[0].reject(new Error('offline'))
    await expect(first).rejects.toThrow('offline')
    await flush()
    expect(sent).toEqual(['a', 'b'])
    inFlight[1].reject(new Error('still offline'))
    await expect(second).rejects.toThrow('still offline')
  })

  it('turns a synchronous throw into a rejection and stays usable', async () => {
    let fail = true
    const queue = createSaveQueue((): Promise<void> => {
      if (fail) throw new Error('boom')
      return Promise.resolve()
    })
    await expect(queue.push('a')).rejects.toThrow('boom')
    await flush()
    fail = false
    await expect(queue.push('b')).resolves.toBeUndefined()
  })
})
