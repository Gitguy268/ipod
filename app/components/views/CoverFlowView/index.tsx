import { useCallback } from "react";

import FolderPrompt from "@/components/FolderPrompt";
import LoadingScreen from "@/components/LoadingScreen";
import { SplitScreenPreview } from "@/components/previews";
import { defineView } from "@/components/views/defineView";
import { useEventListener, useSettings, useViewContext } from "@/hooks";
import styled from "styled-components";

import CoverFlow from "./CoverFlow";
import { IpodEvent } from "@/utils/events";
import { useFetchAlbums } from "@/hooks/utils/useDataFetcher";

const Container = styled.div`
  height: 100%;
  flex: 1;
`;

const CoverFlowViewComponent = () => {
  const { hideView } = useViewContext();
  const { isAuthorized } = useSettings();
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useFetchAlbums({});

  const albums = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  const handleMenuClick = useCallback(() => {
    if (!isAuthorized || isLoading) {
      hideView();
    }
  }, [hideView, isAuthorized, isLoading]);

  const handleNearEnd = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEventListener<IpodEvent>("menuclick", handleMenuClick);

  return (
    <Container>
      {!isAuthorized ? (
        <FolderPrompt />
      ) : isLoading ? (
        <LoadingScreen backgroundColor="white" />
      ) : (
        <CoverFlow albums={albums} onNearEnd={handleNearEnd} />
      )}
    </Container>
  );
};

export const CoverFlowView = Object.assign(CoverFlowViewComponent, {
  viewConfig: defineView({
    component: CoverFlowViewComponent,
    type: "coverFlow",
    title: "Cover Flow",
    preview: SplitScreenPreview.Music,
  }),
});
