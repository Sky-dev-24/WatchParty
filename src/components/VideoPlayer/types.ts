/**
 * Video Player Types and Interfaces
 *
 * Defines the common interface for all video players (YouTube, Plex)
 * to enable seamless switching and consistent API.
 */

export type VideoSource = "youtube" | "plex";

export interface VideoPlayerProps {
  videoId: string;
  videoUrl?: string;
  autoplay?: boolean;
  muted?: boolean;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
  onTimeUpdate?: (time: number) => void;
  onError?: (error: string) => void;
  // Plex-specific
  plexServerUrl?: string;
  plexToken?: string;
  plexClientId?: string;
  plexSessionId?: string;
}

export interface VideoPlayerHandle {
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isPaused: () => boolean;
  setVolume: (volume: number) => void; // 0-100
  getVolume: () => number;
}

export interface VideoMetadata {
  title?: string;
  duration?: number;
  thumbnail?: string;
}

/**
 * YouTube Player States
 * Based on YouTube IFrame Player API
 */
export enum YouTubePlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 5,
}

/**
 * Plex Video Quality Options
 */
export enum PlexQuality {
  ORIGINAL = "original",
  HIGH_1080P = "1080p",
  MEDIUM_720P = "720p",
  LOW_480P = "480p",
}
