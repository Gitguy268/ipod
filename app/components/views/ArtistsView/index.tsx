import { useCallback, useMemo } from "react";

import FolderPrompt from "@/components/FolderPrompt";
import { SelectableListOption } from "@/components/SelectableList";
import SelectableListView from "@/components/SelectableListView";
import { SplitScreenPreview } from "@/components/previews";
import { defineView } from "@/components/views/defineView";
import { useSettings } from "@/hooks";
import * as Utils from "@/utils";
import { useFetchArtists } from "@/hooks/utils/useDataFetcher";

interface Props {
  artists?: MediaApi.Artist[];
  showImages?: boolean;
}

const ArtistsViewComponent = ({
  artists,
  showImages = false,
}: Props) => {
  const { isAuthorized } = useSettings();
  const {
    data: fetchedArtists,
    fetchNextPage,
    isFetchingNextPage,
    isLoading: isQueryLoading,
  } = useFetchArtists({
    lazy: !!artists,
  });

  const options: SelectableListOption[] = useMemo(() => {
    const data =
      artists ?? fetchedArtists?.pages.flatMap((page) => page?.data ?? []);

    return (
      data?.map(
        (artist): SelectableListOption => ({
          type: "view",
          headerTitle: artist.name,
          label: artist.name,
          viewId: "artist",
          imageUrl: showImages
            ? (Utils.getArtwork(50, artist.artwork?.url) ?? "artists_icon.svg")
            : "",
          props: { id: artist.id },
        })
      ) ?? []
    );
  }, [artists, fetchedArtists, showImages]);

  const isLoading = !options.length && isQueryLoading;

  const handleNearEndOfList = useCallback(() => {
    if (!isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, isFetchingNextPage]);

  return (
    <SelectableListView
      viewId="artists"
      options={!isAuthorized ? [] : options}
      loading={isAuthorized && isLoading}
      loadingNextItems={isFetchingNextPage}
      onNearEndOfList={handleNearEndOfList}
      emptyMessage="No artists"
      emptyContent={
        !isAuthorized
          ? <FolderPrompt />
          : undefined
      }
    />
  );
};

export const ArtistsView = Object.assign(ArtistsViewComponent, {
  viewConfig: defineView({
    component: ArtistsViewComponent,
    type: "full",
    title: "Artists",
    preview: SplitScreenPreview.Music,
  }),
});
