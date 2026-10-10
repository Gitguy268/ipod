import { getDirectory } from "./buildIndex";
import { LibraryEntry } from "./types";

/** The File System Access API pieces that aren't in TypeScript's DOM types yet. */
type PermissionMode = { mode: "read" };

export type DirectoryHandle = FileSystemDirectoryHandle & {
  values: () => AsyncIterable<FileSystemDirectoryHandle | FileSystemFileHandle>;
  queryPermission: (options: PermissionMode) => Promise<PermissionState>;
  requestPermission: (options: PermissionMode) => Promise<PermissionState>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker: (options: PermissionMode) => Promise<DirectoryHandle>;
};

const AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  m4b: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: 'audio/ogg; codecs="opus"',
  aif: "audio/aiff",
  aiff: "audio/aiff",
};

/** Music formats no browser plays. They are counted so the user can be told. */
const UNSUPPORTED_AUDIO = new Set([
  "wma",
  "ape",
  "wv",
  "dsf",
  "dff",
  "mka",
  "mpc",
  "tta",
  "ra",
  "amr",
  "mid",
  "midi",
]);

const COVER_FILE = /^(cover|folder|front|album|albumart)\.(jpe?g|png|webp)$/i;

const getExtension = (path: string) =>
  path.slice(path.lastIndexOf(".") + 1).toLowerCase();

const getFileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** Chrome and Edge can remember a folder between visits. Safari and Firefox can't. */
export const supportsDirectoryPicker = () =>
  typeof window !== "undefined" && "showDirectoryPicker" in window;

const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

/** Opens the system folder picker. Resolves to undefined if the user cancels. */
export const pickDirectoryHandle = async () => {
  try {
    return await (window as unknown as DirectoryPickerWindow).showDirectoryPicker({
      mode: "read",
    });
  } catch (error) {
    if (isAbort(error)) {
      return undefined;
    }
    throw error;
  }
};

/** Lists every file under a folder handle, however deeply nested. */
export const entriesFromHandle = async (
  root: DirectoryHandle
): Promise<LibraryEntry[]> => {
  const entries: LibraryEntry[] = [];

  const walk = async (directory: DirectoryHandle, prefix: string) => {
    for await (const handle of directory.values()) {
      const path = `${prefix}${handle.name}`;

      if (handle.kind === "directory") {
        await walk(handle as DirectoryHandle, `${path}/`);
        continue;
      }

      if (!isRelevantPath(path)) {
        continue;
      }

      try {
        const file = await handle.getFile();
        entries.push({
          path,
          size: file.size,
          lastModified: file.lastModified,
          getFile: () => handle.getFile(),
        });
      } catch (error) {
        console.warn(`Skipping unreadable file: ${path}`, error);
      }
    }
  };

  await walk(root, "");

  return entries;
};

/**
 * Folder picking for browsers without `showDirectoryPicker`.
 * The browser hands over every file in the folder at once and nothing can be remembered.
 */
export const pickWithInput = () =>
  new Promise<{ name: string; entries: LibraryEntry[] } | undefined>(
    (resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.setAttribute("webkitdirectory", "");

      input.addEventListener("cancel", () => resolve(undefined));
      input.addEventListener("change", () => {
        const files = Array.from(input.files ?? []);

        if (!files.length) {
          resolve(undefined);
          return;
        }

        const name = files[0].webkitRelativePath.split("/")[0] ?? "";

        resolve({
          name,
          entries: files.map((file) => ({
            // Drop the chosen folder's own name so paths match the other picker.
            path: file.webkitRelativePath.split("/").slice(1).join("/"),
            size: file.size,
            lastModified: file.lastModified,
            getFile: async () => file,
          })),
        });
      });

      input.click();
    }
  );

/** A folder that was dragged onto the page, in whichever form the browser offers it. */
export interface DroppedFolder {
  name: string;
  /** Chrome and Edge hand over a handle, which can be remembered like a picked folder. */
  handle?: Promise<DirectoryHandle | undefined>;
  /** Every browser offers this older form. Nothing can be remembered from it. */
  directory?: FileSystemDirectoryEntry;
}

type HandleItem = DataTransferItem & {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
};

/**
 * Picks the dropped folder out of a drop event. This has to run before the drop
 * handler returns: the browser empties the list as soon as it does.
 */
