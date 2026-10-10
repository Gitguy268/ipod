import { useMemo, useState } from "react";

import styled from "styled-components";

import { useAudioPlayer } from "@/hooks";
import { useLibrary } from "@/lib/library";
import { searchIndex } from "@/lib/library/buildIndex";
import * as Utils from "@/utils";
import { Unit } from "@/utils/constants";
import { pluralize } from "@/utils/strings";

import {
  FOCUS_RING,
  SongRow,
  SongRowMeta,
  SongRowTitle,
  SUBDUED,
  TextButton,
} from "./styles";

/** How many matching songs to list under the albums when searching. */
const MAX_SONG_RESULTS = 30;

const Layout = styled.div`
  padding: ${Unit.XXL} clamp(${Unit.MD}, 4vw, ${Unit.XXL}) ${Unit.XL};
`;

const Header = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: ${Unit.XS} ${Unit.SM};
  margin-bottom: ${Unit.LG};
`;

const Title = styled.h1`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.01em;
`;

const Count = styled.span`
  flex: 1;
  font-size: 14px;
  color: ${SUBDUED};
`;

const Search = styled.input`
  width: 14rem;
  padding: 5px 12px;
  font: inherit;
  font-size: 13px;
  color: white;
  border: 1px solid #3a3a3a;
  border-radius: 999px;
  background: #161616;

  &::placeholder {
    color: #777;
  }

  &:focus-visible {
    outline: ${FOCUS_RING};
    outline-offset: 1px;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: ${Unit.LG} ${Unit.MD};
`;

const AlbumButton = styled.button`
  min-width: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  border: none;
  background: none;
  cursor: pointer;
  /* Long libraries have thousands of covers. Skip the ones that are off-screen. */
  content-visibility: auto;
  contain-intrinsic-size: auto 200px;

  &:focus-visible {
    outline: ${FOCUS_RING};
    outline-offset: 4px;
  }
`;

const AlbumCover = styled.img`
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border: 1px solid #2a2a2a;

  ${AlbumButton}:hover & {
    border-color: #8a8a8a;
  }
`;

const AlbumName = styled.div`
  margin-top: ${Unit.XS};
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AlbumArtist = styled(AlbumName)`
  margin-top: 1px;
  font-weight: 400;
  color: ${SUBDUED};
`;

const SectionTitle = styled.h2`
  margin: ${Unit.XL} 0 ${Unit.XS};
  font-size: 1.125rem;
  font-weight: 600;
`;

const SongResults = styled.div`
  max-width: 48rem;
`;

const ResultRow = styled(SongRow)`
  grid-template-columns: minmax(0, 1fr) minmax(0, auto);
  gap: ${Unit.MD};
`;

const Empty = styled.p`
  margin: ${Unit.XL} 0;
  color: ${SUBDUED};
`;

interface Props {
  onOpenAlbum: (album: MediaApi.Album) => void;
  onShowNowPlaying: () => void;
  /** Called once a song has been started from the search results. */
  onPlay: () => void;
}

/** Every album cover in the library, with a search box to narrow them down. */
const AlbumWall = ({ onOpenAlbum, onShowNowPlaying, onPlay }: Props) => {
  const { index, skippedCount } = useLibrary();
  const { nowPlayingItem, play } = useAudioPlayer();
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => (query.trim() ? searchIndex(index, query) : undefined),
    [index, query]
  );

  const albums = useMemo(() => {
    if (!results) {
      return index.albums;
    }

    // An artist's name brings up all of their albums too.
    const found = new Set([
      ...results.albums,
      ...results.artists.flatMap((artist) => artist.albums ?? []),
    ]);

    return index.albums.filter((album) => found.has(album));
  }, [index.albums, results]);

  const songs = results?.songs ?? [];

  const playResult = (startPosition: number) => {
    play({ songs, startPosition });
    onPlay();
  };

  return (
    <Layout>
      <Header>
        <Title>Albums</Title>
        <Count>
          {albums.length.toLocaleString()}{" "}
          {pluralize("album", "albums", albums.length)}
          {!results &&
            skippedCount > 0 &&
            `, ${skippedCount.toLocaleString()} unplayable ${pluralize(
              "file",
              "files",
              skippedCount
            )} left out`}
        </Count>
        <Search
          type="search"
          value={query}
          placeholder="Search"
          aria-label="Search your library"
          onChange={(event) => setQuery(event.target.value)}
        />
        {nowPlayingItem && (
          <TextButton onClick={onShowNowPlaying}>Now Playing ›</TextButton>
        )}
      </Header>

      <Grid>
        {albums.map((album) => (
          <AlbumButton key={album.id} onClick={() => onOpenAlbum(album)}>
            <AlbumCover
              src={Utils.getArtwork(300, album.artwork?.url)}
              alt=""
              loading="lazy"
            />
            <AlbumName>{album.name}</AlbumName>
            <AlbumArtist>{album.artistName}</AlbumArtist>
          </AlbumButton>
        ))}
      </Grid>

      {songs.length > 0 && (
        <SongResults>
          <SectionTitle>Songs</SectionTitle>
          {songs.slice(0, MAX_SONG_RESULTS).map((song, position) => (
            <ResultRow key={song.id} onClick={() => playResult(position)}>
              <SongRowTitle>{song.name}</SongRowTitle>
              <SongRowMeta>
                {song.artistName}, {song.albumName}
              </SongRowMeta>
            </ResultRow>
          ))}
        </SongResults>
      )}

      {results && !albums.length && !songs.length && (
        <Empty>Nothing in your library matches “{query.trim()}”.</Empty>
      )}
    </Layout>
  );
};

export default AlbumWall;
