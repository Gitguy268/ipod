import type {
  LibraryIndex,
  PlaylistFile,
  RawTags,
  TrackRecord,
} from "./types";

// This file has no browser or app imports so it can be checked with plain Node.

const UNKNOWN_ALBUM = "Unknown Album";
const UNKNOWN_ARTIST = "Unknown Artist";
const VARIOUS_ARTISTS = "Various Artists";

const normalize = (value: string) => value.trim().toLowerCase();

const compare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

/** "The Beatles" files under B, as on a record shop shelf. */
const getSortName = (name: string) => name.replace(/^the\s+/i, "");

/** The value that occurs most often, ignoring blanks. */
const mostCommon = <TValue,>(values: (TValue | undefined)[]) => {
  const counts = new Map<TValue, number>();
  let best: TValue | undefined;

  for (const value of values) {
    if (value === undefined) {
      continue;
    }

    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);

    if (best === undefined || count > (counts.get(best) ?? 0)) {
      best = value;
    }
  }

  return best;
};

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

const getPathSegments = (path: string) => path.split("/").filter(Boolean);

/** Resolves "." and ".." so "Playlists/../Artist/Song.mp3" becomes "Artist/Song.mp3". */
const resolveRelativePath = (directory: string, relativePath: string) => {
  const segments = getPathSegments(directory);

  for (const segment of getPathSegments(relativePath)) {
    if (segment === "..") {
      segments.pop();
    } else if (segment !== ".") {
      segments.push(segment);
    }
  }

  return segments.join("/");
};

/**
 * Works out which library songs a playlist file refers to.
 *
 * Players write these files in many ways: paths relative to the playlist, Windows
 * backslashes, web-style %20 escapes, or the full path the music had on the
 * computer that made the list. Each line is tried as written, and then by
 * matching as much of the end of the path as possible.
 */
export const resolvePlaylist = (
  playlist: PlaylistFile,
  songPaths: string[]
): string[] => {
  const byLowerPath = new Map(
    songPaths.map((path) => [path.toLowerCase(), path])
  );
  const directory = getDirectory(playlist.path);
  const resolved: string[] = [];

  for (const rawLine of playlist.text.split(/\r?\n/)) {
    let line = rawLine.trim().replace(/^\uFEFF/, "");

    if (!line || line.startsWith("#")) {
      continue;
    }

    line = line.replace(/^file:\/\//i, "").replace(/\\/g, "/");

    if (/%[0-9a-f]{2}/i.test(line)) {
      try {
        line = decodeURIComponent(line);
      } catch {
        // Not an escaped path after all; use it as written.
      }
    }

    const isAbsolute = line.startsWith("/") || /^[a-z]:\//i.test(line);

    const exact =
      (!isAbsolute &&
        byLowerPath.get(resolveRelativePath(directory, line).toLowerCase())) ||
      byLowerPath.get(getPathSegments(line).join("/").toLowerCase());

    if (exact) {
      resolved.push(exact);
      continue;
    }

    // Longest matching ending wins. A bare file name only counts if it is unique.
    const segments = getPathSegments(line.toLowerCase());

    for (let length = segments.length - 1; length >= 1; length--) {
      const ending = segments.slice(-length).join("/");
      const candidates = songPaths.filter((path) => {
        const lower = path.toLowerCase();
        return lower === ending || lower.endsWith(`/${ending}`);
      });

      if (candidates.length === 1 || (candidates.length > 1 && length > 1)) {
        resolved.push(candidates[0]);
        break;
      }

      if (candidates.length > 1) {
        break;
      }
    }
  }

  return resolved;
};

/** Turns track records into the songs, albums and artists the views display. */
export const buildIndex = (
  records: TrackRecord[],
  artworkUrls: Record<string, string | undefined> = {},
  playlistFiles: PlaylistFile[] = []
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
      year: mostCommon(group.map((record) => record.year)),
      genre: mostCommon(group.map((record) => record.genre)),
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
    compare(getSortName(a.name), getSortName(b.name))
  );

  // Within an artist, albums run from earliest to latest, undated ones last.
  for (const artist of artists) {
    artist.albums?.sort(
      (a, b) =>
        (a.year ?? Infinity) - (b.year ?? Infinity) || compare(a.name, b.name)
    );
    artist.artwork = artist.albums?.find((album) => album.artwork)?.artwork;
  }

  const genresById = new Map<string, MediaApi.Genre>();

  for (const album of albums) {
    if (!album.genre) {
      continue;
    }

    const id = `genre:${normalize(album.genre)}`;
    const genre = genresById.get(id);

    if (genre) {
      genre.albums.push(album);
    } else {
      genresById.set(id, { id, name: album.genre, albums: [album] });
    }
  }

  const genres = [...genresById.values()].sort((a, b) =>
    compare(a.name, b.name)
  );

  const songs = albums
    .flatMap((album) => album.songs)
    .sort((a, b) => compare(a.name, b.name));

  const songsById = new Map(songs.map((song) => [song.id, song]));
  const songPaths = [...songsById.keys()];

  const playlists = playlistFiles
    .map((file): MediaApi.Playlist => {
      const playlistSongs = resolvePlaylist(file, songPaths)
        .map((path) => songsById.get(path))
        .filter((song): song is MediaApi.Song => !!song);
      const fileName = file.path.slice(file.path.lastIndexOf("/") + 1);

      return {
        id: `playlist:${file.path}`,
        name: fileName.replace(/\.[^.]+$/, ""),
        url: file.path,
        curatorName: "",
        description: `${playlistSongs.length} ${
          playlistSongs.length === 1 ? "song" : "songs"
        }`,
        artwork: playlistSongs.find((song) => song.artwork)?.artwork,
        songs: playlistSongs,
      };
    })
    .filter((playlist) => playlist.songs.length > 0)
    .sort((a, b) => compare(a.name, b.name));

  return {
    songs,
    albums,
    artists,
    genres,
    playlists,
    playlistsById: new Map(
      playlists.map((playlist) => [playlist.id, playlist])
    ),
    songsById,
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
    playlists: index.playlists.filter((playlist) =>
      matches(term, playlist.name)
    ),
  };
};
