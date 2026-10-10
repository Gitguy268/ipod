import { SelectableListOption } from "@/components/SelectableList";
import { queueMedia } from "@/lib/library";
import { DEFAULT_ARTWORK_URL } from "@/utils/constants/api";

/** Accepts a url with '{w}' and '{h}' and replaces them with the specified size */
export const getArtwork = (size: number | string, url?: string) => {
  if (!url) {
    return DEFAULT_ARTWORK_URL;
  }

  const urlWithSize = url.replace("{w}", `${size}`).replace("{h}", `${size}`);
  return urlWithSize;
};

export const setDocumentSongTitle = (song?: MediaApi.Song) => {
  document.title = song ? `${song.name} – iPod.js` : "iPod.js";
};

/** Returns a list of playback options to display in a popup for an album, song, or playlist. */
export const getMediaOptions = (
  type: "album" | "song" | "playlist",
  id: string
): SelectableListOption[] => [
  {
    type: "action",
    label: "Play Next",
    onSelect: () => queueMedia("next", type, id),
  },
  {
    type: "action",
    label: "Play Later",
    onSelect: () => queueMedia("later", type, id),
  },
];

/** Returns a copy of the list in random order. */
export const shuffle = <TItem>(items: TItem[]) => {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

export const formatPlaybackTime = (seconds: number) => {
  const dateObject = new Date();
  dateObject.setMinutes(0);
  dateObject.setSeconds(seconds);
  const formattedMinutes = dateObject.getMinutes().toString().padStart(2, "0");
  const formattedSeconds = dateObject.getSeconds().toString().padStart(2, "0");
  return `${formattedMinutes}:${formattedSeconds}`;
};


/**
 * Extracts the song ID from queue options.
 * Handles various queue option formats (song, songs array, album, playlist).
 */
export const getSongIdFromQueueOptions = (
  queueOptions: MediaApi.QueueOptions,
  startPosition = 0
): string | undefined => {
  return (
    queueOptions.song?.id ??
    queueOptions.songs?.[startPosition]?.id ??
    queueOptions.album?.songs[startPosition]?.id ??
    queueOptions.playlist?.songs[startPosition]?.id
  );
};
