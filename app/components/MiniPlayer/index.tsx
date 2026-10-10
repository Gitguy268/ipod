import styled from "styled-components";

import FastForwardIcon from "@/components/ClickWheel/icons/FastForwardIcon";
import PlayPauseIcon from "@/components/ClickWheel/icons/PlayPauseIcon";
import RewindIcon from "@/components/ClickWheel/icons/RewindIcon";
import FolderButton from "@/components/FolderButton";
import GelBar from "@/components/GelBar";
import { useAudioPlayer, useInterval, useSettings } from "@/hooks";
import { useLibrary } from "@/lib/library";
import * as Utils from "@/utils";
import { Unit } from "@/utils/constants";
import { DeviceThemeName, getTheme } from "@/utils/themes";
import { pluralize } from "@/utils/strings";

type ThemeProps = { $deviceTheme: DeviceThemeName };

/** A slice of the iPod's faceplate: the same metal, screen bezel and wheel plastic. */
const Faceplate = styled.div<ThemeProps>`
  display: flex;
  align-items: center;
  gap: ${Unit.SM};
  width: min(420px, calc(100vw - 2 * ${Unit.MD}));
  margin: auto;
  padding: ${Unit.SM};
  border-radius: 20px;
  box-shadow: inset 0 0 1.2em #555;
  background: ${({ $deviceTheme }) => getTheme($deviceTheme).body.background};

  @media (prefers-color-scheme: dark) {
    box-shadow: inset 0 0 1.2em black;
  }
`;

const Display = styled.div`
  flex: 1;
  display: flex;
  min-width: 0;
  height: 72px;
  border: 3px solid black;
  border-radius: 6px;
  background: white;
  overflow: hidden;
`;

const Artwork = styled.img`
  flex: none;
  height: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-right: 1px solid #d3d3d3;
`;

const Info = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  min-width: 0;
  padding: 0 ${Unit.XS};
`;

const Title = styled.div`
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Subtitle = styled(Title)`
  font-size: 12px;
  color: rgb(99, 101, 103);
`;

const Progress = styled(GelBar)`
  margin-top: 5px;
`;

const Message = styled.div`
  flex: 1;
  display: grid;
  place-items: center;
  padding: 0 ${Unit.XS};
  color: black;
`;

const Wheel = styled.div<ThemeProps>`
  flex: none;
  display: flex;
  align-items: center;
  height: 46px;
  border-radius: 23px;
  background-color: ${({ $deviceTheme }) =>
    getTheme($deviceTheme).clickwheel.background};
  border: 1px solid
    ${({ $deviceTheme }) => getTheme($deviceTheme).clickwheel.outline};
`;

const WheelButton = styled.button`
  display: grid;
  place-items: center;
  height: 100%;
  padding: 0 9px;
  border: none;
  border-radius: 23px;
  background: transparent;
  cursor: pointer;

  &:first-child {
    padding-left: 14px;
  }

  &:last-child {
    padding-right: 14px;
  }

  &:active {
    opacity: 0.6;
  }

  &:focus-visible {
    outline: 2px solid #3c94de;
    outline-offset: -3px;
  }
`;

/** Compact mode: what's playing and the three buttons you need, and nothing else. */
const MiniPlayer = () => {
  const { deviceTheme } = useSettings();
  const { status, index } = useLibrary();
  const {
    nowPlayingItem,
    playbackInfo,
    play,
    togglePlayPause,
    skipNext,
    skipPrevious,
    updatePlaybackInfo,
  } = useAudioPlayer();

  useInterval(updatePlaybackInfo, 500, !playbackInfo.isPlaying);

  const iconColor = getTheme(deviceTheme).clickwheel.button;
  const songCount = index.songs.length;
  const canPlay = status === "ready" && songCount > 0;

  const handlePlayPause = () => {
    if (nowPlayingItem) {
      togglePlayPause();
    } else if (canPlay) {
      // Nothing is queued yet, so start on the whole library.
      play({ songs: index.songs });
    }
  };

  return (
    <Faceplate $deviceTheme={deviceTheme}>
      <Display>
        {nowPlayingItem ? (
          <>
            <Artwork
              src={Utils.getArtwork(300, nowPlayingItem.artwork?.url)}
              alt=""
            />
            <Info>
              <Title>{nowPlayingItem.name}</Title>
              <Subtitle>{nowPlayingItem.artistName}</Subtitle>
              <Progress
                percent={playbackInfo.percent}
                height={7}
                label="Track progress"
              />
            </Info>
          </>
        ) : canPlay ? (
          <Info>
            <Title>
              {songCount.toLocaleString()}{" "}
              {pluralize("song", "songs", songCount)}
            </Title>
            <Subtitle>Press play to start</Subtitle>
          </Info>
        ) : status === "ready" ? (
          <Info>
            <Title>No music found</Title>
            <Subtitle>Pick a different folder in Settings</Subtitle>
          </Info>
        ) : (
          <Message>
            <FolderButton />
          </Message>
        )}
      </Display>
      <Wheel $deviceTheme={deviceTheme}>
        <WheelButton
          aria-label="Previous"
          disabled={!nowPlayingItem}
          onClick={skipPrevious}
        >
          <RewindIcon color={iconColor} />
        </WheelButton>
        <WheelButton
          aria-label={playbackInfo.isPlaying ? "Pause" : "Play"}
          disabled={!canPlay}
          onClick={handlePlayPause}
        >
          <PlayPauseIcon color={iconColor} />
        </WheelButton>
        <WheelButton
          aria-label="Next"
          disabled={!nowPlayingItem}
          onClick={skipNext}
        >
          <FastForwardIcon color={iconColor} />
        </WheelButton>
      </Wheel>
    </Faceplate>
  );
};

export default MiniPlayer;
