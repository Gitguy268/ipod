import { useCallback, useMemo } from "react";

import { defineView } from "@/components/views/defineView";
import { getConditionalOption } from "@/components/SelectableList";
import { SelectableListOption } from "@/components/SelectableList";
import SelectableListView from "@/components/SelectableListView";
import { SplitScreenPreview } from "@/components/previews";
import {
  useAudioPlayer,
  useEventListener,
  useFolderOptions,
  useViewContext,
} from "@/hooks";
import { IpodEvent } from "@/utils/events";

const strings = {
  nowPlaying: "Now Playing",
};

const HomeViewComponent = () => {
  const { nowPlayingItem } = useAudioPlayer();
  const { showView, viewStack } = useViewContext();
  const chooseFolderOptions = useFolderOptions();

  const options: SelectableListOption[] = useMemo(
    () => [
      {
        type: "view",
        label: "Cover Flow",
        viewId: "coverFlow",
        preview: SplitScreenPreview.Music,
      },
      {
        type: "view",
        label: "Music",
        viewId: "music",
        preview: SplitScreenPreview.Music,
      },
      {
        type: "view",
        label: "Games",
        viewId: "games",
        preview: SplitScreenPreview.Games,
      },
      {
        type: "view",
        label: "Visualizer",
        viewId: "visualizers",
        preview: SplitScreenPreview.Music,
      },
      {
        type: "view",
        label: "Settings",
        viewId: "settings",
        preview: SplitScreenPreview.Settings,
      },
      ...(chooseFolderOptions ?? []).map(
        (option): SelectableListOption => ({
          ...option,
          preview: SplitScreenPreview.Music,
        })
      ),
      ...getConditionalOption(!!nowPlayingItem, {
        type: "view",
        label: strings.nowPlaying,
        viewId: "nowPlaying",
        preview: SplitScreenPreview.NowPlaying,
      }),
    ],
    [chooseFolderOptions, nowPlayingItem]
  );

  const handleIdleState = useCallback(() => {
    const activeView = viewStack[viewStack.length - 1];

    const shouldShowNowPlaying =
      !!nowPlayingItem &&
      activeView.id !== "nowPlaying" &&
      activeView.id !== "coverFlow" &&
      activeView.id !== "visualizer" &&
      activeView.id !== "keyboard";

    // Only show the now playing view if we're playing a song and not already on that view.
    if (shouldShowNowPlaying) {
      showView("nowPlaying");
    }
  }, [nowPlayingItem, showView, viewStack]);

  useEventListener<IpodEvent>("idle", handleIdleState);

  return <SelectableListView viewId="home" options={options} />;
};

export const HomeView = Object.assign(HomeViewComponent, {
  viewConfig: defineView({
    component: HomeViewComponent,
    type: "split",
    title: "iPod.js",
    isSplitScreen: true,
  }),
});
