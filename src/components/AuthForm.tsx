import { useState } from 'react';
import { authClient } from '../lib/auth-client';

export default function AuthForm() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to HoliTrackr
        </h2>
        <p className="text-gray-600">
          Track your travel adventures around the world
        </p>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <img
          src="https://developers.google.com/identity/gsi/web/images/logo/google.svg"
          alt=""
          className="w-5 h-5"
          width={20}
          height={20}
        />
        <span className="text-gray-700 font-medium">
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </span>
      </button>

      <p className="mt-6 text-center text-sm text-gray-500">
        By signing in, you agree to track your travels securely
      </p>
    </div>
  );
}
