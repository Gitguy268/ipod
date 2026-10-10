import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  classifyEntries,
  DirectoryHandle,
  entriesFromHandle,
  pickDirectoryHandle,
  pickWithInput,
  supportsDirectoryPicker,
} from "./folderAccess";
import { mapWithConcurrency, readEmbeddedPicture, readTags } from "./metadata";
import { queueBridge } from "./queueBridge";
import {
  LibraryEntry,
  LibraryIndex,
  LibraryStatus,
  TrackRecord,
} from "./types";

const FOLDER_HANDLE_KEY = "folder";
const TAG_CONCURRENCY = 6;
const ARTWORK_CONCURRENCY = 4;
const PROGRESS_INTERVAL_MS = 150;
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
  progress: Progress;
  /** Changes every time the library contents change. */
  version: number;
  folderName?: string;
  error?: string;
  index: LibraryIndex;
  chooseFolder: () => Promise<void>;
  /** Asks the browser to re-allow a folder remembered from an earlier visit. */
  reconnect: () => Promise<void>;
  rescan: () => Promise<void>;
  forget: () => Promise<void>;
  getFile: (songId: string) => Promise<File>;
  /** Resolves to the album's artwork at its original resolution. */
  getFullArtwork: (albumId: string) => Promise<string | undefined>;
}

const EMPTY_INDEX = buildIndex([]);

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

      setError(undefined);
      setStatus("scanning");
      setFolderName(name);

      const { audio, coversByDirectory } = classifyEntries(entries);

      let done = 0;
      let total = audio.length;
      let lastReport = 0;

      const report = (force = false) => {
        const now = performance.now();
        if (isCurrent() && (force || now - lastReport > PROGRESS_INTERVAL_MS)) {
          lastReport = now;
          setProgress({ done, total });
        }
      };

      report(true);

      // Tags: only files that are new or changed since the last visit get parsed.
      const cachedTracks = new Map(
        (await dbGetAll<TrackRecord>("tracks")).map((record) => [
          getEntryKey(record),
          record,
        ])
      );

      const records = await mapWithConcurrency(
        audio,
        TAG_CONCURRENCY,
        async (entry) => {
          const record =
            cachedTracks.get(getEntryKey(entry)) ??
            toTrackRecord(entry, await readTags(entry), name);

          done++;
          report();

          return record;
        }
      );

      if (!isCurrent()) {
        return;
      }

      entriesRef.current = new Map(audio.map((entry) => [entry.path, entry]));
      coversRef.current = coversByDirectory;

      // Artwork: one thumbnail per album.
      const albums = groupByAlbum(records);
      total += albums.size;
      report(true);

      const cachedArtwork = new Map(
        (await dbGetAll<ArtworkRecord>("artwork")).map((record) => [
          record.albumId,
          record,
        ])
      );

      const artworkRecords = await mapWithConcurrency(
        [...albums],
        ARTWORK_CONCURRENCY,
        async ([albumId, tracks]): Promise<ArtworkRecord> => {
          const cover = findCover(coversByDirectory, tracks[0].path);
          const sourceKey = `${getEntryKey(tracks[0])}#${
            cover ? getEntryKey(cover) : ""
          }`;

          let record = cachedArtwork.get(albumId);

          if (record?.sourceKey !== sourceKey) {
            const original = await findArtwork(tracks);
            record = {
              albumId,
              sourceKey,
              thumbnail: original && (await makeThumbnail(original)),
            };
          }

          done++;
          report();

          return record;
        }
      );

      if (!isCurrent()) {
        return;
      }

      await dbReplaceAll("tracks", records);
      await dbReplaceAll("artwork", artworkRecords);

      releaseArtwork(true);

      const artworkUrls: Record<string, string> = {};

      for (const { albumId, thumbnail } of artworkRecords) {
        if (thumbnail) {
          const url = URL.createObjectURL(thumbnail);
          artworkUrls[albumId] = url;
          thumbnailUrlsRef.current.push(url);
        }
      }

      albumTracksRef.current = albums;
      hasLibraryRef.current = true;

      setIndex(buildIndex(records, artworkUrls));
      setVersion((prev) => prev + 1);
      setProgress({ done: total, total });
      setStatus("ready");
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

  useEffect(() => {
    queueBridge.resolveSongs = (type, id) => {
      if (type === "album") {
        return index.albumsById.get(id)?.songs ?? [];
      }

      const song = index.songsById.get(id);
      return song ? [song] : [];
    };
  }, [index]);

  const value = useMemo(
    () => ({
      status,
      progress,
      version,
      folderName,
      error,
      index,
      chooseFolder,
      reconnect,
      rescan,
      forget,
      getFile,
      getFullArtwork,
    }),
    [
      status,
      progress,
      version,
      folderName,
      error,
      index,
      chooseFolder,
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
