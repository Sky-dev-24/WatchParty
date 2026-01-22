/**
 * PlexAuthButton Component
 *
 * Handles Plex OAuth authentication flow with PIN display.
 */

"use client";

import { useState } from "react";

interface PlexAuthButtonProps {
  onAuthenticated: () => void;
}

export default function PlexAuthButton({ onAuthenticated }: PlexAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [pinId, setPinId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      // Request PIN
      const response = await fetch("/api/plex/auth/start", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to start authentication");
      }

      const data = await response.json();
      setAuthUrl(data.authUrl);
      setPinCode(data.code);
      setPinId(data.pinId);

      // Open auth window
      window.open(data.authUrl, "_blank", "width=600,height=700");

      // Start polling for auth status
      pollAuthStatus(data.pinId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setLoading(false);
    }
  };

  const pollAuthStatus = async (id: number) => {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setError("Authentication timeout. Please try again.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/plex/auth/check?pinId=${id}`);
        const data = await response.json();

        if (data.authorized) {
          setLoading(false);
          onAuthenticated();
        } else {
          attempts++;
          setTimeout(poll, 5000); // Poll every 5 seconds
        }
      } catch (err) {
        setError("Failed to check authentication status");
        setLoading(false);
      }
    };

    poll();
  };

  return (
    <div className="space-y-4">
      {!authUrl ? (
        <button
          onClick={startAuth}
          disabled={loading}
          className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              Connect Plex Account
            </>
          )}
        </button>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
          <div className="mb-4">
            <div className="text-sm text-gray-400 mb-2">Enter this PIN on Plex:</div>
            <div className="text-4xl font-bold text-orange-500 tracking-widest">
              {pinCode}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-400">
              Waiting for authorization...
            </span>
          </div>

          <a
            href={authUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Open Plex Authorization Page
          </a>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
