/**
 * VideoPlayer Container
 *
 * Main video player component that selects the appropriate player
 * (YouTube or Plex) based on video source type.
 */

"use client";

import { forwardRef } from "react";
import YouTubePlayer from "./YouTubePlayer";
import PlexPlayer from "./PlexPlayer";
import type { VideoPlayerProps, VideoPlayerHandle, VideoSource } from "./types";

export interface VideoPlayerContainerProps extends VideoPlayerProps {
  source: VideoSource;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerContainerProps>(
  (props, ref) => {
    const { source, ...playerProps } = props;

    if (source === "youtube") {
      return <YouTubePlayer ref={ref} {...playerProps} />;
    }

    if (source === "plex") {
      return <PlexPlayer ref={ref} {...playerProps} />;
    }

    return (
      <div className="flex items-center justify-center w-full h-full bg-gray-900">
        <div className="text-white">
          <div className="text-red-500 text-xl mb-2">⚠️</div>
          <div className="font-semibold">Unsupported video source: {source}</div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;
export type { VideoPlayerHandle, VideoPlayerProps, VideoSource };
export { YouTubePlayer, PlexPlayer };
