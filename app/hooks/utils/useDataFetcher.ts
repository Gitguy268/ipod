import { useMemo } from "react";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useLibrary } from "@/lib/library";
import { searchIndex } from "@/lib/library/buildIndex";

interface CommonFetcherProps {
  /** Data will not be fetched until the `fetch` function is called. */
  lazy?: boolean;
}

interface PlaylistFetcherProps {
  id: string;
}

interface AlbumFetcherProps {
  id: string;
}

interface ArtistFetcherProps {
  id: string;
}

interface SearchFetcherProps {
  query: string;
}

const STALE_TIME = {
  library: 5 * 60 * 1000,
  detail: 10 * 60 * 1000,
  search: 60 * 1000,
} as const;

export interface DataFetcher {
  fetchAlbums: (
    params: MediaApi.PaginationParams
  ) => Promise<MediaApi.PaginatedResponse<MediaApi.Album[]> | undefined>;
  fetchAlbum: (id: string) => Promise<MediaApi.Album | undefined>;
  fetchSongs: (
    params: MediaApi.PaginationParams
  ) => Promise<MediaApi.PaginatedResponse<MediaApi.Song[]> | undefined>;
  fetchArtists: (
    params: MediaApi.PaginationParams
  ) => Promise<MediaApi.PaginatedResponse<MediaApi.Artist[]> | undefined>;
  fetchArtistAlbums: (id: string) => Promise<MediaApi.Album[] | undefined>;
  fetchPlaylists: (
    params: MediaApi.PaginationParams
  ) => Promise<MediaApi.PaginatedResponse<MediaApi.Playlist[]> | undefined>;
  fetchPlaylist: (id: string) => Promise<MediaApi.Playlist | undefined>;
  fetchSearchResults: (
    query: string
  ) => Promise<MediaApi.SearchResults | undefined>;
}

/** Serves the library that was read from the user's music folder. */
const useLocalDataFetcher = (): DataFetcher => {
  const { index } = useLibrary();

  return useMemo(() => {
    const paginate = <TItem,>(
      items: TItem[],
      { pageParam, limit }: MediaApi.PaginationParams
    ): MediaApi.PaginatedResponse<TItem[]> => {
      const start = Number(pageParam) || 0;
      const end = start + limit;

      return {
        data: items.slice(start, end),
        nextPageParam: end < items.length ? end : undefined,
      };
    };

    return {
      fetchAlbums: async (params) => paginate(index.albums, params),
      fetchAlbum: async (id) => index.albumsById.get(id),
      fetchSongs: async (params) => paginate(index.songs, params),
      fetchArtists: async (params) => paginate(index.artists, params),
      fetchArtistAlbums: async (id) => index.artistsById.get(id)?.albums ?? [],
      fetchPlaylists: async () => ({ data: [] }),
      fetchPlaylist: async () => undefined,
      fetchSearchResults: async (query) => searchIndex(index, query),
    };
  }, [index]);
};

const useResolvedFetcher = () => {
  const fetcher = useLocalDataFetcher();
  const { status, version } = useLibrary();

  // The version is part of every query key so a rescan replaces what was cached.
  return {
    fetcher,
    service: `local-${version}`,
    enabled: status === "ready",
  };
};

export const useFetchAlbum = (
  options: CommonFetcherProps & AlbumFetcherProps
) => {
  const { fetcher, service, enabled } = useResolvedFetcher();

  return useQuery({
    queryKey: [service, "album", { id: options.id }],
    queryFn: () => fetcher.fetchAlbum(options.id),
    staleTime: STALE_TIME.detail,
    enabled: enabled && !options.lazy,
  });
};

export const useFetchAlbums = (
  options: CommonFetcherProps
) => {
  const { fetcher, service, enabled } = useResolvedFetcher();

  return useInfiniteQuery({
    queryKey: [service, "albums"],
    queryFn: ({ pageParam }) =>
      fetcher.fetchAlbums({ pageParam, limit: 50 }),
    staleTime: STALE_TIME.library,
    enabled: enabled && !options.lazy,
    getNextPageParam: (lastPage) => lastPage?.nextPageParam,
    initialPageParam: 0 as number | string,
  });
};

export const useFetchSongs = (options: CommonFetcherProps) => {
  const { fetcher, service, enabled } = useResolvedFetcher();

  return useInfiniteQuery({
    queryKey: [service, "songs"],
    queryFn: ({ pageParam }) => fetcher.fetchSongs({ pageParam, limit: 100 }),
    staleTime: STALE_TIME.library,
    enabled: enabled && !options.lazy,
    getNextPageParam: (lastPage) => lastPage?.nextPageParam,
    initialPageParam: 0 as number | string,
  });
};

export const useFetchArtists = (options: CommonFetcherProps) => {
  const { fetcher, service, enabled } = useResolvedFetcher();

  return useInfiniteQuery({
    queryKey: [service, "artists"],
    queryFn: ({ pageParam }) =>
      fetcher.fetchArtists({ pageParam, limit: 20 }),
    staleTime: STALE_TIME.library,
    enabled: enabled && !options.lazy,
    getNextPageParam: (lastPage) => lastPage?.nextPageParam,
    initialPageParam: 0 as number | string,
  });
};

export const useFetchArtistAlbums = (
  options: CommonFetcherProps & ArtistFetcherProps
) => {
  const { fetcher, service, enabled } = useResolvedFetcher();

  return useQuery({
    queryKey: [service, "artistAlbums", { id: options.id }],
    queryFn: () => fetcher.fetchArtistAlbums(options.id),
    staleTime: STALE_TIME.detail,
    enabled: enabled && !options.lazy,
  });
};

export const useFetchPlaylists = (options: CommonFetcherProps) => {
  const { fetcher, service, enabled } = useResolvedFetcher();

  return useInfiniteQuery({
    queryKey: [service, "playlists"],
    queryFn: ({ pageParam }) =>
      fetcher.fetchPlaylists({ pageParam, limit: 20 }),
    staleTime: STALE_TIME.library,
    enabled: enabled && !options.lazy,
    getNextPageParam: (lastPage) => lastPage?.nextPageParam,
    initialPageParam: 0 as number | string,
  });
};

export const useFetchPlaylist = (
  options: CommonFetcherProps & PlaylistFetcherProps
) => {
  const { fetcher, service, enabled } = useResolvedFetcher();

  return useQuery({
    queryKey: [service, "playlist", { id: options.id }],
    queryFn: () => fetcher.fetchPlaylist(options.id),
    staleTime: STALE_TIME.detail,
    enabled: enabled && !options.lazy,
  });
};

export const useFetchSearchResults = (
  options: CommonFetcherProps & SearchFetcherProps
) => {
  const { fetcher, service, enabled } = useResolvedFetcher();

  return useQuery({
    queryKey: [service, "search", { query: options.query }],
    queryFn: () => fetcher.fetchSearchResults(options.query),
    staleTime: STALE_TIME.search,
    enabled: enabled && !options.lazy,
  });
};
