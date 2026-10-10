import type { LibraryIndex, RawTags, TrackRecord } from "./types";

// This file has no browser or app imports so it can be checked with plain Node.

const UNKNOWN_ALBUM = "Unknown Album";
const UNKNOWN_ARTIST = "Unknown Artist";
const VARIOUS_ARTISTS = "Various Artists";

const normalize = (value: string) => value.trim().toLowerCase();

const compare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

export const getDirectory = (path: string) => {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
};

export const getEntryKey = (entry: {
  path: string;
  size: number;
  lastModified: number;
}) => `${entry.path}|${entry.size}|${entry.lastModified}`;

/**
 * Fills in whatever the tags are missing from the file path:
 * "Artist/Album/03 - Title.mp3" gives artist, album, track number and title.
 */
export const toTrackRecord = (
  file: { path: string; size: number; lastModified: number },
  tags: RawTags | undefined,
  rootName = ""
): TrackRecord => {
  const albumDirectory = getAlbumDirectory(file.path);
  const fileName = file.path.slice(file.path.lastIndexOf("/") + 1);
  const segments = [rootName, ...albumDirectory.split("/"), fileName].filter(
    Boolean
  );
  const folder = segments[segments.length - 2];
  const parentFolder = segments[segments.length - 3];

  const baseName = fileName.replace(/\.[^.]+$/, "");
  const numbered = baseName.match(/^(\d{1,3})[\s._-]+(.+)$/);

  return {
    path: file.path,
    size: file.size,
    lastModified: file.lastModified,
    title: tags?.title?.trim() || numbered?.[2] || baseName,
    artist: tags?.artist?.trim() || parentFolder || UNKNOWN_ARTIST,
    albumArtist: tags?.albumArtist?.trim() || undefined,
    album: tags?.album?.trim() || folder || UNKNOWN_ALBUM,
    trackNumber: tags?.trackNumber || (numbered ? Number(numbered[1]) : 0),
    discNumber: tags?.discNumber || 1,
    durationMs: Math.round(tags?.durationMs ?? 0),
    genre: tags?.genre?.trim() || undefined,
    year: tags?.year || undefined,
    codec: tags?.codec,
  };
};

const DISC_FOLDER = /^(cd|dis[ck])[\s._-]*\d+$/i;

/** The folder an album lives in. "Album/CD1" and "Album/Disc 2" both count as "Album". */
export const getAlbumDirectory = (path: string) => {
  const directory = getDirectory(path);
  const name = directory.slice(directory.lastIndexOf("/") + 1);

  return DISC_FOLDER.test(name) ? getDirectory(directory) : directory;
};

/**
 * Tracks belong to the same album when they share an album artist and album name.
 * Without an album artist tag we group by folder instead, so a compilation with
 * a different artist on every track still stays together.
 */
export const getAlbumId = (record: TrackRecord) =>
  record.albumArtist
    ? `artist:${normalize(record.albumArtist)}|${normalize(record.album)}`
    : `folder:${getAlbumDirectory(record.path)}|${normalize(record.album)}`;

export const getArtistId = (name: string) => `artist:${normalize(name)}`;

const getAlbumArtistName = (records: TrackRecord[]) => {
  if (records[0].albumArtist) {
    return records[0].albumArtist;
  }

  const names = new Set(records.map((record) => normalize(record.artist)));
  return names.size === 1 ? records[0].artist : VARIOUS_ARTISTS;
};

export const groupByAlbum = (records: TrackRecord[]) => {
  const groups = new Map<string, TrackRecord[]>();

  for (const record of records) {
    const id = getAlbumId(record);
    const group = groups.get(id);
    if (group) {
      group.push(record);
    } else {
      groups.set(id, [record]);
    }
  }

  for (const group of groups.values()) {
    group.sort(
      (a, b) =>
        a.discNumber - b.discNumber ||
        a.trackNumber - b.trackNumber ||
        compare(a.path, b.path)
    );
  }

  return groups;
};

/** Turns track records into the songs, albums and artists the views display. */
export const buildIndex = (
  records: TrackRecord[],
  artworkUrls: Record<string, string | undefined> = {}
): LibraryIndex => {
  const albums: MediaApi.Album[] = [];

  for (const [id, group] of groupByAlbum(records)) {
    const artwork = artworkUrls[id] ? { url: artworkUrls[id] } : undefined;

    albums.push({
      id,
      name: group[0].album,
      artistName: getAlbumArtistName(group),
      url: id,
      artwork,
      songs: group.map((record) => ({
        id: record.path,
        url: record.path,
        name: record.title,
        albumName: record.album,
        artistName: record.artist,
        duration: record.durationMs,
        trackNumber: record.trackNumber,
        artwork,
      })),
    });
  }

  albums.sort(
    (a, b) =>
      compare(a.name, b.name) || compare(a.artistName ?? "", b.artistName ?? "")
  );

  const artistsById = new Map<string, MediaApi.Artist>();

  for (const album of albums) {
    const name = album.artistName ?? UNKNOWN_ARTIST;
    const id = getArtistId(name);
    const artist = artistsById.get(id);

    if (artist) {
      artist.albums?.push(album);
      artist.artwork ??= album.artwork;
    } else {
      artistsById.set(id, {
        id,
        name,
        url: id,
        artwork: album.artwork,
        albums: [album],
      });
    }
  }

  const artists = [...artistsById.values()].sort((a, b) =>
    compare(a.name, b.name)
  );

  const songs = albums
    .flatMap((album) => album.songs)
    .sort((a, b) => compare(a.name, b.name));

  return {
    songs,
    albums,
    artists,
    songsById: new Map(songs.map((song) => [song.id, song])),
    albumsById: new Map(albums.map((album) => [album.id, album])),
    artistsById,
    albumIdBySongId: new Map(
      albums.flatMap((album) => album.songs.map((song) => [song.id, album.id]))
    ),
  };
};

const matches = (query: string, ...fields: (string | undefined)[]) =>
  fields.some((field) => field?.toLowerCase().includes(query));

export const searchIndex = (
  index: LibraryIndex,
  query: string
): MediaApi.SearchResults => {
  const term = normalize(query);

  if (!term) {
    return { artists: [], albums: [], songs: [], playlists: [] };
  }

  return {
    artists: index.artists.filter((artist) => matches(term, artist.name)),
    albums: index.albums.filter((album) =>
      matches(term, album.name, album.artistName)
    ),
    songs: index.songs.filter((song) =>
      matches(term, song.name, song.artistName, song.albumName)
    ),
    playlists: [],
  };
};
