import styled from "styled-components";

import GelButton from "@/components/GelButton";
import { useAudioPlayer } from "@/hooks";
import * as Utils from "@/utils";
import { Unit } from "@/utils/constants";
import { pluralize } from "@/utils/strings";

import {
  BackButton,
  Byline,
  Cover,
  Details,
  Heading,
  SongRow,
  SongRowMeta,
  SongRowTitle,
  SplitLayout,
  SUBDUED,
  TextButton,
} from "./styles";
import useFullArtwork from "./useFullArtwork";

const Layout = styled(SplitLayout)`
  align-items: start;
`;

const StickyCover = styled.div`
  position: sticky;
  top: ${Unit.XXL};
`;

const Summary = styled.p`
  margin: ${Unit.XS} 0 0;
  font-size: 14px;
  color: ${SUBDUED};
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${Unit.MD};
  margin: ${Unit.LG} 0;
`;

const TrackNumber = styled(SongRowMeta)`
  text-align: right;
  padding-right: ${Unit.XXS};
`;

const TrackArtist = styled.span`
  margin-left: ${Unit.XS};
  font-weight: 400;
  color: ${SUBDUED};
`;

const getSummary = (album: MediaApi.Album) => {
  const count = album.songs.length;
  const minutes = Math.round(
    album.songs.reduce((total, song) => total + song.duration, 0) / 60000
  );

  return [
    album.year,
    `${count} ${pluralize("song", "songs", count)}`,
    minutes > 0 && `${minutes} ${pluralize("minute", "minutes", minutes)}`,
  ]
    .filter(Boolean)
    .join(", ");
};

interface Props {
  album: MediaApi.Album;
  onBack: () => void;
  /** Called once something from the album has been started. */
  onPlay: () => void;
}

/** An album's cover and its songs. */
const AlbumPage = ({ album, onBack, onPlay }: Props) => {
  const { nowPlayingItem, play } = useAudioPlayer();
  const artworkUrl = useFullArtwork(album);

  const playFrom = (startPosition: number) => {
    play({ album, startPosition });
    onPlay();
  };

  const playShuffled = () => {
    play({ songs: Utils.shuffle(album.songs) });
    onPlay();
  };

  return (
    <>
      <BackButton onClick={onBack}>‹ Albums</BackButton>
      <Layout>
        <StickyCover>
          <Cover $size="medium" src={artworkUrl} alt={`${album.name} cover`} />
        </StickyCover>
        <Details>
          <Heading>{album.name}</Heading>
          <Byline>{album.artistName}</Byline>
          <Summary>{getSummary(album)}</Summary>
          <Actions>
            <GelButton onClick={() => playFrom(0)}>Play</GelButton>
            <TextButton onClick={playShuffled}>Shuffle</TextButton>
          </Actions>
          {album.songs.map((song, position) => (
            <SongRow
              key={song.id}
              $isCurrent={nowPlayingItem?.id === song.id}
              onClick={() => playFrom(position)}
            >
              <TrackNumber>{song.trackNumber || position + 1}</TrackNumber>
              <SongRowTitle>
                {song.name}
                {song.artistName !== album.artistName && (
                  <TrackArtist>{song.artistName}</TrackArtist>
                )}
              </SongRowTitle>
              <SongRowMeta>
                {song.duration > 0 &&
                  Utils.formatPlaybackTime(song.duration / 1000)}
              </SongRowMeta>
            </SongRow>
          ))}
        </Details>
      </Layout>
    </>
  );
};

export default AlbumPage;
