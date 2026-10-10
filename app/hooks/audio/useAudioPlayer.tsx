import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useEventListener, useHapticFeedback } from "@/hooks";
import { queueBridge, useLibrary } from "@/lib/library";
import * as Utils from "@/utils";

import { useSettings, VOLUME_KEY, ShuffleMode, RepeatMode } from "..";
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

const shuffle = <TItem,>(items: TItem[]) => {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

/** Every media type a queue can be started from boils down to a list of songs. */
const getSongsFromQueueOptions = (queueOptions: MediaApi.QueueOptions) =>
  queueOptions.album?.songs ??
  queueOptions.playlist?.songs ??
  queueOptions.songs ??
  (queueOptions.song ? [queueOptions.song] : []);

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
  const { getFile } = useLibrary();
  const [volume, setVolume] = useState(0.5);
  const [nowPlayingItem, setNowPlayingItem] = useState<MediaApi.MediaItem>();
  const [playbackInfo, setPlaybackInfo] = useState(defaultPlaybackInfoState);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** The songs in the order they will play. */
  const queueRef = useRef<MediaApi.Song[]>([]);
  /** The same songs in the order they were queued, for turning shuffle back off. */
  const orderedQueueRef = useRef<MediaApi.Song[]>([]);
  const queueIndexRef = useRef(-1);
  const objectUrlRef = useRef<string | undefined>(undefined);
  const loadIdRef = useRef(0);
  const failureCountRef = useRef(0);

  const shuffleModeRef = useRef(shuffleMode);
  const repeatModeRef = useRef(repeatMode);
  useEffect(() => {
    shuffleModeRef.current = shuffleMode;
    repeatModeRef.current = repeatMode;
  });

  const getAudio = useCallback(() => {
    audioRef.current ??= new Audio();
    return audioRef.current;
  }, []);

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

    const audio = getAudio();
    audio.pause();
    audio.removeAttribute("src");
    audio.load();

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = undefined;
    }

    queueRef.current = [];
    orderedQueueRef.current = [];
    queueIndexRef.current = -1;
    failureCountRef.current = 0;

    setNowPlayingItem(undefined);
    setPlaybackInfo(defaultPlaybackInfoState);
    Utils.setDocumentSongTitle();
  }, [getAudio]);

  /** Loads the song at the given queue position from disk and starts playing it. */
  const playAtIndex = useCallback(
    async (index: number) => {
      const song = queueRef.current[index];

      if (!song) {
        return;
      }

      const loadId = ++loadIdRef.current;
      const audio = getAudio();

      queueIndexRef.current = index;
      setNowPlayingItem(song);
      Utils.setDocumentSongTitle(song);
      setPlaybackInfo({ ...defaultPlaybackInfoState, isLoading: true });

      try {
        const file = await getFile(song.id);

        // Another song was requested while this one was being read.
        if (loadId !== loadIdRef.current) {
          return;
        }

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }

        objectUrlRef.current = URL.createObjectURL(file);
        audio.src = objectUrlRef.current;

        await audio.play();
        failureCountRef.current = 0;
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
    [getAudio, getFile, reset]
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
        queueRef.current = [songs[startPosition], ...shuffle(rest)];
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
    const nextIndex = queueIndexRef.current + 1;

    if (nextIndex < queueRef.current.length) {
      await playAtIndex(nextIndex);
    } else if (repeatModeRef.current === "all") {
      await playAtIndex(0);
    } else {
      reset();
      dispatchPlaybackEndedEvent();
    }
  }, [playAtIndex, reset]);

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
      getAudio().volume = newVolume;
      localStorage.setItem(VOLUME_KEY, `${newVolume}`);
      setVolume(newVolume);
    },
    [getAudio]
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
        queueRef.current = [currentSong, ...shuffle(rest)];
        queueIndexRef.current = 0;
      }
    },
    [updateShuffleModeSetting]
  );

  const handleSetRepeatMode = useCallback(
    async (mode: RepeatMode) => {
      updateRepeatModeSetting(mode);
    },
    [updateRepeatModeSetting]
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
    },
    [play]
  );

  const playLater = useCallback(
    (songs: MediaApi.Song[]) => {
      if (queueIndexRef.current === -1) {
        play({ songs });
        return;
      }

      queueRef.current = [...queueRef.current, ...songs];
      orderedQueueRef.current = [...orderedQueueRef.current, ...songs];
    },
    [play]
  );

  useEffect(() => {
    queueBridge.playNext = playNext;
    queueBridge.playLater = playLater;
  }, [playNext, playLater]);

  // Keep the playback state in step with the audio element.
  useEffect(() => {
    const audio = getAudio();

    const handlePlaying = () => {
      setPlaybackInfo((prevState) => ({
        ...prevState,
        isPlaying: true,
        isPaused: false,
        isLoading: false,
      }));
      updatePlaybackInfo();
    };

    const handlePause = () => {
      // The element also pauses when a song finishes (handled by "ended")
      // and when the queue is cleared.
      if (audio.ended || queueIndexRef.current === -1) {
        return;
      }

      setPlaybackInfo((prevState) => ({
        ...prevState,
        isPlaying: false,
        isPaused: true,
        isLoading: false,
      }));
    };

    const handleWaiting = () =>
      setPlaybackInfo((prevState) => ({ ...prevState, isLoading: true }));

    const handleEnded = () => {
      if (repeatModeRef.current === "one") {
        audio.currentTime = 0;
        audio.play();
        return;
      }

      advance();
    };

    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("durationchange", updatePlaybackInfo);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("durationchange", updatePlaybackInfo);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [advance, getAudio, updatePlaybackInfo]);

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
      {children}
    </AudioPlayerContext.Provider>
  );
};

export default useAudioPlayer;
