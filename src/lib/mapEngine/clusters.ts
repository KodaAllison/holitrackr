/**
 * Screen-space clustering for micro-state dots, so tight groups (the
 * Caribbean, the Gulf, Pacific atolls) read as one tappable cluster until the
 * user zooms in far enough to separate them.
 */
export interface Dot<T> {
  item: T
  x: number
  y: number
}

export interface Cluster<T> {
  x: number
  y: number
  members: T[]
}

/**
 * Greedy clustering: each dot joins the first cluster whose centre is within
 * `radius` pixels, else starts a new one. Centres are the running mean of
 * their members. Order-dependent but stable for a given input order.
 */
export function clusterDots<T>(dots: Dot<T>[], radius: number): Cluster<T>[] {
  const clusters: Cluster<T>[] = []
  const r2 = radius * radius
  for (const dot of dots) {
    const hit = clusters.find(c => (c.x - dot.x) ** 2 + (c.y - dot.y) ** 2 <= r2)
    if (hit) {
      const n = hit.members.length
      hit.x = (hit.x * n + dot.x) / (n + 1)
      hit.y = (hit.y * n + dot.y) / (n + 1)
      hit.members.push(dot.item)
    } else {
      clusters.push({ x: dot.x, y: dot.y, members: [dot.item] })
    }
  }
  return clusters
}

/** The cluster within `radius` px of the point, nearest first, or null. */
export function clusterAt<T>(clusters: Cluster<T>[], x: number, y: number, radius: number): Cluster<T> | null {
  let best: Cluster<T> | null = null
  let bestD2 = radius * radius
  for (const c of clusters) {
    const d2 = (c.x - x) ** 2 + (c.y - y) ** 2
    if (d2 <= bestD2) {
      best = c
      bestD2 = d2
    }
  }
  return best
}
