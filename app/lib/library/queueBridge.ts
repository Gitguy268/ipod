type MediaType = "album" | "song" | "playlist";

interface QueueBridge {
  playNext?: (songs: MediaApi.Song[]) => void;
  playLater?: (songs: MediaApi.Song[]) => void;
  resolveSongs?: (type: MediaType, id: string) => MediaApi.Song[];
}

/**
 * Lets plain functions (which can't use hooks) reach the current queue and library.
 * The audio player and library providers fill this in when they mount.
 */
export const queueBridge: QueueBridge = {};

export const queueMedia = (
  position: "next" | "later",
  type: MediaType,
  id: string
) => {
  const songs = queueBridge.resolveSongs?.(type, id) ?? [];

  if (!songs.length) {
    return;
  }

  if (position === "next") {
    queueBridge.playNext?.(songs);
  } else {
    queueBridge.playLater?.(songs);
  }
};
