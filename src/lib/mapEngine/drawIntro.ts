import { geoDistance, geoOrthographic, geoPath } from 'd3-geo'
import type { VisitedCountry } from '../../types'
import type { IndexedCountry } from './countryIndex'
import { MAP_COLORS } from './palette'

type Status = VisitedCountry['status']

/**
 * One frame of the startup intro: a dark globe that spins in, the user's
 * countries lighting up, then the whole scene easing into the light map's
 * colours so the interactive globe can take over on the last frame.
 */
export interface IntroFrame {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  dpr: number
  cx: number
  cy: number
  radius: number
  rotate: [number, number]
  countries: IndexedCountry[]
  statusOf: (c: IndexedCountry) => Status | undefined
  /** 0-1 fill per marked country. */
  fillOf: (c: IndexedCountry) => number
  /** 0 = dark intro palette, 1 = the light map palette. */
  light: number
  hatch: CanvasPattern | null
}

const DARK = { background: '#0B1220', ocean: '#15294A', land: '#2A4468', border: '#1A3050' }
const LIGHT = { background: '#FFFFFF', ocean: MAP_COLORS.ocean, land: MAP_COLORS.land, border: MAP_COLORS.border }

/** Mix two #RRGGBB colours. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) + ((((pb >> shift) & 255) - ((pa >> shift) & 255)) * t))
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`
}

export function drawIntro(f: IntroFrame) {
  const { ctx, cx, cy, radius, light } = f
  const color = (k: keyof typeof DARK) => mixHex(DARK[k], LIGHT[k], light)
  ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0)
  ctx.fillStyle = color('background')
  ctx.fillRect(0, 0, f.width, f.height)

  const projection = geoOrthographic().translate([cx, cy]).scale(radius).rotate(f.rotate).clipAngle(90).precision(0.6)
  const path = geoPath(projection, ctx)
  const facing: [number, number] = [-f.rotate[0], -f.rotate[1]]

  ctx.save()
  ctx.shadowColor = `rgba(96,165,250,${0.35 * (1 - light)})`
  ctx.shadowBlur = 60 * (1 - light)
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI)
  ctx.fillStyle = color('ocean')
  ctx.fill()
  ctx.restore()

  const land = color('land')
  const border = color('border')
  for (const c of f.countries) {
    if (geoDistance(c.anchor, facing) - c.reach > Math.PI / 2) continue
    ctx.beginPath()
    path(c.feature)
    ctx.fillStyle = land
    ctx.fill()
    const status = f.statusOf(c)
    const amount = status ? f.fillOf(c) : 0
    if (amount > 0) {
      ctx.globalAlpha = amount
      ctx.fillStyle = status === 'visited' ? MAP_COLORS.visited : MAP_COLORS.bucket
      ctx.fill()
      if (status === 'bucketlist' && f.hatch) {
        ctx.fillStyle = f.hatch
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    ctx.strokeStyle = border
    ctx.lineWidth = 0.6
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI)
  ctx.strokeStyle = border
  ctx.lineWidth = 1
  ctx.stroke()
}
