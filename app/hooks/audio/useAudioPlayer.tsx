import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useEventListener, useHapticFeedback, useInterval } from "@/hooks";
import { queueBridge, useLibrary } from "@/lib/library";
import * as Utils from "@/utils";

import { useSettings, VOLUME_KEY, ShuffleMode, RepeatMode } from "..";
import { AudioDecks } from "./audioDecks";
import {
  clearSavedPlayback,
  loadSavedPlayback,
  saveQueue,
  saveTime,
} from "./playbackStore";
import useMediaSession from "./useMediaSession";
import { dispatchPlaybackEndedEvent, IpodEvent } from "@/utils/events";

const defaultPlaybackInfoState = {
  isPlaying: false,
  isPaused: false,
  isLoading: false,
  currentTime: 0,
  timeRemaining: 0,
  percent: 0,
  duration: 0,
};

/** Pressing "previous" this far into a song restarts it instead of going back. */
const RESTART_THRESHOLD_SECONDS = 3;
/** Stop skipping ahead after this many files in a row fail to play. */
const MAX_CONSECUTIVE_FAILURES = 3;
/** How often the position in the current song is saved for resuming later. */
const SAVE_TIME_INTERVAL_MS = 5000;

interface AudioPlayerState {
  playbackInfo: typeof defaultPlaybackInfoState;
  nowPlayingItem?: MediaApi.MediaItem;
  volume: number;
  shuffleMode: ShuffleMode;
  repeatMode: RepeatMode;
  play: (queueOptions: MediaApi.QueueOptions) => Promise<void>;
  pause: () => Promise<void>;
  seekToTime: (time: number) => Promise<void>;
  setVolume: (volume: number) => void;
  setShuffleMode: (mode: ShuffleMode) => Promise<void>;
  setRepeatMode: (mode: RepeatMode) => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrevious: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  updateNowPlayingItem: () => Promise<void>;
  updatePlaybackInfo: () => Promise<void>;
  reset: () => void;
}

// Context initialized with empty object - actual value provided by AudioPlayerProvider
export const AudioPlayerContext = createContext<AudioPlayerState>(
  {} as AudioPlayerState
);

type AudioPlayerHook = AudioPlayerState;

export const useAudioPlayer = (): AudioPlayerHook => {
  const state = useContext(AudioPlayerContext);

  return state;
};

interface QueueState {
  /** The songs in the order they will play. */
  songs: MediaApi.Song[];
  /** Which of them is current, or -1 when nothing is queued. */
  position: number;
  /** Jumps to a song in the queue. */
  skipTo: (position: number) => void;
}

/**
 * The queue has its own context so that things showing it (an "up next" list)
 * aren't redrawn every time the playback position ticks.
 */
export const QueueContext = createContext<QueueState>({
  songs: [],
  position: -1,
  skipTo: () => {},
});

export const useQueue = () => useContext(QueueContext);

/** Every media type a queue can be started from boils down to a list of songs. */
const getSongsFromQueueOptions = (queueOptions: MediaApi.QueueOptions) =>
  queueOptions.album?.songs ??
  queueOptions.playlist?.songs ??
  queueOptions.songs ??
  (queueOptions.song ? [queueOptions.song] : []);

interface PlayAtIndexOptions {
  autoplay?: boolean;
  /** Seconds into the song to start from. */
  startTime?: number;
}

interface Props {
  children: React.ReactNode;
}

