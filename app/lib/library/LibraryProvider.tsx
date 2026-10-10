import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useQueryClient } from "@tanstack/react-query";

import { makeThumbnail } from "./artwork";
import {
  buildIndex,
  getAlbumDirectory,
  getDirectory,
  getEntryKey,
  groupByAlbum,
  toTrackRecord,
} from "./buildIndex";
import { dbClear, dbGet, dbGetAll, dbReplaceAll, dbSet } from "./db";
import { isFixtureRequested, loadFixtureEntries } from "./fixture";
import {
  canPlayCodec,
  classifyEntries,
  DirectoryHandle,
  DroppedFolder,
  entriesFromDirectoryEntry,
  entriesFromHandle,
  pickDirectoryHandle,
  pickWithInput,
  supportsDirectoryPicker,
} from "./folderAccess";
import { mapWithConcurrency, readEmbeddedPicture, readTags } from "./metadata";
import { queueBridge } from "./queueBridge";
import { throttle } from "./throttle";
import {
  LibraryEntry,
  LibraryIndex,
  LibraryStatus,
  PlaylistFile,
  TrackRecord,
} from "./types";

const FOLDER_HANDLE_KEY = "folder";
const TAG_CONCURRENCY = 6;
const ARTWORK_CONCURRENCY = 4;
const PROGRESS_INTERVAL_MS = 150;
/** How often the library is refreshed while artwork is still being read. */
const ARTWORK_PUBLISH_INTERVAL_MS = 1500;
/** Full-size covers are several megabytes each, so only a few stay in memory. */
const MAX_FULL_ARTWORK = 6;

interface ArtworkRecord {
  albumId: string;
  /** Identifies the files the thumbnail came from, so it is rebuilt when they change. */
  sourceKey: string;
  thumbnail?: Blob;
}

interface Progress {
  done: number;
  total: number;
}

interface LibraryState {
  status: LibraryStatus;
  /** How far the reading of song tags has got, while `status` is "scanning". */
  progress: Progress;
  /** How far the reading of album artwork has got. This carries on after the library is usable. */
  artworkProgress: Progress;
  /** Music files left out because this browser can't play their format. */
  skippedCount: number;
  /** Changes every time the library contents change. */
  version: number;
  folderName?: string;
  error?: string;
  index: LibraryIndex;
  chooseFolder: () => Promise<void>;
  /** Loads a folder that was dragged onto the page. */
  openDropped: (folder: DroppedFolder) => Promise<void>;
  /** Asks the browser to re-allow a folder remembered from an earlier visit. */
  reconnect: () => Promise<void>;
  rescan: () => Promise<void>;
  forget: () => Promise<void>;
  getFile: (songId: string) => Promise<File>;
  /** Resolves to the album's artwork at its original resolution. */
  getFullArtwork: (albumId: string) => Promise<string | undefined>;
}

const EMPTY_INDEX = buildIndex([]);

/**
 * Records how long a stage of loading took. Read the results in the browser's
 * Performance panel, or with `performance.getEntriesByType("measure")`.
 */
const measure = (stage: string, start: number) =>
  performance.measure(`library:${stage}`, { start, end: performance.now() });

/** Playlist files are small text files, so they are simply read again on every load. */
const readPlaylistFiles = (entries: LibraryEntry[]) =>
  Promise.all(
    entries.map(async (entry): Promise<PlaylistFile> => {
      try {
        return { path: entry.path, text: await (await entry.getFile()).text() };
      } catch (error) {
        console.warn(`Unable to read playlist: ${entry.path}`, error);
        return { path: entry.path, text: "" };
      }
    })
  );

/** A cover image next to the track, or beside its "CD1"-style disc folder. */
const findCover = (covers: Map<string, LibraryEntry>, trackPath: string) =>
  covers.get(getDirectory(trackPath)) ?? covers.get(getAlbumDirectory(trackPath));

export const LibraryContext = createContext<LibraryState>({} as LibraryState);

export const useLibrary = () => useContext(LibraryContext);

interface Props {
  children: React.ReactNode;
}

