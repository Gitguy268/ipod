import { useMemo } from "react";

import { SelectableListOption } from "@/components/SelectableList";
import SelectableListView from "@/components/SelectableListView";
import { SplitScreenPreview } from "@/components/previews";
import { defineView } from "@/components/views/defineView";
import * as Utils from "@/utils";
import { useFetchAlbum } from "@/hooks/utils/useDataFetcher";

interface Props {
  id: string;
  /** Unused: everything comes from the local music folder. */
  inLibrary?: boolean;
}

const _AlbumView = ({ id, inLibrary = false }: Props) => {
  const { data: album, isLoading } = useFetchAlbum({
    id,
    inLibrary,
  });

  const options: SelectableListOption[] = useMemo(
    () =>
      album?.songs.map((song, index) => ({
        type: "song",
        label: song.name,
        queueOptions: {
          album,
          startPosition: index,
        },
        showNowPlayingView: true,
        longPressOptions: Utils.getMediaOptions("song", song.id),
      })) ?? [],
    [album]
  );

  return (
    <SelectableListView
      viewId="album"
      options={options}
      loading={isLoading}
      emptyMessage="No songs"
    />
  );
};

export const AlbumView = Object.assign(_AlbumView, {
  viewConfig: defineView({
    component: _AlbumView,
    type: "full",
    title: "Album",
    preview: SplitScreenPreview.Music,
  }),
});
