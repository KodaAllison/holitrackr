# HoliTrackr 🌍

A web application for tracking and visualizing the countries you've visited on an interactive world map.

## Features

- Interactive world map with GeoJSON country boundaries
- Click to mark countries as visited
- Color-coded visualization of your travel history
- Local storage persistence
- Beautiful, modern UI

## Tech Stack

- React + TypeScript
- Leaflet + React-Leaflet
- Vite
- Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/KodaAllison/holitrackr.git
cd holitrackr

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
npm run preview
```

## How to Use

1. Click on any country on the map to mark it as visited
2. Visited countries will turn green
3. Click again to unmark
4. Your progress is shown in the stats bar at the top

## License

MIT
