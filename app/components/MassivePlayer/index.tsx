import { useEffect, useState } from "react";

import FolderButton from "@/components/FolderButton";
import { useAudioPlayer } from "@/hooks";
import { useLibrary } from "@/lib/library";

import AlbumPage from "./AlbumPage";
import AlbumWall from "./AlbumWall";
import NowPlaying from "./NowPlaying";
import { Notice, Stage } from "./styles";

type View =
  | { name: "wall" }
  | { name: "album"; albumId: string }
  | { name: "nowPlaying" };

/**
 * Massive mode: the window as one big Cover Flow stage. A wall of album covers,
 * an album's own page, and the song that is playing with its cover at full size.
 */
const MassivePlayer = () => {
  const { status, index, folderName } = useLibrary();
  const { nowPlayingItem } = useAudioPlayer();
  const [view, setView] = useState<View>(
    nowPlayingItem ? { name: "nowPlaying" } : { name: "wall" }
  );

  const isPlaying = !!nowPlayingItem;

  // Follow playback: show the song when one is put back after a reload,
  // and return to the covers when the queue runs out.
  useEffect(() => {
    setView((current) => {
      if (isPlaying && current.name === "wall") {
        return { name: "nowPlaying" };
      }

      if (!isPlaying && current.name === "nowPlaying") {
        return { name: "wall" };
      }

      return current;
    });
  }, [isPlaying]);

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
                or copied. You can also drag the folder onto this window.
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

  const showWall = () => setView({ name: "wall" });
  const showNowPlaying = () => setView({ name: "nowPlaying" });
  const openAlbum = (album: MediaApi.Album) =>
    setView({ name: "album", albumId: album.id });

  const openedAlbum =
    view.name === "album" ? index.albumsById.get(view.albumId) : undefined;

  const playingAlbumId =
    nowPlayingItem && index.albumIdBySongId.get(nowPlayingItem.id);

  return (
    <Stage>
      {view.name === "nowPlaying" && nowPlayingItem ? (
        <NowPlaying
          album={playingAlbumId ? index.albumsById.get(playingAlbumId) : undefined}
          onBack={showWall}
          onOpenAlbum={openAlbum}
        />
      ) : openedAlbum ? (
        <AlbumPage
          album={openedAlbum}
          onBack={showWall}
          onPlay={showNowPlaying}
        />
      ) : (
        <AlbumWall
          onOpenAlbum={openAlbum}
          onShowNowPlaying={showNowPlaying}
          onPlay={showNowPlaying}
        />
      )}
    </Stage>
  );
};

export default MassivePlayer;
