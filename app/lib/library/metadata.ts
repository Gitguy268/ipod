import { LibraryEntry, RawTags } from "./types";

/** The parser is large, so it only loads once a folder is actually scanned. */
const loadParser = () => import("music-metadata");

/** Reads the text tags of a file. Returns undefined if the file can't be parsed. */
export const readTags = async (
  entry: LibraryEntry
): Promise<RawTags | undefined> => {
  try {
    const { parseBlob } = await loadParser();
    const file = await entry.getFile();
    const { common, format } = await parseBlob(file, { skipCovers: true });

    return {
      title: common.title,
      artist: common.artist,
      albumArtist: common.albumartist,
      album: common.album,
      trackNumber: common.track.no,
      discNumber: common.disk.no,
      durationMs: format.duration ? format.duration * 1000 : undefined,
    };
  } catch (error) {
    console.warn(`Unable to read tags: ${entry.path}`, error);
    return undefined;
  }
};

/** Reads the artwork embedded in a file, preferring the front cover. */
export const readEmbeddedPicture = async (
  entry: LibraryEntry
): Promise<Blob | undefined> => {
  try {
    const { parseBlob, selectCover } = await loadParser();
    const file = await entry.getFile();
    const { common } = await parseBlob(file);
    const picture = selectCover(common.picture);

    if (!picture) {
      return undefined;
    }

    return new Blob([picture.data as BlobPart], { type: picture.format });
  } catch (error) {
    console.warn(`Unable to read artwork: ${entry.path}`, error);
    return undefined;
  }
};

/** Runs `work` over every item, at most `limit` at a time. */
export const mapWithConcurrency = async <TItem, TResult>(
  items: TItem[],
  limit: number,
  work: (item: TItem, index: number) => Promise<TResult>
): Promise<TResult[]> => {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await work(items[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );

  return results;
};
