import { useEffect, useState } from "react";

import styled from "styled-components";

import FastForwardIcon from "@/components/ClickWheel/icons/FastForwardIcon";
import PlayPauseIcon from "@/components/ClickWheel/icons/PlayPauseIcon";
import RewindIcon from "@/components/ClickWheel/icons/RewindIcon";
import FolderButton from "@/components/FolderButton";
import GelBar from "@/components/GelBar";
import { useAudioPlayer, useInterval } from "@/hooks";
import { useLibrary } from "@/lib/library";
import * as Utils from "@/utils";
import { Unit } from "@/utils/constants";
import { APP_URL } from "@/utils/constants/api";
import { pluralize } from "@/utils/strings";

const SUBDUED = "#9a9da1";

/** The black Cover Flow stage, filling the window. */
const Stage = styled.div`
  position: fixed;
  inset: 0;
  overflow: auto;
  color: white;
  background: black;
`;

const TextButton = styled.button`
  padding: 0;
  font: inherit;
  font-size: 14px;
  color: ${SUBDUED};
  border: none;
  background: none;
  cursor: pointer;

  &:hover {
    color: white;
  }

  &:focus-visible {
    outline: 2px solid #2dd7ff;
    outline-offset: 4px;
  }
`;

// Now playing

const NowPlayingLayout = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 34rem);
  align-items: center;
  justify-content: center;
  gap: clamp(${Unit.XL}, 6vw, 6rem);
  min-height: 100%;
  padding: ${Unit.XXL} clamp(${Unit.LG}, 5vw, ${Unit.XXL});

  @media (max-width: 800px) {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    align-content: start;
    gap: ${Unit.XL};
  }
`;

const BackButton = styled(TextButton)`
  position: absolute;
  top: calc(${Unit.SM} + env(safe-area-inset-top) + 3px);
  left: ${Unit.MD};
`;

const Cover = styled.img`
  display: block;
  width: min(62vh, 44vw);
  aspect-ratio: 1;
  object-fit: cover;
  border: 1px solid #2a2a2a;
  /* The floor reflection from Cover Flow. Browsers without it show a plain cover. */
  -webkit-box-reflect: below 2px
    linear-gradient(transparent 68%, rgba(255, 255, 255, 0.22));

  @media (max-width: 800px) {
    width: min(46vh, 78vw);
    -webkit-box-reflect: unset;
  }
`;

const Details = styled.div`
  min-width: 0;
  width: 100%;
`;

const SongTitle = styled.h1`
  margin: 0;
  font-size: clamp(1.75rem, 3.6vw, 3.5rem);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
`;

const Byline = styled.p`
  margin: ${Unit.XS} 0 0;
  font-size: clamp(1rem, 1.6vw, 1.5rem);
  font-weight: 500;
  color: ${SUBDUED};
  overflow-wrap: anywhere;
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
    outline: 2px solid #2dd7ff;
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

// Album grid

const GridLayout = styled.div`
  padding: ${Unit.XXL} clamp(${Unit.MD}, 4vw, ${Unit.XXL}) ${Unit.XL};
`;

const GridHeader = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${Unit.SM};
  margin-bottom: ${Unit.LG};
`;

const GridTitle = styled.h1`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.01em;
`;

const GridCount = styled.span`
  flex: 1;
  font-size: 14px;
  color: ${SUBDUED};
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
    outline: 2px solid #2dd7ff;
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

// Empty states

const Notice = styled.div`
  display: grid;
  place-content: center;
  justify-items: center;
  gap: ${Unit.SM};
  min-height: 100%;
  padding: ${Unit.XL};
  text-align: center;

  h1 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  p {
    margin: 0 0 ${Unit.XS};
    max-width: 26rem;
    line-height: 1.45;
    color: ${SUBDUED};
  }
`;

/** Massive mode: one album cover as large as the window allows, or a wall of them to pick from. */
const MassivePlayer = () => {
  const { status, index, folderName, getFullArtwork } = useLibrary();
  const {
    nowPlayingItem,
    playbackInfo,
    volume,
    play,
    togglePlayPause,
    skipNext,
    skipPrevious,
    seekToTime,
    setVolume,
    updatePlaybackInfo,
  } = useAudioPlayer();
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [fullArtwork, setFullArtwork] = useState<{ id: string; url: string }>();

  useInterval(updatePlaybackInfo, 500, !playbackInfo.isPlaying);

  const albumId = nowPlayingItem
    ? index.albumIdBySongId.get(nowPlayingItem.id)
    : undefined;

  // The thumbnail shows straight away and is swapped for the original once it is read.
  useEffect(() => {
    if (!albumId) {
      return;
    }

    let isCurrent = true;

    getFullArtwork(albumId).then((url) => {
      if (isCurrent && url) {
        setFullArtwork({ id: albumId, url });
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [albumId, getFullArtwork]);

  if (status !== "ready") {
    return (
      <Stage>
        <Notice>
          {status === "scanning" ? (
            <h1>Loading your library</h1>
          ) : status === "needsPermission" ? (
            <>
              <h1>Reconnect your music</h1>
              <p>
                Your browser needs your permission again before it can read
                the folder.
              </p>
            </>
          ) : (
            <>
              <h1>Choose your music folder</h1>
              <p>
                Songs play straight from your computer. Nothing is uploaded
                or copied.
              </p>
            </>
          )}
          <FolderButton />
        </Notice>
      </Stage>
    );
  }

  if (!index.albums.length) {
    return (
      <Stage>
        <Notice>
          <h1>No music found</h1>
          <p>
            {folderName ? `“${folderName}”` : "That folder"} has no audio
            files this browser can play.
          </p>
          <FolderButton showWhenReady />
        </Notice>
      </Stage>
    );
  }

  if (nowPlayingItem && !isBrowsing) {
    const { percent, duration, currentTime, timeRemaining } = playbackInfo;
    const artworkUrl =
      fullArtwork && fullArtwork.id === albumId
        ? fullArtwork.url
        : Utils.getArtwork(600, nowPlayingItem.artwork?.url);

    return (
      <Stage>
        <BackButton onClick={() => setIsBrowsing(true)}>‹ Albums</BackButton>
        <NowPlayingLayout>
          <Cover src={artworkUrl} alt={`${nowPlayingItem.albumName} cover`} />
          <Details>
            <SongTitle>{nowPlayingItem.name}</SongTitle>
            <Byline>{nowPlayingItem.artistName}</Byline>
            <Byline>{nowPlayingItem.albumName}</Byline>
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
                aria-label={playbackInfo.isPlaying ? "Pause" : "Play"}
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
          </Details>
        </NowPlayingLayout>
      </Stage>
    );
  }

  const albumCount = index.albums.length;

  return (
    <Stage>
      <GridLayout>
        <GridHeader>
          <GridTitle>Albums</GridTitle>
          <GridCount>
            {albumCount.toLocaleString()}{" "}
            {pluralize("album", "albums", albumCount)}
          </GridCount>
          {nowPlayingItem && (
            <TextButton onClick={() => setIsBrowsing(false)}>
              Now Playing ›
            </TextButton>
          )}
        </GridHeader>
        <Grid>
          {index.albums.map((album) => (
            <AlbumButton
              key={album.id}
              onClick={() => {
                play({ album, startPosition: 0 });
                setIsBrowsing(false);
              }}
            >
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
      </GridLayout>
    </Stage>
  );
};

export default MassivePlayer;
