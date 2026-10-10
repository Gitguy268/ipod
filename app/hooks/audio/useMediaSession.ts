import { useCallback, useEffect } from "react";

interface Options {
  nowPlayingItem?: MediaApi.MediaItem;
  isPlaying: boolean;
  getAudio: () => HTMLAudioElement;
  skipNext: () => void;
  skipPrevious: () => void;
  seekToTime: (time: number) => void;
}

const isSupported = () =>
  typeof navigator !== "undefined" && "mediaSession" in navigator;

/**
 * Tells the operating system what is playing, so the keyboard's media keys and
 * the system's now-playing panel show the song and can control it.
 */
const useMediaSession = ({
  nowPlayingItem,
  isPlaying,
  getAudio,
  skipNext,
  skipPrevious,
  seekToTime,
}: Options) => {
  useEffect(() => {
    if (!isSupported()) {
      return;
    }

    const artworkUrl = nowPlayingItem?.artwork?.url;

    navigator.mediaSession.metadata = nowPlayingItem
      ? new MediaMetadata({
          title: nowPlayingItem.name,
          artist: nowPlayingItem.artistName ?? "",
          album: nowPlayingItem.albumName ?? "",
          artwork: artworkUrl
            ? [{ src: artworkUrl, sizes: "480x480", type: "image/jpeg" }]
            : [],
        })
      : null;
  }, [nowPlayingItem]);

  useEffect(() => {
    if (!isSupported()) {
      return;
    }

    navigator.mediaSession.playbackState = !nowPlayingItem
      ? "none"
      : isPlaying
        ? "playing"
        : "paused";
  }, [isPlaying, nowPlayingItem]);

  useEffect(() => {
    if (!isSupported()) {
      return;
    }

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => getAudio().play()],
      ["pause", () => getAudio().pause()],
      ["previoustrack", () => skipPrevious()],
      ["nexttrack", () => skipNext()],
      [
        "seekto",
        ({ seekTime }) => {
          if (seekTime !== undefined) {
            seekToTime(seekTime);
          }
        },
      ],
    ];

    handlers.forEach(([action, handler]) =>
      navigator.mediaSession.setActionHandler(action, handler)
    );

    return () =>
      handlers.forEach(([action]) =>
        navigator.mediaSession.setActionHandler(action, null)
      );
  }, [getAudio, seekToTime, skipNext, skipPrevious]);

  /** Keeps the system's progress bar in step. Call it whenever playback jumps or changes speed. */
  const syncPosition = useCallback(() => {
    if (!isSupported()) {
      return;
    }

    const { duration, currentTime, playbackRate } = getAudio();

    if (Number.isFinite(duration) && duration > 0) {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(currentTime, duration),
        playbackRate,
      });
    }
  }, [getAudio]);

  return { syncPosition };
};

export default useMediaSession;
