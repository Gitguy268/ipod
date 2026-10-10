import { useMemo } from "react";

import { defineView } from "@/components/views/defineView";
import { SelectableListOption } from "@/components/SelectableList";
import SelectableListView from "@/components/SelectableListView";
import { SplitScreenPreview } from "@/components/previews";
import { useAudioPlayer } from "@/hooks";
import { useLibrary } from "@/lib/library";

const MusicViewComponent = () => {
  const { index } = useLibrary();
  const { nowPlayingItem } = useAudioPlayer();

  const options: SelectableListOption[] = useMemo(() => {
    const arr: SelectableListOption[] = [
      {
        type: "view",
        label: "Cover Flow",
        viewId: "coverFlow",
        preview: SplitScreenPreview.Music,
      },
      {
        type: "view",
        label: "Artists",
        viewId: "artists",
        preview: SplitScreenPreview.Music,
      },
      {
        type: "view",
        label: "Albums",
        viewId: "albums",
        preview: SplitScreenPreview.Music,
      },
      {
        type: "view",
        label: "Songs",
        viewId: "songs",
        props: { songs: index.songs },
        preview: SplitScreenPreview.Music,
      },
      {
        type: "view",
        label: "Search",
        viewId: "search",
        preview: SplitScreenPreview.Music,
      },
    ];

    if (nowPlayingItem) {
      arr.push({
        type: "view",
        label: "Now playing",
        viewId: "nowPlaying",
        preview: SplitScreenPreview.NowPlaying,
      });
    }

    return arr;
  }, [index.songs, nowPlayingItem]);

  return <SelectableListView viewId="music" options={options} />;
};

export const MusicView = Object.assign(MusicViewComponent, {
  viewConfig: defineView({
    component: MusicViewComponent,
    type: "split",
    title: "Music",
    isSplitScreen: true,
    preview: SplitScreenPreview.Music,
  }),
});

