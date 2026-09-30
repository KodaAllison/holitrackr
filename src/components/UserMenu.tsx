import { useEffect, useState } from 'react'
import { authClient } from '../lib/auth-client'

interface UserMenuProps {
  user: {
    name: string
    email: string
  }
  /** Over the mobile map: a white, shadowed avatar instead of the tinted one. */
  floating?: boolean
}

const LINK = 'hover:text-[#1E293B] hover:underline'

/** The account avatar and its menu (who is signed in, Sign out). */
export default function UserMenu({ user, floating }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase() || '?'

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  const handleSignOut = async () => {
    const { error } = await authClient.signOut()
    if (error) {
      console.error('Sign out failed:', error)
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
        className={`rounded-full text-[15px] font-bold text-[#1D4ED8] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
          floating
            ? 'w-[46px] h-[46px] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.16)]'
            : 'w-11 h-11 bg-[#DBEAFE] hover:bg-[#BFDBFE]'
        }`}
      >
        {initial}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div role="menu" className="absolute right-0 mt-2 w-64 z-50 bg-white rounded-xl border border-[#D7DEE5] shadow-[0_12px_40px_rgba(15,23,42,0.2)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E4E9EE]">
              <p className="font-semibold text-[#1E293B] truncate">{user.name}</p>
              <p className="text-sm text-[#5B6675] truncate">{user.email}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="w-full h-11 text-left px-4 text-sm font-medium text-[#B42318] hover:bg-[#F7F9FB]"
            >
              Sign out
            </button>
            <p className="px-4 py-2.5 border-t border-[#E4E9EE] text-xs text-[#5B6675]">
              MyAtlas by Koda Allison ·{' '}
              <a href="https://www.linkedin.com/in/koda-allison" target="_blank" rel="noopener noreferrer" className={LINK}>LinkedIn</a>
              {' · '}
              <a href="https://koda-allison-portfolio.vercel.app/" target="_blank" rel="noopener noreferrer" className={LINK}>Portfolio</a>
            </p>
          </div>
        </>
      )}
    </div>
  )
}
