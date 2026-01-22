/**
 * Plex Player Component
 *
 * Video player for Plex media using HTML5 video element.
 * Handles Plex authentication, transcoding, and playback.
 */

"use client";

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";
import type { VideoPlayerProps, VideoPlayerHandle } from "./types";

const PlexPlayerComponent = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  (props, ref) => {
    const {
      videoId,
      plexServerUrl,
      plexToken,
      autoplay = false,
      muted = false,
      onReady,
      onPlay,
      onPause,
      onSeek,
      onTimeUpdate,
      onError,
    } = props;

    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoUrl, setVideoUrl] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");
    const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastTimeRef = useRef<number>(0);

    // Fetch Plex video URL
    useEffect(() => {
      if (!plexServerUrl || !plexToken || !videoId) {
        setError("Missing Plex configuration");
        setLoading(false);
        if (onError) onError("Missing Plex configuration");
        return;
      }

      async function fetchPlexVideo() {
        try {
          setLoading(true);
          setError("");

          // Request transcoded video URL from our API
          // This proxies the Plex request to avoid CORS issues
          const response = await fetch(
            `/api/plex/video/${encodeURIComponent(videoId)}?` +
              new URLSearchParams({
                serverUrl: plexServerUrl!,
                token: plexToken!,
              })
          );

          if (!response.ok) {
            throw new Error("Failed to fetch Plex video");
          }

          const data = await response.json();

          if (!data.url) {
            throw new Error("No playback URL returned");
          }

          setVideoUrl(data.url);
          setLoading(false);

          console.log("[Plex] Video URL loaded");
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to load video";
          console.error("[Plex] Error loading video:", message);
          setError(message);
          setLoading(false);
          if (onError) onError(message);
        }
      }

      fetchPlexVideo();
    }, [videoId, plexServerUrl, plexToken, onError]);

    // Setup video element event listeners
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleLoadedMetadata = () => {
        console.log("[Plex] Video metadata loaded");
        if (onReady) onReady();

        // Start time update reporting
        timeUpdateIntervalRef.current = setInterval(() => {
          if (video && onTimeUpdate) {
            const currentTime = video.currentTime;
            onTimeUpdate(currentTime);
          }
        }, 250);
      };

      const handlePlay = () => {
        console.log("[Plex] Playing");
        if (onPlay) onPlay();
      };

      const handlePause = () => {
        console.log("[Plex] Paused");
        if (onPause) onPause();
      };

      const handleSeeking = () => {
        const currentTime = video.currentTime;
        // Only report if seek was significant (> 1 second change)
        if (Math.abs(currentTime - lastTimeRef.current) > 1) {
          console.log("[Plex] Seeking to", currentTime);
          lastTimeRef.current = currentTime;
          if (onSeek) onSeek(currentTime);
        }
      };

      const handleError = () => {
        const errorMessage = video.error
          ? `Video error: ${video.error.message} (code: ${video.error.code})`
          : "Unknown video error";
        console.error("[Plex]", errorMessage);
        setError(errorMessage);
        if (onError) onError(errorMessage);
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);
      video.addEventListener("seeking", handleSeeking);
      video.addEventListener("error", handleError);

      return () => {
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current);
        }
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("seeking", handleSeeking);
        video.removeEventListener("error", handleError);
      };
    }, [onReady, onPlay, onPause, onSeek, onTimeUpdate, onError]);

    // Expose player controls via ref
    useImperativeHandle(
      ref,
      () => ({
        play: async () => {
          if (videoRef.current) {
            try {
              await videoRef.current.play();
            } catch (err) {
              console.error("[Plex] Play error:", err);
            }
          }
        },
        pause: () => {
          if (videoRef.current) {
            videoRef.current.pause();
          }
        },
        seek: (time: number) => {
          if (videoRef.current) {
            videoRef.current.currentTime = time;
          }
        },
        getCurrentTime: () => {
          return videoRef.current?.currentTime || 0;
        },
        getDuration: () => {
          return videoRef.current?.duration || 0;
        },
        isPaused: () => {
          return videoRef.current?.paused ?? true;
        },
        setVolume: (volume: number) => {
          if (videoRef.current) {
            videoRef.current.volume = Math.max(0, Math.min(100, volume)) / 100;
          }
        },
        getVolume: () => {
          return videoRef.current ? videoRef.current.volume * 100 : 0;
        },
      }),
      []
    );

    if (loading) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-gray-900">
          <div className="text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <div>Loading Plex video...</div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-gray-900">
          <div className="text-center text-white">
            <div className="text-red-500 text-xl mb-2">⚠️</div>
            <div className="font-semibold mb-1">Failed to load video</div>
            <div className="text-sm text-gray-400">{error}</div>
          </div>
        </div>
      );
    }

    return (
      <div className="plex-player-container w-full h-full bg-black">
        <video
          ref={videoRef}
          className="w-full h-full"
          src={videoUrl}
          autoPlay={autoplay}
          muted={muted}
          controls
          playsInline
          style={{ aspectRatio: "16/9" }}
        />
      </div>
    );
  }
);

PlexPlayerComponent.displayName = "PlexPlayer";

export default PlexPlayerComponent;
