interface StatsProps {
  visitedCount: number
}

export default function Stats({ visitedCount }: StatsProps) {
  const totalCountries = 195 // Total UN recognized countries
  const percentage = ((visitedCount / totalCountries) * 100).toFixed(1)

  return (
    <div className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-around">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{visitedCount}</p>
            <p className="text-gray-600 text-sm">Countries Visited</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{percentage}%</p>
            <p className="text-gray-600 text-sm">of World Explored</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-600">{totalCountries - visitedCount}</p>
            <p className="text-gray-600 text-sm">Countries Remaining</p>
          </div>
        </div>
      </div>
    </div>
  )
}
