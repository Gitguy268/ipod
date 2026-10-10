import NowPlaying from "@/components/NowPlaying";
import { SplitScreenPreview } from "@/components/previews";
import { defineView } from "@/components/views/defineView";
import { useMenuHideView, useViewContext } from "@/hooks";

const NowPlayingViewComponent = () => {
  useMenuHideView("nowPlaying");
  const { hideView } = useViewContext();

  return <NowPlaying onHide={hideView} />;
};

export const NowPlayingView = Object.assign(NowPlayingViewComponent, {
  viewConfig: defineView({
    component: NowPlayingViewComponent,
    type: "full",
    title: "Now Playing",
    preview: SplitScreenPreview.Music,
  }),
});
