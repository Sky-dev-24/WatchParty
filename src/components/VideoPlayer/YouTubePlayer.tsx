/**
 * YouTube Player Component
 *
 * Wrapper around YouTube IFrame Player API
 * Implements VideoPlayerHandle interface for watch party sync.
 */

"use client";

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";
import type {
  VideoPlayerProps,
  VideoPlayerHandle,
  YouTubePlayerState,
} from "./types";

// YouTube IFrame API types
interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => YouTubePlayerState;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
}

interface YouTubePlayerEvent {
  target: YouTubePlayer;
  data: number;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          videoId: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: YouTubePlayerEvent) => void;
            onStateChange?: (event: YouTubePlayerEvent) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YouTubePlayer;
      PlayerState: typeof YouTubePlayerState;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YouTubePlayerComponent = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  (props, ref) => {
    const {
      videoId,
      autoplay = false,
      muted = false,
      onReady,
      onPlay,
      onPause,
      onSeek,
      onTimeUpdate,
      onError,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YouTubePlayer | null>(null);
    const [apiReady, setApiReady] = useState(false);
    const [playerReady, setPlayerReady] = useState(false);
    const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastStateRef = useRef<number>(-1);

    // Load YouTube IFrame API
    useEffect(() => {
      if (window.YT && window.YT.Player) {
        setApiReady(true);
        return;
      }

      // Load the IFrame Player API code asynchronously
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      // API will call this when ready
      window.onYouTubeIframeAPIReady = () => {
        setApiReady(true);
      };
    }, []);

    // Initialize player when API is ready
    useEffect(() => {
      if (!apiReady || !containerRef.current || playerRef.current) return;

      const playerId = `youtube-player-${Math.random().toString(36).substr(2, 9)}`;
      containerRef.current.id = playerId;

      const player = new window.YT.Player(playerId, {
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          fs: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            console.log("[YouTube] Player ready");
            playerRef.current = event.target;
            setPlayerReady(true);

            if (muted) {
              event.target.mute();
            }

            if (onReady) onReady();

            // Start time update interval
            timeUpdateIntervalRef.current = setInterval(() => {
              if (playerRef.current) {
                const currentTime = playerRef.current.getCurrentTime();
                if (onTimeUpdate) onTimeUpdate(currentTime);
              }
            }, 250); // YouTube API has ~250ms precision
          },
          onStateChange: (event) => {
            const state = event.data;
            console.log("[YouTube] State changed:", state);

            // Detect play
            if (state === 1 && lastStateRef.current !== 1) {
              if (onPlay) onPlay();
            }

            // Detect pause
            if (state === 2 && lastStateRef.current !== 2) {
              if (onPause) onPause();
            }

            lastStateRef.current = state;
          },
          onError: (event) => {
            console.error("[YouTube] Player error:", event.data);
            const errorMessages: Record<number, string> = {
              2: "Invalid video ID",
              5: "HTML5 player error",
              100: "Video not found or private",
              101: "Video not allowed to be embedded",
              150: "Video not allowed to be embedded",
            };

            const message =
              errorMessages[event.data] || `Unknown error: ${event.data}`;
            if (onError) onError(message);
          },
        },
      });

      playerRef.current = player;

      return () => {
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current);
        }
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }
      };
    }, [apiReady, videoId, autoplay, muted, onReady, onPlay, onPause, onError, onTimeUpdate]);

    // Expose player controls via ref
    useImperativeHandle(
      ref,
      () => ({
        play: async () => {
          if (playerRef.current) {
            playerRef.current.playVideo();
          }
        },
        pause: () => {
          if (playerRef.current) {
            playerRef.current.pauseVideo();
          }
        },
        seek: (time: number) => {
          if (playerRef.current) {
            playerRef.current.seekTo(time, true);
            if (onSeek) onSeek(time);
          }
        },
        getCurrentTime: () => {
          return playerRef.current?.getCurrentTime() || 0;
        },
        getDuration: () => {
          return playerRef.current?.getDuration() || 0;
        },
        isPaused: () => {
          if (!playerRef.current) return true;
          const state = playerRef.current.getPlayerState();
          return state !== 1 && state !== 3; // Not playing or buffering
        },
        setVolume: (volume: number) => {
          if (playerRef.current) {
            playerRef.current.setVolume(Math.max(0, Math.min(100, volume)));
          }
        },
        getVolume: () => {
          return playerRef.current?.getVolume() || 0;
        },
      }),
      [onSeek]
    );

    return (
      <div className="youtube-player-container w-full h-full">
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ aspectRatio: "16/9" }}
        />
        {!apiReady && (
          <div className="flex items-center justify-center w-full h-full bg-gray-900">
            <div className="text-white">Loading YouTube player...</div>
          </div>
        )}
      </div>
    );
  }
);

YouTubePlayerComponent.displayName = "YouTubePlayer";

export default YouTubePlayerComponent;
