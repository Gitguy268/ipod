"use client";
import { memo, useState } from "react";
import {
  AudioPlayerProvider,
  SettingsContext,
  SettingsProvider,
  useEffectOnce,
} from "@/hooks";
import {
  ClickWheel,
  DropTarget,
  MassivePlayer,
  MiniPlayer,
  ModeSwitcher,
  ViewManager,
} from "@/components";
import {
  ScreenContainer,
  ClickWheelContainer,
  Shell,
  ShellContainer,
  Sticker,
  Sticker2,
  Sticker3,
} from "@/components/Ipod/Styled";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LibraryProvider } from "@/lib/library";
import ViewContextProvider from "@/providers/ViewContextProvider";
import { GlobalStyles } from "@/components/Ipod/GlobalStyles";

const Ipod = () => {
  const [queryClient] = useState(() => new QueryClient());
  const [isLoading, setIsLoading] = useState(true);

  // Everything below reads from the browser, so wait until we're in one.
  useEffectOnce(() => {
    setIsLoading(false);
  });

  if (isLoading) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalStyles />
      <LibraryProvider>
        <SettingsProvider>
          <ViewContextProvider>
            <AudioPlayerProvider>
              <SettingsContext.Consumer>
                {([{ deviceTheme, displayMode }]) => (
                  <>
                    <ModeSwitcher />
                    <DropTarget />
                    {displayMode === "compact" && <MiniPlayer />}
                    {displayMode === "massive" && <MassivePlayer />}
                    {/* The iPod stays mounted in every mode so it keeps its place in the menus. */}
                    <ShellContainer $isHidden={displayMode !== "full"}>
                      <Shell $deviceTheme={deviceTheme}>
                        <Sticker $deviceTheme={deviceTheme} />
                        <Sticker2 $deviceTheme={deviceTheme} />
                        <Sticker3 $deviceTheme={deviceTheme} />
                        <ScreenContainer>
                          <ViewManager />
                        </ScreenContainer>
                        <ClickWheelContainer>
                          <ClickWheel />
                        </ClickWheelContainer>
                      </Shell>
                    </ShellContainer>
                  </>
                )}
              </SettingsContext.Consumer>
            </AudioPlayerProvider>
          </ViewContextProvider>
        </SettingsProvider>
      </LibraryProvider>
    </QueryClientProvider>
  );
};

export default memo(Ipod);
