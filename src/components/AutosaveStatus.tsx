export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'failed'

interface AutosaveStatusProps {
  state: SaveState
  onRetry: () => void
}

/** "✓ Saved" on the left, "Changes save automatically" on the right. */
export default function AutosaveStatus({ state, onRetry }: AutosaveStatusProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px] text-[#5B6675]">
      {state === 'failed' ? (
        <span role="alert" className="text-[#B42318]">
          Couldn't save.{' '}
          <button type="button" onClick={onRetry} className="font-semibold underline">Try again</button>
        </span>
      ) : (
        <span role="status" className="flex items-center gap-1.5">
          {state === 'pending' || state === 'saving' ? 'Saving…' : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B7A53" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5L20 7" />
              </svg>
              Saved
            </>
          )}
        </span>
      )}
      <span>Changes save automatically</span>
    </div>
  )
}
