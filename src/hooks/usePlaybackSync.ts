/**
 * usePlaybackSync Hook
 *
 * Handles synchronization of video playback to host's state.
 * Manages drift detection and correction for watch party sync.
 */

import { useEffect, useRef, useCallback } from "react";
import type { PlaybackState } from "@/lib/socket-server";

export interface VideoPlayerControl {
  play: () => Promise<void> | void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  isPaused: () => boolean;
}

export interface UsePlaybackSyncOptions {
  player: VideoPlayerControl | null;
  isHost: boolean;
  onPlaybackChange?: (isPlaying: boolean, position: number) => void;
  driftTolerance?: number; // seconds
  syncInterval?: number; // milliseconds
}

export function usePlaybackSync(options: UsePlaybackSyncOptions) {
  const {
    player,
    isHost,
    onPlaybackChange,
    driftTolerance = 0.5, // YouTube has ~250ms precision, use 500ms tolerance
    syncInterval = 2000, // Check sync every 2 seconds
  } = options;

  const lastStateRef = useRef<PlaybackState | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);

  /**
   * Apply playback state from host
   */
  const applyPlaybackState = useCallback(
    async (state: PlaybackState) => {
      if (!player || isHost || isSyncingRef.current) return;

      isSyncingRef.current = true;

      try {
        const currentTime = player.getCurrentTime();
        const isPaused = player.isPaused();

        // Calculate expected position based on state timestamp
        const elapsed = (Date.now() - state.timestamp) / 1000;
        const expectedPosition = state.isPlaying
          ? state.currentPosition + elapsed
          : state.currentPosition;

        // Check if we need to seek
        const drift = Math.abs(currentTime - expectedPosition);
        const needsSeek = drift > driftTolerance;

        // Sync playing/paused state
        if (state.isPlaying && isPaused) {
          if (needsSeek) {
            player.seek(expectedPosition);
          }
          await player.play();
          console.log(`[Sync] Playing at ${expectedPosition.toFixed(2)}s`);
        } else if (!state.isPlaying && !isPaused) {
          player.pause();
          if (needsSeek) {
            player.seek(expectedPosition);
          }
          console.log(`[Sync] Paused at ${expectedPosition.toFixed(2)}s`);
        } else if (needsSeek) {
          // Same playing state, but drifted too far
          player.seek(expectedPosition);
          console.log(
            `[Sync] Corrected drift: ${drift.toFixed(2)}s to ${expectedPosition.toFixed(2)}s`
          );
        }

        lastStateRef.current = state;
      } catch (error) {
        console.error("[Sync] Error applying playback state:", error);
      } finally {
        isSyncingRef.current = false;
      }
    },
    [player, isHost, driftTolerance]
  );

  /**
   * Periodic sync check
   */
  useEffect(() => {
    if (!player || isHost || !lastStateRef.current) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }

    // Periodically check if we're still in sync
    syncIntervalRef.current = setInterval(() => {
      const state = lastStateRef.current;
      if (!state || isSyncingRef.current) return;

      const currentTime = player.getCurrentTime();
      const isPaused = player.isPaused();

      // Calculate expected position
      const elapsed = (Date.now() - state.timestamp) / 1000;
      const expectedPosition = state.isPlaying
        ? state.currentPosition + elapsed
        : state.currentPosition;

      // Check drift
      const drift = Math.abs(currentTime - expectedPosition);

      if (drift > driftTolerance) {
        console.log(`[Sync] Drift detected: ${drift.toFixed(2)}s, correcting...`);
        applyPlaybackState(state);
      }

      // Check playing state mismatch
      if (state.isPlaying !== !isPaused) {
        console.log("[Sync] Playing state mismatch, correcting...");
        applyPlaybackState(state);
      }
    }, syncInterval);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [player, isHost, syncInterval, driftTolerance, applyPlaybackState]);

  /**
   * Report playback changes to host (if host)
   */
  const reportPlaybackChange = useCallback(
    (isPlaying: boolean, position: number) => {
      if (!isHost || !onPlaybackChange) return;
      onPlaybackChange(isPlaying, position);
    },
    [isHost, onPlaybackChange]
  );

  return {
    applyPlaybackState,
    reportPlaybackChange,
  };
}
