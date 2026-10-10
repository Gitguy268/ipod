const QUEUE_KEY = "ipodPlaybackQueue";
const TIME_KEY = "ipodPlaybackTime";

interface SavedQueue {
  /** Song ids in the order they play. */
  songIds: string[];
  index: number;
}

export interface SavedPlayback extends SavedQueue {
  /** Seconds into the current song. */
  time: number;
}

/**
 * Remembers what was playing so a reload can pick up where it left off.
 * The queue only changes now and then, but the position changes constantly,
 * so they are stored separately to keep the frequent write small.
 */
export const saveQueue = (songs: MediaApi.Song[], index: number) => {
  const saved: SavedQueue = { songIds: songs.map((song) => song.id), index };

  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(saved));
    localStorage.setItem(TIME_KEY, "0");
  } catch {
    // Storage full or unavailable: resuming is a nicety, so carry on without it.
  }
};

export const saveTime = (time: number) => {
  try {
    localStorage.setItem(TIME_KEY, `${time}`);
  } catch {
    // See above.
  }
};

export const clearSavedPlayback = () => {
  localStorage.removeItem(QUEUE_KEY);
  localStorage.removeItem(TIME_KEY);
};

export const loadSavedPlayback = (): SavedPlayback | undefined => {
  try {
    const saved: SavedQueue | null = JSON.parse(
      localStorage.getItem(QUEUE_KEY) ?? "null"
    );

    if (!saved || !Array.isArray(saved.songIds)) {
      return undefined;
    }

    return {
      ...saved,
      time: parseFloat(localStorage.getItem(TIME_KEY) ?? "0") || 0,
    };
  } catch {
    return undefined;
  }
};
