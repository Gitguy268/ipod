import { useCallback, useMemo } from "react";

import { SelectableListOption } from "@/components/SelectableList";
import SelectableListView from "@/components/SelectableListView";
import { SplitScreenPreview } from "@/components/previews";
import { defineView } from "@/components/views/defineView";
import { useFetchSongs } from "@/hooks/utils/useDataFetcher";
import { useLibrary } from "@/lib/library";
import * as Utils from "@/utils";

interface Props {
  /** Show these songs instead of the whole library (used for search results). */
  songs?: MediaApi.Song[];
}

const SongsViewComponent = ({ songs }: Props) => {
  const { index } = useLibrary();

  const {
    data: fetchedSongs,
    fetchNextPage,
    isFetchingNextPage,
    isLoading,
  } = useFetchSongs({
    lazy: !!songs,
  });

  /** Everything that plays on from the chosen song, whether or not its row has loaded yet. */
  const queue = songs ?? index.songs;

  const options: SelectableListOption[] = useMemo(() => {
    const visible =
      songs ?? fetchedSongs?.pages.flatMap((page) => page?.data ?? []) ?? [];

    return visible.map(
      (song, position): SelectableListOption => ({
        type: "song",
        label: song.name,
        sublabel: `${song.artistName} • ${song.albumName}`,
        queueOptions: {
          songs: queue,
          startPosition: position,
        },
        imageUrl: Utils.getArtwork(50, song.artwork?.url),
        showNowPlayingView: true,
        longPressOptions: Utils.getMediaOptions("song", song.id),
      })
    );
  }, [songs, fetchedSongs, queue]);

  const handleNearEndOfList = useCallback(() => {
    if (!songs && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, isFetchingNextPage, songs]);

  return (
    <SelectableListView
      viewId="songs"
      options={options}
      loading={isLoading}
      loadingNextItems={isFetchingNextPage}
      onNearEndOfList={handleNearEndOfList}
      emptyMessage="No songs to show"
    />
  );
};

export const SongsView = Object.assign(SongsViewComponent, {
  viewConfig: defineView({
    component: SongsViewComponent,
    type: "full",
    title: "Songs",
    preview: SplitScreenPreview.Music,
  }),
});