export const readDrop = (
  items: DataTransferItemList
): DroppedFolder | undefined => {
  for (const item of Array.from(items) as HandleItem[]) {
    const entry = item.webkitGetAsEntry?.();

    if (!entry?.isDirectory) {
      continue;
    }

    return {
      name: entry.name,
      directory: entry as FileSystemDirectoryEntry,
      handle: item
        .getAsFileSystemHandle?.()
        .then((handle) =>
          handle?.kind === "directory" ? (handle as DirectoryHandle) : undefined
        )
        .catch(() => undefined),
    };
  }

  return undefined;
};

const readAllEntries = async (directory: FileSystemDirectoryEntry) => {
  const reader = directory.createReader();
  const entries: FileSystemEntry[] = [];

  // The browser returns the contents in batches and signals the end with an empty one.
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject)
    );

    if (!batch.length) {
      return entries;
    }

    entries.push(...batch);
  }
};

const getEntryFile = (entry: FileSystemFileEntry) =>
  new Promise<File>((resolve, reject) => entry.file(resolve, reject));

/** Lists every file under a dropped folder, however deeply nested. */
export const entriesFromDirectoryEntry = async (
  root: FileSystemDirectoryEntry
): Promise<LibraryEntry[]> => {
  const entries: LibraryEntry[] = [];

  const walk = async (directory: FileSystemDirectoryEntry, prefix: string) => {
    for (const entry of await readAllEntries(directory)) {
      const path = `${prefix}${entry.name}`;

      if (entry.isDirectory) {
        await walk(entry as FileSystemDirectoryEntry, `${path}/`);
        continue;
      }

      if (!isRelevantPath(path)) {
        continue;
      }

      try {
        const fileEntry = entry as FileSystemFileEntry;
        const file = await getEntryFile(fileEntry);

        entries.push({
          path,
          size: file.size,
          lastModified: file.lastModified,
          getFile: () => getEntryFile(fileEntry),
        });
      } catch (error) {
        console.warn(`Skipping unreadable file: ${path}`, error);
      }
    }
  };

  await walk(root, "");

  return entries;
};

export const isCoverPath = (path: string) => COVER_FILE.test(getFileName(path));

export const isAudioPath = (path: string) => getExtension(path) in AUDIO_TYPES;

const isUnsupportedAudioPath = (path: string) =>
  UNSUPPORTED_AUDIO.has(getExtension(path));

/** Whether a file is worth listing at all: music (playable or not) or a cover image. */
const isRelevantPath = (path: string) =>
  isAudioPath(path) || isCoverPath(path) || isUnsupportedAudioPath(path);

/**
 * Apple Lossless lives in ordinary .m4a files, so it can only be recognised once
 * the file has been read. Chrome and Firefox can't play it; Safari can.
 */
export const canPlayCodec = (codec?: string) =>
  !codec ||
  !/alac/i.test(codec) ||
  document.createElement("audio").canPlayType('audio/mp4; codecs="alac"') !==
    "";

/**
 * Splits a folder listing into playable audio files and one cover image per folder,
 * and counts the music files this browser has no way of playing.
 */
export const classifyEntries = (entries: LibraryEntry[]) => {
  const probe = document.createElement("audio");
  const playable = new Map<string, boolean>();

  const canPlay = (path: string) => {
    const extension = getExtension(path);

    if (!playable.has(extension)) {
      playable.set(extension, probe.canPlayType(AUDIO_TYPES[extension]) !== "");
    }

    return playable.get(extension);
  };

  const audio: LibraryEntry[] = [];
  const coversByDirectory = new Map<string, LibraryEntry>();
  let unplayableCount = 0;

  for (const entry of entries) {
    // Skip macOS resource forks ("._Song.mp3") and other hidden files.
    if (getFileName(entry.path).startsWith(".")) {
      continue;
    }

    if (isCoverPath(entry.path)) {
      const directory = getDirectory(entry.path);
      if (!coversByDirectory.has(directory)) {
        coversByDirectory.set(directory, entry);
      }
    } else if (isAudioPath(entry.path) && canPlay(entry.path)) {
      audio.push(entry);
    } else if (isAudioPath(entry.path) || isUnsupportedAudioPath(entry.path)) {
      unplayableCount++;
    }
  }

  return { audio, coversByDirectory, unplayableCount };
};
