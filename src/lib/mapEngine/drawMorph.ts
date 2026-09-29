import { geoPath } from 'd3-geo'
import type { VisitedCountry } from '../../types'
import type { IndexedCountry } from './countryIndex'
import { ease, type Rotation } from './globeMotion'
import { createMorphProjection, morphRaw } from './morph'
import { MAP_COLORS } from './palette'

type Status = VisitedCountry['status']

export interface MorphFrame {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  dpr: number
  /** 0 = globe, 1 = flat. */
  t: number
  globe: { rotate: Rotation; scale: number; translate: [number, number] }
  flat: { scale: number; translate: [number, number] }
  countries: IndexedCountry[]
  statusOf: (c: IndexedCountry) => Status | undefined
  hatch: CanvasPattern | null
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

const morph = createMorphProjection()

/**
 * The projected sphere's outline, traced along the (rotated) antimeridian in
 * raw space. d3's own Sphere outline joins only a few points there, which
 * turns into a diamond for this blended projection.
 */
function traceOutline(ctx: CanvasRenderingContext2D, t: number, scale: number, [tx, ty]: [number, number]) {
  const raw = morphRaw(t)
  const edge = Math.PI - 1e-6
  ctx.beginPath()
  for (let deg = -90; deg <= 90; deg += 2) {
    const [x, y] = raw(edge, (deg * Math.PI) / 180)
    if (deg === -90) ctx.moveTo(tx + scale * x, ty - scale * y)
    else ctx.lineTo(tx + scale * x, ty - scale * y)
  }
  for (let deg = 90; deg >= -90; deg -= 2) {
    const [x, y] = raw(-edge, (deg * Math.PI) / 180)
    ctx.lineTo(tx + scale * x, ty - scale * y)
  }
  ctx.closePath()
}

/**
 * One frame of the globe ⇄ flat unroll. The far hemisphere unfolds as a ring
 * around the globe and fades in over the first quarter; the near hemisphere
 * is drawn clipped on top until then, so the globe itself never flickers.
 */
export function drawMorph(f: MorphFrame) {
  const { ctx, t } = f
  morph.setT(t)
  const projection = morph.projection
    .scale(lerp(f.globe.scale, f.flat.scale, t))
    .translate([lerp(f.globe.translate[0], f.flat.translate[0], t), lerp(f.globe.translate[1], f.flat.translate[1], t)])
    // The flat map is unrotated; longitude is already wrapped, so this is the short way.
    .rotate([lerp(f.globe.rotate[0], 0, t), lerp(f.globe.rotate[1], 0, t)])
    .precision(0.7)
    .clipAngle(null)
  const path = geoPath(projection, ctx)

  ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0)
  ctx.clearRect(0, 0, f.width, f.height)

  // Ocean: the globe's disc fades out as the unrolled sphere fades in.
  const ring = clamp01(t / 0.25)
  const disc = 1 - clamp01(t / 0.5)
  if (disc > 0) {
    ctx.globalAlpha = disc
    ctx.beginPath()
    ctx.arc(projection.translate()[0], projection.translate()[1], projection.scale(), 0, 2 * Math.PI)
    ctx.fillStyle = MAP_COLORS.ocean
    ctx.fill()
  }
  ctx.globalAlpha = ease(ring)
  traceOutline(ctx, t, projection.scale(), projection.translate())
  ctx.fillStyle = MAP_COLORS.ocean
  ctx.fill()
  ctx.globalAlpha = 1

  const paint = (alpha: number) => {
    ctx.globalAlpha = alpha
    for (const c of f.countries) {
      ctx.beginPath()
      path(c.feature)
      const status = f.statusOf(c)
      ctx.fillStyle = status === 'visited' ? MAP_COLORS.visited : status === 'bucketlist' ? MAP_COLORS.bucket : MAP_COLORS.land
      ctx.fill()
      if (status === 'bucketlist' && f.hatch) {
        ctx.fillStyle = f.hatch
        ctx.fill()
      }
      ctx.strokeStyle = MAP_COLORS.border
      ctx.lineWidth = 0.6
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  if (ring > 0) paint(ring)
  if (ring < 1) {
    projection.clipAngle(90)
    paint(1)
    projection.clipAngle(null)
  }
}
