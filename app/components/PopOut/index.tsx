import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { createGlobalStyle, StyleSheetManager } from "styled-components";

import MiniPlayer from "@/components/MiniPlayer";

/** The browser feature for small always-on-top windows. Not in TypeScript's DOM types yet. */
type PictureInPictureWindow = Window & {
  documentPictureInPicture?: {
    requestWindow: (size: { width: number; height: number }) => Promise<Window>;
  };
};

/** The window's own title bar comes out of this height, leaving room for the player below it. */
const SIZE = { width: 460, height: 160 };

interface PopOutState {
  isOpen: boolean;
  /** Opens the mini player in its own small window. Must be called from a click. */
  open: () => Promise<void>;
  close: () => void;
}

const PopOutContext = createContext<PopOutState>({} as PopOutState);

export const usePopOut = () => useContext(PopOutContext);

const PopOutStyles = createGlobalStyle`
  html,
  body {
    height: 100%;
  }

  body {
    display: grid;
    margin: 0;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
      Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
    color: black;
    background: black;
  }

  * {
    box-sizing: border-box;
  }
`;

interface Props {
  children: React.ReactNode;
}

/**
 * Shows the mini player in a separate small window that stays above other apps
 * (or, in browsers without that feature, an ordinary pop-up window).
 */
export const PopOutProvider = ({ children }: Props) => {
  const [popOutWindow, setPopOutWindow] = useState<Window>();

  const open = useCallback(async () => {
    const { documentPictureInPicture } = window as PictureInPictureWindow;

    const opened = documentPictureInPicture
      ? await documentPictureInPicture.requestWindow(SIZE)
      : window.open(
          "",
          "ipodMiniPlayer",
          `popup,width=${SIZE.width},height=${SIZE.height}`
        );

    if (!opened) {
      return;
    }

    opened.document.title = "iPod.js";
    opened.addEventListener("pagehide", () => setPopOutWindow(undefined), {
      once: true,
    });
    setPopOutWindow(opened);
  }, []);

  const close = useCallback(() => {
    popOutWindow?.close();
    setPopOutWindow(undefined);
  }, [popOutWindow]);

  // Don't leave the window behind when this page goes away.
  useEffect(() => () => popOutWindow?.close(), [popOutWindow]);

  const value = useMemo(
    () => ({ isOpen: !!popOutWindow, open, close }),
    [popOutWindow, open, close]
  );

  return (
    <PopOutContext.Provider value={value}>
      {children}
      {popOutWindow &&
        createPortal(
          // Styles have to be written into the new window; by default they
          // would only reach the main page.
          <StyleSheetManager target={popOutWindow.document.head}>
            <PopOutStyles />
            <MiniPlayer />
          </StyleSheetManager>,
          popOutWindow.document.body
        )}
    </PopOutContext.Provider>
  );
};
