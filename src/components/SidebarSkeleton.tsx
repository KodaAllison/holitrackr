const ROWS: [number, number][] = [[150, 100], [120, 140], [170, 80], [110, 120], [140, 90]]

/** Placeholder rows while the countries load. */
export default function SidebarSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your countries" className="flex flex-1 flex-col gap-3.5 px-5 pt-1">
      <div className="h-11 rounded-[10px] bg-[#EEF2F6]" />
      <div className="mt-2 h-3 w-[90px] rounded-md bg-[#EEF2F6]" />
      <div className="flex flex-col gap-[22px] pt-1.5">
        {ROWS.map(([name, sub], i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-3.5 rounded-full bg-[#E4E9EE]" style={{ width: name }} />
            <div className="h-2.5 rounded-full bg-[#EEF2F6]" style={{ width: sub }} />
          </div>
        ))}
      </div>
    </div>
  )
}
