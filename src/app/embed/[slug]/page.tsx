/**
 * Watch Party Embed Page
 *
 * Embeddable watch party room (minimal UI, no chat/participant list)
 */

import { cache } from "react";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import VideoPlayer from "@/components/VideoPlayer";

// ISR: Regenerate every 60 seconds
export const revalidate = 60;

const getRoom = cache(async (slug: string) => {
  try {
    return await prisma.room.findUnique({
      where: { slug },
    });
  } catch (error) {
    console.error("Failed to fetch room:", error);
    return null;
  }
});

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EmbedPage({ params }: PageProps) {
  const { slug } = await params;
  const room = await getRoom(slug);

  if (!room) {
    notFound();
  }

  if (!room.isPublic && !room.isPersistent) {
    return (
      <div className="w-full h-full min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-xl font-bold mb-2 text-white">Room Unavailable</h1>
          <p className="text-gray-400 text-sm">
            This watch party room cannot be embedded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-7xl aspect-video">
        <VideoPlayer
          source={room.videoType as "youtube" | "plex"}
          videoId={room.videoId}
          videoUrl={room.videoUrl ?? undefined}
        />
      </div>
      <div className="absolute bottom-4 left-4 text-white/70 text-sm">
        {room.name}
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const room = await getRoom(slug);

  if (!room) {
    return { title: "Room Not Found" };
  }

  return {
    title: `${room.name} - WatchParty`,
    description: `Watch ${room.name} together`,
  };
}
