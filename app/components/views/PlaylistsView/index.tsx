import { useCallback, useMemo } from "react";

import FolderPrompt from "@/components/FolderPrompt";
import { SelectableListOption } from "@/components/SelectableList";
import SelectableListView from "@/components/SelectableListView";
import { SplitScreenPreview } from "@/components/previews";
import { defineView } from "@/components/views/defineView";
import { useSettings } from "@/hooks";
import * as Utils from "@/utils";
import { useFetchPlaylists } from "@/hooks/utils/useDataFetcher";

interface Props {
  playlists?: MediaApi.Playlist[];
}

const PlaylistsViewComponent = ({ playlists }: Props) => {
  const { isAuthorized } = useSettings();
  const {
    data: fetchedPlaylists,
    fetchNextPage,
    isFetchingNextPage,
    isLoading: isQueryLoading,
  } = useFetchPlaylists({
    lazy: !!playlists,
  });

  const options: SelectableListOption[] = useMemo(() => {
    const data =
      playlists ?? fetchedPlaylists?.pages.flatMap((page) => page?.data ?? []);

    return (
      data?.map((playlist) => ({
        type: "view",
        label: playlist.name,
        sublabel: playlist.description || `By ${playlist.curatorName}`,
        imageUrl: Utils.getArtwork(100, playlist.artwork?.url),
        viewId: "playlist",
        headerTitle: playlist.name,
        props: { id: playlist.id },
        longPressOptions: Utils.getMediaOptions("playlist", playlist.id),
      })) ?? []
    );
  }, [fetchedPlaylists?.pages, playlists]);

  const isLoading = !options.length && isQueryLoading;

  const handleNearEndOfList = useCallback(() => {
    if (!isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, isFetchingNextPage]);

  return (
    <SelectableListView
      viewId="playlists"
      options={!isAuthorized ? [] : options}
      loading={isAuthorized && isLoading}
      loadingNextItems={isFetchingNextPage}
      onNearEndOfList={handleNearEndOfList}
      emptyMessage="No saved playlists"
      emptyContent={
        !isAuthorized
          ? <FolderPrompt />
          : undefined
      }
    />
  );
};

export const PlaylistsView = Object.assign(PlaylistsViewComponent, {
  viewConfig: defineView({
    component: PlaylistsViewComponent,
    type: "full",
    title: "Playlists",
    preview: SplitScreenPreview.Music,
  }),
});
