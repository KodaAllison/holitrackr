# Authentication Setup

This project now uses [Better Auth](https://www.better-auth.com/) for authentication with Google OAuth.

## Features

- Google OAuth authentication (no passwords to manage!)
- User sessions with 7-day expiration
- Secure session management
- User-specific data storage

## Setup Instructions

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. Configure the OAuth consent screen if prompted:
   - User Type: External
   - App name: HoliTrackr (or your preferred name)
   - User support email: your email
   - Developer contact: your email
6. Create OAuth client ID:
   - Application type: **Web application**
   - Name: HoliTrackr
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:5173/api/auth/callback/google`
7. Copy the **Client ID** and **Client Secret**

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` and add your Google credentials:
```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
BETTER_AUTH_URL=http://localhost:5173
```

### 3. Run the App

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

This will start the Express server with Vite middleware on http://localhost:5173

## How It Works

### Backend
- `server.ts`: Express server that handles auth API routes and serves the Vite app
- `src/lib/auth.ts`: Better Auth configuration (auto-creates a local database for sessions)

### Frontend
- `src/lib/auth-client.ts`: Client-side auth utilities
- `src/components/AuthForm.tsx`: Google sign-in interface
- `src/components/UserMenu.tsx`: User profile menu
- `src/App.tsx`: Protected routes and session management

### Data Storage
- Each user's visited countries are stored in localStorage with a user-specific key
- Format: `holitrackr-visited-countries-{userId}`
- Better Auth automatically manages a local SQLite database (`auth.db`) for OAuth accounts and sessions

## API Routes

Better Auth provides these endpoints automatically:
- `GET /api/auth/sign-in/google` - Initiate Google OAuth flow
- `GET /api/auth/callback/google` - Google OAuth callback
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/session` - Get current session

## Security

- No password storage required (OAuth only)
- Sessions use secure cookies
- CSRF protection enabled
- XSS protection via React
- OAuth tokens managed by Better Auth

## Production Deployment

When deploying to production:

1. Update your `.env` with production values:
   - Set `BETTER_AUTH_URL` to your production domain
2. Add your production domain to Google OAuth:
   - Authorized JavaScript origins: `https://yourdomain.com`
   - Authorized redirect URIs: `https://yourdomain.com/api/auth/callback/google`
3. Ensure `.env` is not committed to version control (it's in `.gitignore`)
