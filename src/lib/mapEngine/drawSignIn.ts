import { geoDistance, geoOrthographic, geoPath } from 'd3-geo'
import type { IndexedCountry } from './countryIndex'
import { MAP_COLORS } from './palette'
import { isCompact, orbitGeometry, placeSignInCallout } from '../signInCallout'

/**
 * The signed-out "atlas plate": a dark globe in an instrument bezel, the
 * headline orbiting it, and a map-style callout for the country the tour is
 * on. Pure drawing; the caller owns the clock and the tour.
 */
export type DemoStatus = 'visited' | 'bucketlist'

export interface TourStop {
  country: IndexedCountry
  status: DemoStatus
}

export interface SignInFrame {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  dpr: number
  cx: number
  cy: number
  radius: number
  rotate: [number, number]
  countries: IndexedCountry[]
  /** 0-1 fill for each tour stop's country (by key), 0 or missing for others. */
  fillOf: (c: IndexedCountry) => { status: DemoStatus; amount: number } | null
  hatch: CanvasPattern | null
  /** Radians the orbiting headline has turned. */
  orbit: number
  callout: { stop: TourStop; alpha: number } | null
  /** Top of the call to action below the globe; the callout stays above it. */
  ctaTop: number
}

const DARK = {
  ocean: '#15294A',
  land: '#2A4468',
  border: '#1A3050',
  glow: 'rgba(96,165,250,0.35)',
  bezel: 'rgba(148,163,184,0.28)',
  ink: '#F8FAFC',
  muted: '#94A3B8',
}

const HEADLINE = "EVERY COUNTRY YOU'VE BEEN  ✦  EVERY COUNTRY YOU'RE GOING NEXT  ✦  "
const SERIF = '"Instrument Serif", Georgia, serif'
const MONO = '"JetBrains Mono", ui-monospace, monospace'

const DISPLAY_NAMES: Record<string, string> = { 'United States of America': 'United States' }

function drawBezel(f: SignInFrame) {
  const { ctx, cx, cy, radius } = f
  const r = radius + 16
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = DARK.bezel
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, 2 * Math.PI)
  ctx.stroke()
  // Ticks turn with the globe.
  ctx.beginPath()
  for (let d = 0; d < 360; d += 5) {
    const a = ((d + f.rotate[0]) * Math.PI) / 180
    const len = d % 30 === 0 ? 9 : 4
    ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    ctx.lineTo(Math.cos(a) * (r + len), Math.sin(a) * (r + len))
  }
  ctx.stroke()
  ctx.restore()
}

function drawOrbit(f: SignInFrame) {
  const { ctx, cx, cy } = f
  const { radius: r, fontSize: size } = orbitGeometry(f.radius)
  ctx.save()
  ctx.font = `500 ${size}px ${MONO}`
  const charWidth = ctx.measureText('M').width + size * 0.27
  const reps = Math.max(1, Math.round((2 * Math.PI * r) / (charWidth * HEADLINE.length)))
  const text = HEADLINE.repeat(reps)
  const step = (2 * Math.PI) / text.length
  ctx.translate(cx, cy)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === ' ') continue
    const a = f.orbit + i * step
    ctx.save()
    ctx.rotate(a)
    ctx.translate(0, -r)
    // Fade towards the bottom, where letters turn upside down, so the ring
    // reads as passing behind the globe.
    ctx.globalAlpha = 0.12 + 0.88 * Math.pow((Math.cos(a) + 1) / 2, 1.5)
    ctx.fillStyle = ch === '✦' ? '#93C5FD' : 'rgba(203,213,225,0.72)'
    ctx.fillText(ch, 0, 0)
    ctx.restore()
  }
  ctx.restore()
}