export const LibraryProvider = ({ children }: Props) => {
  // Starts as "scanning" until we know whether a folder was remembered.
  const [status, setStatus] = useState<LibraryStatus>("scanning");
  const [progress, setProgress] = useState<Progress>({ done: 0, total: 0 });
  const [artworkProgress, setArtworkProgress] = useState<Progress>({
    done: 0,
    total: 0,
  });
  const [skippedCount, setSkippedCount] = useState(0);
  const queryClient = useQueryClient();
  const [version, setVersion] = useState(0);
  const [folderName, setFolderName] = useState<string>();
  const [error, setError] = useState<string>();
  const [index, setIndex] = useState<LibraryIndex>(EMPTY_INDEX);

  const handleRef = useRef<DirectoryHandle | undefined>(undefined);
  const runIdRef = useRef(0);
  const hasLibraryRef = useRef(false);
  const entriesRef = useRef(new Map<string, LibraryEntry>());
  const coversRef = useRef(new Map<string, LibraryEntry>());
  const albumTracksRef = useRef(new Map<string, TrackRecord[]>());
  const thumbnailUrlsRef = useRef<string[]>([]);
  const staleUrlsRef = useRef<string[]>([]);
  const fullArtworkRef = useRef(
    new Map<string, Promise<string | undefined>>()
  );

  /** Finds an album's original artwork: embedded in a track, else an image in its folder. */
  const findArtwork = useCallback(async (tracks: TrackRecord[]) => {
    const candidates = new Set([tracks[0], tracks[tracks.length - 1]]);

    for (const track of candidates) {
      const entry = entriesRef.current.get(track.path);
      const picture = entry && (await readEmbeddedPicture(entry));

      if (picture) {
        return picture;
      }
    }

    return findCover(coversRef.current, tracks[0].path)?.getFile();
  }, []);

  const releaseArtwork = useCallback((keepPrevious: boolean) => {
    // The song that is playing may still be showing the previous thumbnails,
    // so those are only released one load later.
    staleUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    staleUrlsRef.current = keepPrevious ? thumbnailUrlsRef.current : [];

    if (!keepPrevious) {
      thumbnailUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    }

    thumbnailUrlsRef.current = [];
    fullArtworkRef.current.clear();
  }, []);

  const loadEntries = useCallback(
    async (entries: LibraryEntry[], name: string) => {
      const runId = ++runIdRef.current;
      const isCurrent = () => runId === runIdRef.current;
      const startedAt = performance.now();

      setError(undefined);
      setStatus("scanning");
      setFolderName(name);

      const { audio, coversByDirectory, playlists, unplayableCount } =
        classifyEntries(entries);

      const reportProgress = throttle((progress: Progress) => {
        if (isCurrent()) {
          setProgress(progress);
        }
      }, PROGRESS_INTERVAL_MS);

      const reportArtwork = throttle((progress: Progress) => {
        if (isCurrent()) {
          setArtworkProgress(progress);
        }
      }, PROGRESS_INTERVAL_MS);

      // Tags: only files that are new or changed since the last visit get parsed.
      const cachedTracks = new Map(
        (await dbGetAll<TrackRecord>("tracks")).map((record) => [
          getEntryKey(record),
          record,
        ])
      );

      let tagsDone = 0;
      setProgress({ done: 0, total: audio.length });

      const allRecords = await mapWithConcurrency(
        audio,
        TAG_CONCURRENCY,
        async (entry) => {
          const record =
            cachedTracks.get(getEntryKey(entry)) ??
            toTrackRecord(entry, await readTags(entry), name);

          reportProgress({ done: ++tagsDone, total: audio.length });

          return record;
        }
      );

      if (!isCurrent()) {
        return;
      }

      measure("tags", startedAt);

      // Files in a format this browser can't decode stay out of the library.
      const records = allRecords.filter((record) => canPlayCodec(record.codec));
      const albums = groupByAlbum(records);

      entriesRef.current = new Map(audio.map((entry) => [entry.path, entry]));
      coversRef.current = coversByDirectory;
      albumTracksRef.current = albums;
      hasLibraryRef.current = true;

      await dbReplaceAll("tracks", allRecords);

      // Artwork: one thumbnail per album. Thumbnails made on an earlier visit are
      // used straight away; the rest are filled in while the library is already usable.
      const cachedArtwork = new Map(
        (await dbGetAll<ArtworkRecord>("artwork")).map((record) => [
          record.albumId,
          record,
        ])
      );

      releaseArtwork(true);

      const artworkRecords: ArtworkRecord[] = [];
      const artworkUrls: Record<string, string> = {};
      const missing: { albumId: string; tracks: TrackRecord[]; sourceKey: string }[] =
        [];

      const addArtwork = (record: ArtworkRecord) => {
        artworkRecords.push(record);

        if (record.thumbnail) {
          const url = URL.createObjectURL(record.thumbnail);
          artworkUrls[record.albumId] = url;
          thumbnailUrlsRef.current.push(url);
        }
      };

      for (const [albumId, tracks] of albums) {
        const cover = findCover(coversByDirectory, tracks[0].path);
        const sourceKey = `${getEntryKey(tracks[0])}#${
          cover ? getEntryKey(cover) : ""
        }`;
        const cached = cachedArtwork.get(albumId);

        if (cached?.sourceKey === sourceKey) {
          addArtwork(cached);
        } else {
          missing.push({ albumId, tracks, sourceKey });
        }
      }

      const playlistFiles = await readPlaylistFiles(playlists);

      const publish = () => {
        if (isCurrent()) {
          setIndex(buildIndex(records, artworkUrls, playlistFiles));
        }
      };

      publish();
      setVersion((prev) => prev + 1);
      setSkippedCount(unplayableCount + allRecords.length - records.length);
      setArtworkProgress({ done: 0, total: missing.length });
      setStatus("ready");
      measure("browsable", startedAt);

      if (missing.length) {
        const artworkStartedAt = performance.now();
        const publishSoon = throttle(publish, ARTWORK_PUBLISH_INTERVAL_MS);
        let artworkDone = 0;

        await mapWithConcurrency(
          missing,
          ARTWORK_CONCURRENCY,
          async ({ albumId, tracks, sourceKey }) => {
            const original = await findArtwork(tracks);
            const thumbnail = original && (await makeThumbnail(original));

            if (!isCurrent()) {
              return;
            }

            addArtwork({ albumId, sourceKey, thumbnail });
            reportArtwork({ done: ++artworkDone, total: missing.length });
            publishSoon();
          }
        );

        if (!isCurrent()) {
          return;
        }

        measure("artwork", artworkStartedAt);
        publish();
        setArtworkProgress({ done: missing.length, total: missing.length });
        await dbReplaceAll("artwork", artworkRecords);
      }

      measure("total", startedAt);
    },
    [findArtwork, releaseArtwork]
  );

  /** Runs a folder operation, and puts the library back the way it was if it fails. */
  const guard = useCallback(async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (e) {
      console.error("Unable to load the music folder:", e);
      runIdRef.current++;
      setError("Unable to read that folder.");
      setStatus(hasLibraryRef.current ? "ready" : "empty");
    }
  }, []);

  const scanHandle = useCallback(
    async (handle: DirectoryHandle) => {
      setStatus("scanning");
      setProgress({ done: 0, total: 0 });
      setFolderName(handle.name);

      await loadEntries(await entriesFromHandle(handle), handle.name);
    },
    [loadEntries]
  );

  const chooseFolder = useCallback(
    () =>
      guard(async () => {
        // The pickers must be the first thing that happens after the user's click.
        if (supportsDirectoryPicker()) {
          const handle = await pickDirectoryHandle();

          if (handle) {
            handleRef.current = handle;
            await dbSet("settings", FOLDER_HANDLE_KEY, handle);
            await scanHandle(handle);
          }
          return;
        }

        const picked = await pickWithInput();

        if (picked) {
          handleRef.current = undefined;
          await loadEntries(picked.entries, picked.name);
        }
      }),
    [guard, loadEntries, scanHandle]
  );

  const openDropped = useCallback(
    (folder: DroppedFolder) =>
      guard(async () => {
        const handle = await folder.handle;

        if (handle) {
          handleRef.current = handle;
          await dbSet("settings", FOLDER_HANDLE_KEY, handle);
          await scanHandle(handle);
        } else if (folder.directory) {
          handleRef.current = undefined;
          setStatus("scanning");
          setProgress({ done: 0, total: 0 });
          setFolderName(folder.name);
          await loadEntries(
            await entriesFromDirectoryEntry(folder.directory),
            folder.name
          );
        }
      }),
    [guard, loadEntries, scanHandle]
  );

  const reconnect = useCallback(
    () =>
      guard(async () => {
        const handle = handleRef.current;

        if (!handle) {
          return;
        }

        if ((await handle.requestPermission({ mode: "read" })) === "granted") {
          await scanHandle(handle);
        }
      }),
    [guard, scanHandle]
  );

  const rescan = useCallback(async () => {
    // Without a remembered folder the only way to look again is to pick it again.
    if (handleRef.current) {
      await reconnect();
    } else {
      await chooseFolder();
    }
  }, [chooseFolder, reconnect]);

  const forget = useCallback(async () => {
    runIdRef.current++;
    handleRef.current = undefined;
    hasLibraryRef.current = false;
    entriesRef.current = new Map();
    coversRef.current = new Map();
    albumTracksRef.current = new Map();
    releaseArtwork(false);

    setIndex(EMPTY_INDEX);
    setVersion((prev) => prev + 1);
    setSkippedCount(0);
    setArtworkProgress({ done: 0, total: 0 });
    setFolderName(undefined);
    setError(undefined);
    setStatus("empty");

    await Promise.all([
      dbClear("settings"),
      dbClear("tracks"),
      dbClear("artwork"),
    ]);
  }, [releaseArtwork]);

  const getFile = useCallback(async (songId: string) => {
    const entry = entriesRef.current.get(songId);

    if (!entry) {
      throw new Error(`File is no longer in the library: ${songId}`);
    }

    return entry.getFile();
  }, []);

  const getFullArtwork = useCallback(
    (albumId: string) => {
      const cache = fullArtworkRef.current;
      const cached = cache.get(albumId);

      if (cached) {
        return cached;
      }

      const tracks = albumTracksRef.current.get(albumId);

      const request = (async () => {
        const original = tracks && (await findArtwork(tracks));
        return original ? URL.createObjectURL(original) : undefined;
      })();

      cache.set(albumId, request);

      if (cache.size > MAX_FULL_ARTWORK) {
        const [oldestId, oldest] = cache.entries().next().value!;
        cache.delete(oldestId);
        oldest.then((url) => url && URL.revokeObjectURL(url));
      }

      return request;
    },
    [findArtwork]
  );

  // On load: pick up the test library, or the folder remembered from last time.
  useEffect(() => {
    guard(async () => {
      if (isFixtureRequested()) {
        const fixture = await loadFixtureEntries();

        if (fixture) {
          await loadEntries(fixture.entries, fixture.name);
          return;
        }
      }

      const handle = supportsDirectoryPicker()
        ? await dbGet<DirectoryHandle>("settings", FOLDER_HANDLE_KEY)
        : undefined;

      if (!handle) {
        setStatus("empty");
        return;
      }

      handleRef.current = handle;
      setFolderName(handle.name);

      if ((await handle.queryPermission({ mode: "read" })) === "granted") {
        await scanHandle(handle);
      } else {
        setStatus("needsPermission");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lists that are already on screen pick up artwork as it arrives.
  useEffect(() => {
    queryClient.invalidateQueries();
  }, [index, queryClient]);

  useEffect(() => {
    queueBridge.resolveSongs = (type, id) => {
      if (type === "album") {
        return index.albumsById.get(id)?.songs ?? [];
      }

      if (type === "playlist") {
        return index.playlistsById.get(id)?.songs ?? [];
      }

      const song = index.songsById.get(id);
      return song ? [song] : [];
    };
  }, [index]);

  const value = useMemo(
    () => ({
      status,
      progress,
      artworkProgress,
      skippedCount,
      version,
      folderName,
      error,
      index,
      chooseFolder,
      openDropped,
      reconnect,
      rescan,
      forget,
      getFile,
      getFullArtwork,
    }),
    [
      status,
      progress,
      artworkProgress,
      skippedCount,
      version,
      folderName,
      error,
      index,
      chooseFolder,
      openDropped,
      reconnect,
      rescan,
      forget,
      getFile,
      getFullArtwork,
    ]
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
};
