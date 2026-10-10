import { useCallback, useMemo } from "react";

import FolderPrompt from "@/components/FolderPrompt";
import { SelectableListOption } from "@/components/SelectableList";
import SelectableListView from "@/components/SelectableListView";
import { SplitScreenPreview } from "@/components/previews";
import { defineView } from "@/components/views/defineView";
import { useSettings } from "@/hooks";
import * as Utils from "@/utils";
import { useFetchAlbums } from "@/hooks/utils/useDataFetcher";

interface Props {
  albums?: MediaApi.Album[];
}

const AlbumsViewComponent = ({ albums }: Props) => {
  const { isAuthorized } = useSettings();

  const {
    data: fetchedAlbums,
    fetchNextPage,
    isFetchingNextPage,
    isLoading,
  } = useFetchAlbums({
    lazy: !!albums,
  });

  const options: SelectableListOption[] = useMemo(() => {
    const data =
      albums ?? fetchedAlbums?.pages.flatMap((page) => page?.data ?? []);

    return (
      data?.map(
        (album): SelectableListOption => ({
          type: "view",
          headerTitle: album.name,
          label: album.name,
          sublabel: album.artistName,
          imageUrl: Utils.getArtwork(100, album.artwork?.url),
          viewId: "album",
          props: { id: album.id ?? "" },
        })
      ) ?? []
    );
  }, [albums, fetchedAlbums]);

  const handleNearEndOfList = useCallback(() => {
    if (!isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, isFetchingNextPage]);

  return (
    <SelectableListView
      viewId="albums"
      options={!isAuthorized ? [] : options}
      loading={isAuthorized && isLoading}
      loadingNextItems={isFetchingNextPage}
      onNearEndOfList={handleNearEndOfList}
      emptyMessage="No albums"
      emptyContent={
        !isAuthorized ? <FolderPrompt /> : undefined
      }
    />
  );
};

export const AlbumsView = Object.assign(AlbumsViewComponent, {
  viewConfig: defineView({
    component: AlbumsViewComponent,
    type: "full",
    title: "Albums",
    preview: SplitScreenPreview.Music,
  }),
});
