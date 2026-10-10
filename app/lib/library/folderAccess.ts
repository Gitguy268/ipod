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

      if (!isAudioPath(path) && !isCoverPath(path)) {
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

export const isCoverPath = (path: string) => COVER_FILE.test(getFileName(path));

export const isAudioPath = (path: string) => getExtension(path) in AUDIO_TYPES;

/** Splits a folder listing into playable audio files and one cover image per folder. */
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
    }
  }

  return { audio, coversByDirectory };
};