export const AudioPlayerProvider = ({ children }: Props) => {
  const {
    shuffleMode,
    repeatMode,
    setShuffleMode: updateShuffleModeSetting,
    setRepeatMode: updateRepeatModeSetting,
  } = useSettings();
  const { getFile, index, status } = useLibrary();
  const [volume, setVolume] = useState(0.5);
  const [nowPlayingItem, setNowPlayingItem] = useState<MediaApi.MediaItem>();
  const [playbackInfo, setPlaybackInfo] = useState(defaultPlaybackInfoState);
  const [queue, setQueue] = useState<Pick<QueueState, "songs" | "position">>({
    songs: [],
    position: -1,
  });

  const decksRef = useRef<AudioDecks | null>(null);
  /** The songs in the order they will play. */
  const queueRef = useRef<MediaApi.Song[]>([]);
  /** The same songs in the order they were queued, for turning shuffle back off. */
  const orderedQueueRef = useRef<MediaApi.Song[]>([]);
  const queueIndexRef = useRef(-1);
  const loadIdRef = useRef(0);
  const preloadIdRef = useRef(0);
  const hasRestoredRef = useRef(false);
  /** When the last song finished, for timing the silence before the next one. */
  const endedAtRef = useRef<number | undefined>(undefined);
  const failureCountRef = useRef(0);
  /** Whether the current song got as far as actually playing. */
  const hasStartedRef = useRef(false);

  const shuffleModeRef = useRef(shuffleMode);
  const repeatModeRef = useRef(repeatMode);
  useEffect(() => {
    shuffleModeRef.current = shuffleMode;
    repeatModeRef.current = repeatMode;
  });

  /** Call after any change to the queue or the position in it. */
  const commitQueue = useCallback(() => {
    setQueue({ songs: queueRef.current, position: queueIndexRef.current });

    if (queueIndexRef.current !== -1) {
      saveQueue(queueRef.current, queueIndexRef.current);
    }
  }, []);

  const getDecks = useCallback(() => {
    decksRef.current ??= new AudioDecks();
    return decksRef.current;
  }, []);

  const getAudio = useCallback(() => getDecks().current, [getDecks]);

  /** Where the queue goes after the current song, if anywhere. */
  const getNextIndex = useCallback(() => {
    const nextIndex = queueIndexRef.current + 1;

    if (nextIndex < queueRef.current.length) {
      return nextIndex;
    }

    return repeatModeRef.current === "all" && queueRef.current.length
      ? 0
      : undefined;
  }, []);

  /**
   * Opens the next song ahead of time so the change-over is immediate.
   * Call it whenever the current song or the order of the queue changes.
   */
  const preloadNext = useCallback(async () => {
    const decks = getDecks();
    const preloadId = ++preloadIdRef.current;
    const nextIndex = getNextIndex();
    const song =
      nextIndex === undefined || nextIndex === queueIndexRef.current
        ? undefined
        : queueRef.current[nextIndex];

    if (!song) {
      decks.clearPreload();
      return;
    }

    if (decks.hasPreloaded(song.id)) {
      return;
    }

    try {
      const file = await getFile(song.id);

      if (preloadId === preloadIdRef.current) {
        decks.preload(song.id, file);
      }
    } catch {
      // It will be tried again, and reported, when its turn comes.
      decks.clearPreload();
    }
  }, [getDecks, getFile, getNextIndex]);

  const updatePlaybackInfo = useCallback(async () => {
    const audio = getAudio();
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const currentTime = audio.currentTime;

    setPlaybackInfo((prevState) => ({
      ...prevState,
      currentTime,
      timeRemaining: Math.max(duration - currentTime, 0),
      percent: duration > 0 ? (currentTime / duration) * 100 : 0,
      duration,
    }));
  }, [getAudio]);

  const updateNowPlayingItem = useCallback(async () => {
    setNowPlayingItem(queueRef.current[queueIndexRef.current]);
  }, []);

  const reset = useCallback(() => {
    loadIdRef.current++;
    preloadIdRef.current++;
    getDecks().clear();
    clearSavedPlayback();

    queueRef.current = [];
    orderedQueueRef.current = [];
    queueIndexRef.current = -1;
    failureCountRef.current = 0;

    setNowPlayingItem(undefined);
    setPlaybackInfo(defaultPlaybackInfoState);
    setQueue({ songs: [], position: -1 });
    Utils.setDocumentSongTitle();
  }, [getDecks]);

  /**
   * Loads the song at the given queue position from disk and starts playing it.
   * With `autoplay` off it is only loaded, paused at `startTime`.
   */
  const playAtIndex = useCallback(
    async (
      index: number,
      { autoplay = true, startTime = 0 }: PlayAtIndexOptions = {}
    ) => {
      const song = queueRef.current[index];

      if (!song) {
        return;
      }

      const loadId = ++loadIdRef.current;
      const decks = getDecks();
      hasStartedRef.current = false;

      queueIndexRef.current = index;
      setNowPlayingItem(song);
      Utils.setDocumentSongTitle(song);
      setPlaybackInfo({
        ...defaultPlaybackInfoState,
        isLoading: autoplay,
        isPaused: !autoplay,
        currentTime: startTime,
      });
      commitQueue();
      saveTime(startTime);

      try {
        if (decks.hasPreloaded(song.id)) {
          decks.swap();
        } else {
          const file = await getFile(song.id);

          // Another song was requested while this one was being read.
          if (loadId !== loadIdRef.current) {
            return;
          }

          decks.load(file);
        }

        if (startTime) {
          decks.current.currentTime = startTime;
        }

        if (autoplay) {
          await decks.current.play();
          hasStartedRef.current = true;
          failureCountRef.current = 0;
        }

        preloadNext();
      } catch (error) {
        if (loadId !== loadIdRef.current) {
          return;
        }

        // Either the browser refused to start without a click, or the song was paused
        // while it was still loading. Neither is a broken file: it stays loaded and paused.
        if (
          error instanceof DOMException &&
          (error.name === "NotAllowedError" || error.name === "AbortError")
        ) {
          setPlaybackInfo((prevState) => ({
            ...prevState,
            isLoading: false,
            isPaused: true,
          }));
          return;
        }

        console.error(`Unable to play: ${song.id}`, error);
        failureCountRef.current++;

        const hasNext = index + 1 < queueRef.current.length;

        if (hasNext && failureCountRef.current < MAX_CONSECUTIVE_FAILURES) {
          await playAtIndex(index + 1);
        } else {
          reset();
          dispatchPlaybackEndedEvent();
        }
      }
    },
    [commitQueue, getDecks, getFile, preloadNext, reset]
  );

  const play = useCallback(
    async (queueOptions: MediaApi.QueueOptions) => {
      const songs = getSongsFromQueueOptions(queueOptions);
      const startPosition = queueOptions.startPosition ?? 0;

      if (!songs.length) {
        throw new Error("Unable to play: no songs provided");
      }

      orderedQueueRef.current = songs;

      if (shuffleModeRef.current === "off") {
        queueRef.current = songs;
        await playAtIndex(startPosition);
      } else {
        // The chosen song still plays first, followed by the rest in random order.
        const rest = songs.filter((_, index) => index !== startPosition);
        queueRef.current = [songs[startPosition], ...Utils.shuffle(rest)];
        await playAtIndex(0);
      }
    },
    [playAtIndex]
  );

  const pause = useCallback(async () => {
    getAudio().pause();
  }, [getAudio]);

  const togglePlayPause = useCallback(async () => {
    if (!nowPlayingItem) {
      return;
    }

    const audio = getAudio();

    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  }, [getAudio, nowPlayingItem]);

  /** Moves to the next song, or finishes if the queue has run out. */
  const advance = useCallback(async () => {
    const nextIndex = getNextIndex();

    if (nextIndex !== undefined) {
      await playAtIndex(nextIndex);
    } else {
      reset();
      dispatchPlaybackEndedEvent();
    }
  }, [getNextIndex, playAtIndex, reset]);

  const skipNext = useCallback(async () => {
    if (!nowPlayingItem) {
      return;
    }

    await advance();
  }, [advance, nowPlayingItem]);

  const skipPrevious = useCallback(async () => {
    if (!nowPlayingItem) {
      return;
    }

    const audio = getAudio();
    const isFirstSong = queueIndexRef.current === 0;

    if (audio.currentTime > RESTART_THRESHOLD_SECONDS || isFirstSong) {
      audio.currentTime = 0;
      updatePlaybackInfo();
      return;
    }

    await playAtIndex(queueIndexRef.current - 1);
  }, [getAudio, nowPlayingItem, playAtIndex, updatePlaybackInfo]);

  const seekToTime = useCallback(
    async (time: number) => {
      getAudio().currentTime = time;
      updatePlaybackInfo();
    },
    [getAudio, updatePlaybackInfo]
  );

  const handleChangeVolume = useCallback(
    (newVolume: number) => {
      getDecks().setVolume(newVolume);
      localStorage.setItem(VOLUME_KEY, `${newVolume}`);
      setVolume(newVolume);
    },
    [getDecks]
  );

  const handleSetShuffleMode = useCallback(
    async (mode: ShuffleMode) => {
      updateShuffleModeSetting(mode);

      const currentSong = queueRef.current[queueIndexRef.current];

      if (!currentSong) {
        return;
      }

      // Re-order what is still to come without interrupting the current song.
      if (mode === "off") {
        queueRef.current = orderedQueueRef.current;
        queueIndexRef.current = queueRef.current.indexOf(currentSong);
      } else {
        const rest = orderedQueueRef.current.filter(
          (song) => song !== currentSong
        );
        queueRef.current = [currentSong, ...Utils.shuffle(rest)];
        queueIndexRef.current = 0;
      }

      commitQueue();
      preloadNext();
    },
    [commitQueue, preloadNext, updateShuffleModeSetting]
  );

  const handleSetRepeatMode = useCallback(
    async (mode: RepeatMode) => {
      updateRepeatModeSetting(mode);
      // Whether anything follows the last song depends on the repeat mode.
      repeatModeRef.current = mode;
      preloadNext();
    },
    [preloadNext, updateRepeatModeSetting]
  );

  const playNext = useCallback(
    (songs: MediaApi.Song[]) => {
      if (queueIndexRef.current === -1) {
        play({ songs });
        return;
      }

      const insertAt = queueIndexRef.current + 1;
      queueRef.current = [
        ...queueRef.current.slice(0, insertAt),
        ...songs,
        ...queueRef.current.slice(insertAt),
      ];
      orderedQueueRef.current = [...orderedQueueRef.current, ...songs];
      commitQueue();
      preloadNext();
    },
    [commitQueue, play, preloadNext]
  );

  const playLater = useCallback(
    (songs: MediaApi.Song[]) => {
      if (queueIndexRef.current === -1) {
        play({ songs });
        return;
      }

      queueRef.current = [...queueRef.current, ...songs];
      orderedQueueRef.current = [...orderedQueueRef.current, ...songs];
      commitQueue();
      preloadNext();
    },
    [commitQueue, play, preloadNext]
  );

  // The library hands out fresh song objects when it changes (for example once
  // artwork has been read), so point the queue at the current ones.
  useEffect(() => {
    const refresh = (songs: MediaApi.Song[]) =>
      songs.map((song) => index.songsById.get(song.id) ?? song);

    queueRef.current = refresh(queueRef.current);
    orderedQueueRef.current = refresh(orderedQueueRef.current);

    const current = queueRef.current[queueIndexRef.current];

    if (current) {
      setNowPlayingItem(current);
      setQueue({ songs: queueRef.current, position: queueIndexRef.current });
    }
  }, [index]);

  useEffect(() => {
    queueBridge.playNext = playNext;
    queueBridge.playLater = playLater;
  }, [playNext, playLater]);

  const { syncPosition } = useMediaSession({
    nowPlayingItem,
    isPlaying: playbackInfo.isPlaying,
    getAudio,
    skipNext,
    skipPrevious,
    seekToTime,
  });

  // Keep the playback state in step with whichever audio element is current.
  useEffect(() => {
    const decks = getDecks();

    const handlePlaying = () => {
      hasStartedRef.current = true;

      // Shows up as "player:gap" in the browser's Performance panel.
      if (endedAtRef.current !== undefined) {
        performance.measure("player:gap", {
          start: endedAtRef.current,
          end: performance.now(),
        });
        endedAtRef.current = undefined;
      }

      setPlaybackInfo((prevState) => ({
        ...prevState,
        isPlaying: true,
        isPaused: false,
        isLoading: false,
      }));
      updatePlaybackInfo();
      syncPosition();
    };

    const handlePause = () => {
      // The element also pauses when a song finishes (handled by "ended")
      // and when the queue is cleared.
      if (decks.current.ended || queueIndexRef.current === -1) {
        return;
      }

      setPlaybackInfo((prevState) => ({
        ...prevState,
        isPlaying: false,
        isPaused: true,
        isLoading: false,
      }));
      saveTime(decks.current.currentTime);
      syncPosition();
    };

    const handleWaiting = () =>
      setPlaybackInfo((prevState) => ({ ...prevState, isLoading: true }));

    const handleDurationChange = () => {
      updatePlaybackInfo();
      syncPosition();
    };

    // A file that turns out to be damaged part-way through. Files that never
    // start are dealt with where they are loaded.
    const handleError = () => {
      if (hasStartedRef.current && decks.current.error) {
        hasStartedRef.current = false;
        console.error(
          `Unable to keep playing: ${queueRef.current[queueIndexRef.current]?.id}`,
          decks.current.error
        );
        advance();
      }
    };

    const handleEnded = () => {
      endedAtRef.current = performance.now();

      if (repeatModeRef.current === "one") {
        decks.current.currentTime = 0;
        decks.current.play();
        return;
      }

      advance();
    };

    const unsubscribe = [
      decks.on("playing", handlePlaying),
      decks.on("pause", handlePause),
      decks.on("waiting", handleWaiting),
      decks.on("durationchange", handleDurationChange),
      decks.on("seeked", syncPosition),
      decks.on("ended", handleEnded),
      decks.on("error", handleError),
    ];

    return () => unsubscribe.forEach((stop) => stop());
  }, [advance, getDecks, syncPosition, updatePlaybackInfo]);

  // Remember the position in the song, for picking up again after a reload.
  const saveCurrentTime = useCallback(() => {
    if (queueIndexRef.current !== -1) {
      saveTime(getAudio().currentTime);
    }
  }, [getAudio]);

  useInterval(saveCurrentTime, SAVE_TIME_INTERVAL_MS, !playbackInfo.isPlaying);
  useEventListener("pagehide", saveCurrentTime);

  // Once the library is loaded, put back what was playing last time, paused.
  // Browsers don't let a page start making sound on its own.
  useEffect(() => {
    if (status !== "ready" || hasRestoredRef.current) {
      return;
    }

    hasRestoredRef.current = true;

    const saved = loadSavedPlayback();
    const current = saved && index.songsById.get(saved.songIds[saved.index]);

    if (!saved || !current || queueIndexRef.current !== -1) {
      return;
    }

    const songs = saved.songIds
      .map((id) => index.songsById.get(id))
      .filter((song): song is MediaApi.Song => !!song);

    queueRef.current = songs;
    orderedQueueRef.current = songs;

    playAtIndex(songs.indexOf(current), {
      autoplay: false,
      startTime: saved.time,
    });
  }, [index, playAtIndex, status]);

  const { triggerHaptics } = useHapticFeedback();

  const handlePlayPauseClick = useCallback(() => {
    triggerHaptics();
    togglePlayPause();
  }, [togglePlayPause, triggerHaptics]);

  const handleSkipNext = useCallback(() => {
    triggerHaptics();
    skipNext();
  }, [skipNext, triggerHaptics]);

  const handleSkipPrevious = useCallback(() => {
    triggerHaptics();
    skipPrevious();
  }, [skipPrevious, triggerHaptics]);

  useEventListener<IpodEvent>("playpauseclick", handlePlayPauseClick);
  useEventListener<IpodEvent>("forwardclick", handleSkipNext);
  useEventListener<IpodEvent>("backwardclick", handleSkipPrevious);

  // Restore the volume from the last visit.
  useEffect(() => {
    const savedVolume = parseFloat(localStorage.getItem(VOLUME_KEY) ?? "0.5");
    handleChangeVolume(Number.isFinite(savedVolume) ? savedVolume : 0.5);
  }, [handleChangeVolume]);

  const queueValue = useMemo(
    () => ({ ...queue, skipTo: (position: number) => void playAtIndex(position) }),
    [playAtIndex, queue]
  );

  return (
    <AudioPlayerContext.Provider
      value={{
        playbackInfo,
        nowPlayingItem,
        volume,
        shuffleMode,
        repeatMode,
        play,
        pause,
        seekToTime,
        setVolume: handleChangeVolume,
        setShuffleMode: handleSetShuffleMode,
        setRepeatMode: handleSetRepeatMode,
        togglePlayPause,
        updateNowPlayingItem,
        updatePlaybackInfo,
        skipNext,
        skipPrevious,
        reset,
      }}
    >
      <QueueContext.Provider value={queueValue}>{children}</QueueContext.Provider>
    </AudioPlayerContext.Provider>
  );
};

export default useAudioPlayer;
