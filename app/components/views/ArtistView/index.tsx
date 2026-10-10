import { useMemo } from "react";

import { SelectableListOption } from "@/components/SelectableList";
import SelectableListView from "@/components/SelectableListView";
import { SplitScreenPreview } from "@/components/previews";
import { defineView } from "@/components/views/defineView";
import * as Utils from "@/utils";
import { useFetchArtistAlbums } from "@/hooks/utils/useDataFetcher";

interface Props {
  id: string;
}

const ArtistViewComponent = ({ id }: Props) => {
  const { data: albums, isLoading } = useFetchArtistAlbums({
    id,
  });

  const options: SelectableListOption[] = useMemo(
    () =>
      albums?.map(
        (album): SelectableListOption => ({
          type: "view",
          headerTitle: album.name,
          label: album.name,
          sublabel: album.year ? `${album.year}` : undefined,
          imageUrl: Utils.getArtwork(100, album.artwork?.url),
          viewId: "album",
          props: { id: album.id ?? "" },
          longPressOptions: Utils.getMediaOptions("album", album.id),
        })
      ) ?? [],
    [albums]
  );

  return (
    <SelectableListView
      viewId="artist"
      options={options}
      loading={isLoading}
      emptyMessage="No albums by this artist"
    />
  );
};

export const ArtistView = Object.assign(ArtistViewComponent, {
  viewConfig: defineView({
    component: ArtistViewComponent,
    type: "full",
    title: "Artist",
    preview: SplitScreenPreview.Music,
  }),
});
