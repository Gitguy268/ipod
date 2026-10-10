/** A file inside the chosen music folder, regardless of how the folder was opened. */
export interface LibraryEntry {
  /** Path relative to the chosen folder, using forward slashes. */
  path: string;
  size: number;
  lastModified: number;
  getFile: () => Promise<File>;
}

/** The tags we keep for a track. This is what gets cached between visits. */
export interface TrackRecord {
  path: string;
  size: number;
  lastModified: number;
  title: string;
  artist: string;
  albumArtist?: string;
  album: string;
  trackNumber: number;
  discNumber: number;
  durationMs: number;
  genre?: string;
  year?: number;
  /** The audio encoding inside the file, e.g. "ALAC". Not every browser plays every one. */
  codec?: string;
}

/** Tags as read from a file. Anything missing is filled in from the file path. */
export interface RawTags {
  title?: string;
  artist?: string;
  albumArtist?: string;
  album?: string;
  trackNumber?: number | null;
  discNumber?: number | null;
  durationMs?: number;
  genre?: string;
  year?: number;
  codec?: string;
}

export interface LibraryIndex {
  songs: MediaApi.Song[];
  albums: MediaApi.Album[];
  artists: MediaApi.Artist[];
  genres: MediaApi.Genre[];
  playlists: MediaApi.Playlist[];
  playlistsById: Map<string, MediaApi.Playlist>;
  songsById: Map<string, MediaApi.Song>;
  albumsById: Map<string, MediaApi.Album>;
  artistsById: Map<string, MediaApi.Artist>;
  albumIdBySongId: Map<string, string>;
}

/** A playlist file as found in the folder, before its lines are matched to songs. */
export interface PlaylistFile {
  path: string;
  text: string;
}

export type LibraryStatus = "empty" | "needsPermission" | "scanning" | "ready";