function drawCallout(f: SignInFrame, project: (p: [number, number]) => [number, number] | null) {
  if (!f.callout) return
  const { ctx, cx, cy, radius, width } = f
  const { stop, alpha } = f.callout
  const p = project(stop.country.anchor)
  if (!p) return
  const compact = isCompact(radius)
  const name = DISPLAY_NAMES[stop.country.identity.name] ?? stop.country.identity.name
  const [lon, lat] = stop.country.anchor
  const coords = `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'}   ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? 'E' : 'W'}`
  const status = stop.status === 'visited' ? '● VISITED' : '◌ ON THE LIST'
  const nameSize = compact ? 26 : 44
  const baseline = nameSize * 0.28
  const coordsY = baseline + (compact ? 16 : 24)
  const statusY = baseline + (compact ? 30 : 44)
  const nameFont = `italic ${nameSize}px ${SERIF}`
  const monoFont = `500 ${compact ? 9 : 11}px ${MONO}`

  ctx.save()
  // Measure the whole label so it can be kept clear of the ring and on screen.
  ctx.font = nameFont
  const nameWidth = ctx.measureText(name).width
  ctx.font = monoFont
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px'
  const monoWidth = Math.max(ctx.measureText(coords).width, ctx.measureText(status).width)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  const placement = placeSignInCallout(p, { cx, cy, radius, ctaTop: f.ctaTop }, width, {
    width: Math.max(nameWidth, monoWidth, compact ? 130 : 190),
    above: nameSize * 0.5,
    below: statusY + 4,
  })
  const [ex, ey] = placement.elbow

  ctx.globalAlpha = alpha
  ctx.strokeStyle = 'rgba(248,250,252,0.85)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(p[0], p[1])
  ctx.lineTo(ex, ey)
  ctx.lineTo(placement.lineEndX, ey)
  ctx.stroke()
  ctx.fillStyle = DARK.ink
  ctx.beginPath()
  ctx.arc(p[0], p[1], 3.5, 0, 2 * Math.PI)
  ctx.fill()
  ctx.globalAlpha = alpha * 0.5
  ctx.beginPath()
  ctx.arc(p[0], p[1], 9, 0, 2 * Math.PI)
  ctx.stroke()
  ctx.globalAlpha = alpha

  if (placement.plate) {
    // No clear spot on this screen: back the label so it masks the ring.
    const { left, top, right, bottom } = placement.rect
    ctx.fillStyle = 'rgba(11,18,32,0.9)'
    ctx.beginPath()
    ctx.roundRect(left - 8, top - 6, right - left + 16, bottom - top + 12, 8)
    ctx.fill()
  }

  const tx = placement.textX
  ctx.textAlign = placement.align
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = DARK.ink
  ctx.font = nameFont
  ctx.fillText(name, tx, ey + baseline)
  ctx.font = monoFont
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px'
  ctx.fillStyle = DARK.muted
  ctx.fillText(coords, tx, ey + coordsY)
  ctx.fillStyle = stop.status === 'visited' ? '#6EE7B7' : '#FCD34D'
  ctx.fillText(status, tx, ey + statusY)
  ctx.restore()
}

export function drawSignIn(f: SignInFrame) {
  const { ctx, dpr, cx, cy, radius } = f
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, f.width, f.height)

  const projection = geoOrthographic().translate([cx, cy]).scale(radius).rotate(f.rotate).clipAngle(90).precision(0.6)
  const path = geoPath(projection, ctx)
  const facing: [number, number] = [-f.rotate[0], -f.rotate[1]]

  ctx.save()
  ctx.shadowColor = DARK.glow
  ctx.shadowBlur = 60
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI)
  ctx.fillStyle = DARK.ocean
  ctx.fill()
  ctx.restore()

  for (const c of f.countries) {
    if (geoDistance(c.anchor, facing) - c.reach > Math.PI / 2) continue
    ctx.beginPath()
    path(c.feature)
    ctx.fillStyle = DARK.land
    ctx.fill()
    const fill = f.fillOf(c)
    if (fill && fill.amount > 0) {
      ctx.globalAlpha = fill.amount
      ctx.fillStyle = fill.status === 'visited' ? MAP_COLORS.visited : MAP_COLORS.bucket
      ctx.fill()
      if (fill.status === 'bucketlist' && f.hatch) {
        ctx.fillStyle = f.hatch
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    ctx.strokeStyle = fill && fill.amount > 0.5 ? (fill.status === 'visited' ? '#FFFFFF' : MAP_COLORS.bucketOutline) : DARK.border
    ctx.lineWidth = 0.6
    ctx.stroke()
  }

  drawBezel(f)
  drawOrbit(f)
  const visible = f.callout && geoDistance(f.callout.stop.country.anchor, facing) < 1.45
  if (visible) drawCallout(f, p => projection(p))
}
