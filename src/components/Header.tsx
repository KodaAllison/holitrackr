import UserMenu from './UserMenu'

interface HeaderProps {
  user?: { name: string; email: string }
}

export default function Header({ user }: HeaderProps) {
  return (
    <header className="bg-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🌍 MyAtlas</h1>
          <p className="text-blue-100 mt-1">Track the countries you've visited</p>
        </div>
        {user && <UserMenu user={user} />}
      </div>
    </header>
  )
}
