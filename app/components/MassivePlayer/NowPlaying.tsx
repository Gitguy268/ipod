import styled from "styled-components";

import FastForwardIcon from "@/components/ClickWheel/icons/FastForwardIcon";
import PlayPauseIcon from "@/components/ClickWheel/icons/PlayPauseIcon";
import RewindIcon from "@/components/ClickWheel/icons/RewindIcon";
import GelBar from "@/components/GelBar";
import { useAudioPlayer, useInterval } from "@/hooks";
import * as Utils from "@/utils";
import { Unit } from "@/utils/constants";
import { APP_URL } from "@/utils/constants/api";

import {
  BackButton,
  Byline,
  Cover,
  Details,
  FOCUS_RING,
  Heading,
  SplitLayout,
  SUBDUED,
  TextButton,
} from "./styles";
import UpNext from "./UpNext";
import useFullArtwork from "./useFullArtwork";

const AlbumLink = styled(TextButton)`
  font: inherit;
  color: inherit;
`;

const ProgressRow = styled.div`
  margin-top: ${Unit.XL};
`;

const Times = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: ${Unit.XS};
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: ${SUBDUED};
`;

const Transport = styled.div`
  display: flex;
  align-items: center;
  gap: ${Unit.XS};
  margin-top: ${Unit.LG};
  margin-left: -${Unit.SM};
`;

const TransportButton = styled.button`
  display: grid;
  place-items: center;
  padding: ${Unit.SM};
  border: none;
  background: none;
  cursor: pointer;

  svg {
    height: 22px;
    width: auto;
  }

  &:active {
    opacity: 0.6;
  }

  &:focus-visible {
    outline: ${FOCUS_RING};
    outline-offset: -2px;
  }
`;

const Volume = styled.div`
  display: flex;
  align-items: center;
  gap: ${Unit.XS};
  width: 180px;
  margin-left: auto;
`;

const VolumeIcon = styled.img`
  height: 12px;
  filter: brightness(1.4);
`;

interface Props {
  /** The album the current song belongs to, if it is still in the library. */
  album?: MediaApi.Album;
  onBack: () => void;
  onOpenAlbum: (album: MediaApi.Album) => void;
}

/** One song, with its cover as large as the window allows. */
const NowPlaying = ({ album, onBack, onOpenAlbum }: Props) => {
  const {
    nowPlayingItem,
    playbackInfo,
    volume,
    togglePlayPause,
    skipNext,
    skipPrevious,
    seekToTime,
    setVolume,
    updatePlaybackInfo,
  } = useAudioPlayer();
  const artworkUrl = useFullArtwork(album);

  useInterval(updatePlaybackInfo, 500, !playbackInfo.isPlaying);

  if (!nowPlayingItem) {
    return null;
  }

  const { percent, duration, currentTime, timeRemaining, isPlaying } =
    playbackInfo;

  return (
    <>
      <BackButton onClick={onBack}>‹ Albums</BackButton>
      <SplitLayout>
        <Cover
          src={
            album ? artworkUrl : Utils.getArtwork(600, nowPlayingItem.artwork?.url)
          }
          alt={`${nowPlayingItem.albumName} cover`}
        />
        <Details>
          <Heading>{nowPlayingItem.name}</Heading>
          <Byline>{nowPlayingItem.artistName}</Byline>
          <Byline>
            {album ? (
              <AlbumLink onClick={() => onOpenAlbum(album)}>
                {nowPlayingItem.albumName}
              </AlbumLink>
            ) : (
              nowPlayingItem.albumName
            )}
          </Byline>
          <ProgressRow>
            <GelBar
              percent={percent}
              height={14}
              label="Track position"
              onChange={(value) => seekToTime((value / 100) * duration)}
            />
            <Times>
              <span>{Utils.formatPlaybackTime(currentTime)}</span>
              <span>-{Utils.formatPlaybackTime(timeRemaining)}</span>
            </Times>
          </ProgressRow>
          <Transport>
            <TransportButton aria-label="Previous" onClick={skipPrevious}>
              <RewindIcon color="white" />
            </TransportButton>
            <TransportButton
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={togglePlayPause}
            >
              <PlayPauseIcon color="white" />
            </TransportButton>
            <TransportButton aria-label="Next" onClick={skipNext}>
              <FastForwardIcon color="white" />
            </TransportButton>
            <Volume>
              <VolumeIcon src={`${APP_URL}/volume_mute.svg`} alt="" />
              <GelBar
                percent={volume * 100}
                height={8}
                label="Volume"
                onChange={(value) => setVolume(value / 100)}
              />
              <VolumeIcon src={`${APP_URL}/volume_full.svg`} alt="" />
            </Volume>
          </Transport>
          <UpNext />
        </Details>
      </SplitLayout>
    </>
  );
};

export default NowPlaying;
