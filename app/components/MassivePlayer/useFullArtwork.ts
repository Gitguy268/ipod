import { useEffect, useState } from "react";

import { useLibrary } from "@/lib/library";
import * as Utils from "@/utils";

/**
 * An album's artwork at its original resolution. The small thumbnail is returned
 * straight away and swapped for the original once that has been read from disk.
 */
const useFullArtwork = (album?: MediaApi.Album) => {
  const { getFullArtwork } = useLibrary();
  const [original, setOriginal] = useState<{ albumId: string; url: string }>();
  const albumId = album?.id;

  useEffect(() => {
    if (!albumId) {
      return;
    }

    let isCurrent = true;

    getFullArtwork(albumId).then((url) => {
      if (isCurrent && url) {
        setOriginal({ albumId, url });
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [albumId, getFullArtwork]);

  return original && original.albumId === albumId
    ? original.url
    : Utils.getArtwork(600, album?.artwork?.url);
};

export default useFullArtwork;
