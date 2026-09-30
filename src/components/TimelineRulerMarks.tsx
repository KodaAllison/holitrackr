import { tripKey, type TimelineModel } from '../lib/timelineModel'
import { BASE, MAX_BAR, PAD } from '../lib/timelineRulerGeometry'

interface TimelineRulerMarksProps {
  model: TimelineModel
  active: number
  width: number
}

const LABEL = { fontSize: 12, fontFamily: 'inherit' } as const

/**
 * The ruler's static marks (drawn inside its SVG): soft per-year bars
 * (green up to the playhead's year), ticks and year labels, the hatched
 * "Next" zone past a dashed "Now" line, bucket-list diamonds and trip dots.
 */
export default function TimelineRulerMarks({ model, active, width }: TimelineRulerMarksProps) {
  const { trips, planned, start, end, now } = model
  const span = Math.max(1, end - start)
  const track = Math.max(1, width - 2 * PAD)
  const x = (at: number) => PAD + ((at - start) / span) * track

  const years: number[] = []
  for (let y = Math.floor(start / 12); y <= Math.floor(end / 12); y++) years.push(y)
  const perYear = new Map<number, number>()
  for (const t of trips) perYear.set(t.year, (perYear.get(t.year) ?? 0) + 1)
  const unit = Math.min(16, MAX_BAR / Math.max(1, ...perYear.values()))
  const time = trips[active]?.at ?? -Infinity
  const currentYear = trips[active]?.year

  // Label every Nth year so labels never collide on narrow screens.
  const labelEvery = Math.max(1, Math.ceil(36 / ((12 / span) * track)))
  const nowX = x(now + 0.5)

  return (
    <>
      <defs>
        <pattern id="timeline-next-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="#F2B24E" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="#C27A0A" strokeWidth="2" />
        </pattern>
      </defs>
      {years.map(y => {
        const count = perYear.get(y) ?? 0
        const xa = x(y * 12)
        const xb = x(y * 12 + 12)
        const isCurrent = y === currentYear
        return (
          <g key={y}>
            {count > 0 && (
              <rect x={xa + 3} y={BASE - count * unit} width={Math.max(2, xb - xa - 6)} height={count * unit}
                fill={y * 12 <= time ? '#CDE8DC' : '#EEF2F6'} />
            )}
            <rect x={xa} y={BASE} width={1} height={8} fill="#94A3B8" />
            {(y - years[0]) % labelEvery === 0 && (
              <text {...LABEL} x={(xa + xb) / 2} y={BASE + 24} textAnchor="middle"
                fill={isCurrent ? '#1E293B' : '#5B6675'} fontWeight={isCurrent ? 700 : 400}>{y}</text>
            )}
          </g>
        )
      })}
      {nowX < width - PAD && (
        <rect x={nowX} y={BASE - 34} width={width - PAD - nowX} height={34} fill="url(#timeline-next-hatch)" opacity={0.35} />
      )}
      <line x1={nowX + 0.5} x2={nowX + 0.5} y1={BASE - 52} y2={BASE + 8} stroke="#5B6675" strokeDasharray="3 3" />
      <text {...LABEL} fontSize={11} fontWeight={600} x={nowX - 5} y={BASE - 42} textAnchor="end" fill="#5B6675">Now</text>
      {planned.length > 0 && (
        <text {...LABEL} fontSize={11} fontWeight={600} x={nowX + 5} y={BASE - 42} fill="#9A5B00">Next</text>
      )}
      <rect x={PAD} y={BASE} width={track} height={1.5} fill="#94A3B8" />
      {planned.map(t => (
        <rect key={`p-${tripKey(t)}`} x={-5} y={-5} width={10} height={10} fill="url(#timeline-next-hatch)" stroke="#9A5B00" strokeWidth={1.5}
          transform={`translate(${x(t.at + 0.5)} ${BASE}) rotate(45)`} />
      ))}
      {trips.map((t, i) => (
        <circle key={tripKey(t)} cx={x(t.at + 0.5)} cy={BASE} r={i === active ? 7 : 5}
          fill={i <= active ? '#0B7A53' : '#FFFFFF'}
          stroke={i === active ? '#2563EB' : '#0B7A53'} strokeWidth={i === active ? 3 : 1.5} />
      ))}
    </>
  )
}
