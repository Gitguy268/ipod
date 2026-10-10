import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ColorScheme } from "@/utils/colorScheme";
import { useLibrary } from "@/lib/library";
import { DeviceThemeName } from "@/utils/themes";

export type DisplayMode = "compact" | "full" | "massive";
export type ShuffleMode = "off" | "songs" | "albums";
export type RepeatMode = "off" | "one" | "all";

export const VOLUME_KEY = "ipodVolume";
export const COLOR_SCHEME_KEY = "ipodColorScheme";
export const DEVICE_COLOR_KEY = "ipodSelectedDeviceTheme";
export const SHUFFLE_MODE_KEY = "ipodShuffleMode";
export const REPEAT_MODE_KEY = "ipodRepeatMode";
export const HAPTICS_ENABLED_KEY = "ipodHapticsEnabled";
export const DISPLAY_MODE_KEY = "ipodDisplayMode";

export interface SettingsState {
  colorScheme: ColorScheme;
  deviceTheme: DeviceThemeName;
  shuffleMode: ShuffleMode;
  repeatMode: RepeatMode;
  hapticsEnabled: boolean;
  displayMode: DisplayMode;
}

type SettingsContextType = [
  SettingsState,
  React.Dispatch<React.SetStateAction<SettingsState>>,
];

export const SettingsContext = createContext<SettingsContextType>([
  {} as any,
  () => {},
]);

export type SettingsHook = SettingsState & {
  /** True once a music folder has been loaded. */
  isAuthorized: boolean;
  /** Local files never need a connection. Kept so views can share one gate. */
  isOffline: boolean;
  setColorScheme: (colorScheme?: ColorScheme) => void;
  setDeviceTheme: (deviceTheme: DeviceThemeName) => void;
  setShuffleMode: (mode: ShuffleMode) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setDisplayMode: (mode: DisplayMode) => void;
};

export const useSettings = (): SettingsHook => {
  const [state, setState] = useContext(SettingsContext);
  const { status } = useLibrary();

  const setDeviceTheme = useCallback(
    (deviceTheme: DeviceThemeName) => {
      setState((prevState) => ({ ...prevState, deviceTheme }));
      localStorage.setItem(DEVICE_COLOR_KEY, deviceTheme);
    },
    [setState]
  );

  const setColorScheme = useCallback(
    (colorScheme?: ColorScheme) => {
      setState((prevState) => {
        const updatedColorScheme =
          (colorScheme ?? prevState.colorScheme === "dark")
            ? "default"
            : "dark";

        localStorage.setItem(COLOR_SCHEME_KEY, `${updatedColorScheme}`);

        return {
          ...prevState,
          colorScheme: updatedColorScheme,
        };
      });
    },
    [setState]
  );

  const setShuffleMode = useCallback(
    (mode: ShuffleMode) => {
      setState((prevState) => ({ ...prevState, shuffleMode: mode }));
      localStorage.setItem(SHUFFLE_MODE_KEY, mode);
    },
    [setState]
  );

  const setRepeatMode = useCallback(
    (mode: RepeatMode) => {
      setState((prevState) => ({ ...prevState, repeatMode: mode }));
      localStorage.setItem(REPEAT_MODE_KEY, mode);
    },
    [setState]
  );

  const setHapticsEnabled = useCallback(
    (enabled: boolean) => {
      setState((prevState) => ({ ...prevState, hapticsEnabled: enabled }));
      localStorage.setItem(HAPTICS_ENABLED_KEY, enabled ? "true" : "false");
    },
    [setState]
  );

  const setDisplayMode = useCallback(
    (displayMode: DisplayMode) => {
      setState((prevState) => ({ ...prevState, displayMode }));
      localStorage.setItem(DISPLAY_MODE_KEY, displayMode);
    },
    [setState]
  );

  return {
    ...state,
    isAuthorized: status === "ready",
    isOffline: false,
    setColorScheme,
    setDeviceTheme,
    setShuffleMode,
    setRepeatMode,
    setHapticsEnabled,
    setDisplayMode,
  };
};

interface Props {
  children: React.ReactNode;
}

export const SettingsProvider = ({ children }: Props) => {
  const [settingsState, setSettingsState] = useState<SettingsState>({
    colorScheme: "default",
    deviceTheme: "silver",
    shuffleMode: "off",
    repeatMode: "off",
    hapticsEnabled: true,
    displayMode: "full",
  });

  const handleMount = useCallback(() => {
    setSettingsState((prevState) => ({
      ...prevState,
      colorScheme:
        (localStorage.getItem(COLOR_SCHEME_KEY) as ColorScheme) ?? "default",
      deviceTheme:
        (localStorage.getItem(DEVICE_COLOR_KEY) as DeviceThemeName) ?? "silver",
      shuffleMode:
        (localStorage.getItem(SHUFFLE_MODE_KEY) as ShuffleMode) ?? "off",
      repeatMode:
        (localStorage.getItem(REPEAT_MODE_KEY) as RepeatMode) ?? "off",
      hapticsEnabled: localStorage.getItem(HAPTICS_ENABLED_KEY) !== "false", // Default to true
      displayMode:
        (localStorage.getItem(DISPLAY_MODE_KEY) as DisplayMode) ?? "full",
    }));
  }, []);

  useEffect(() => {
    handleMount();
  }, [handleMount]);

  return (
    <SettingsContext.Provider value={[settingsState, setSettingsState]}>
      {children}
    </SettingsContext.Provider>
  );
};

export default useSettings;
