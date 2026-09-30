interface StatusSwatchProps {
  status: 'visited' | 'bucketlist'
  /** 10px (mobile chip) instead of 14px. */
  small?: boolean
}

/** A square key for the map colours: solid green, or the hatched amber of the bucket list. */
export default function StatusSwatch({ status, small }: StatusSwatchProps) {
  const size = small ? 'w-2.5 h-2.5 rounded-sm' : 'w-3.5 h-3.5 rounded-[3px]'
  return status === 'visited' ? (
    <span aria-hidden="true" className={`${size} shrink-0 bg-[#0B7A53]`} />
  ) : (
    <span
      aria-hidden="true"
      className={`${size} shrink-0 box-border border border-[#9A5B00] bg-[repeating-linear-gradient(45deg,#C27A0A_0_2px,#F2B24E_2px_6px)]`}
    />
  )
}
