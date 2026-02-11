export default function Footer() {
  return (
    <footer className="mt-auto bg-slate-800 text-slate-400 py-4 px-4">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm">
        <span>🌍 HoliTrackr</span>
        <span className="hidden sm:inline">·</span>
        <a
          href="https://www.linkedin.com/in/koda-allison"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white transition-colors"
        >
          LinkedIn
        </a>
        <span className="hidden sm:inline">·</span>
        <a
          href="https://koda-allison-portfolio.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white transition-colors"
        >
          Portfolio
        </a>
      </div>
    </footer>
  )
}
