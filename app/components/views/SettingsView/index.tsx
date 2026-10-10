import { useCallback, useMemo } from "react";

import { defineView } from "@/components/views/defineView";
import { getConditionalOption } from "@/components/SelectableList";
import { SelectableListOption } from "@/components/SelectableList";
import SelectableListView from "@/components/SelectableListView";
import { SplitScreenPreview } from "@/components/previews";
import {
  DisplayMode,
  useAudioPlayer,
  useSettings,
  useFolderOptions,
  useViewContext,
} from "@/hooks";
import { supportsDirectoryPicker, useLibrary } from "@/lib/library";

const THEMES = ["silver", "black", "u2"] as const;

const DISPLAY_MODES: { mode: DisplayMode; label: string }[] = [
  { mode: "compact", label: "Compact" },
  { mode: "full", label: "Full" },
  { mode: "massive", label: "Massive" },
];

const formatCurrentLabel = (label: string, isCurrent: boolean) =>
  `${label}${isCurrent ? " (Current)" : ""}`;

const getThemeLabel = (theme: (typeof THEMES)[number]) => {
  if (theme === "u2") return "U2 Edition";
  return theme.charAt(0).toUpperCase() + theme.slice(1);
};

const SettingsViewComponent = () => {
  const {
    isAuthorized,
    deviceTheme,
    setDeviceTheme,
    shuffleMode,
    repeatMode,
    hapticsEnabled,
    setHapticsEnabled,
    displayMode,
    setDisplayMode,
  } = useSettings();
  const { setShuffleMode, setRepeatMode } = useAudioPlayer();
  const { chooseFolder, rescan, forget } = useLibrary();
  const chooseFolderOptions = useFolderOptions();
  const { reset } = useAudioPlayer();
  const { showPopup } = useViewContext();

  const handleForgetFolder = useCallback(async () => {
    reset();
    await forget();
    showPopup({
      title: "Folder Removed",
      description: "Your music files have not been changed.",
    });
  }, [forget, reset, showPopup]);

  const themeOptions: SelectableListOption[] = useMemo(
    () =>
      THEMES.map((theme) => ({
        type: "action",
        isSelected: deviceTheme === theme,
        label: formatCurrentLabel(getThemeLabel(theme), deviceTheme === theme),
        onSelect: () => setDeviceTheme(theme),
      })),
    [deviceTheme, setDeviceTheme]
  );

  const displayModeOptions: SelectableListOption[] = useMemo(
    () =>
      DISPLAY_MODES.map(({ mode, label }) => ({
        type: "action",
        isSelected: displayMode === mode,
        label: formatCurrentLabel(label, displayMode === mode),
        onSelect: () => setDisplayMode(mode),
      })),
    [displayMode, setDisplayMode]
  );

  const folderOptions: SelectableListOption[] = useMemo(
    () => [
      {
        type: "action",
        label: "Choose Folder",
        onSelect: chooseFolder,
      },
      {
        type: "action",
        // Browsers that can't remember a folder have to be shown it again.
        label: supportsDirectoryPicker() ? "Rescan" : "Reload Folder",
        onSelect: rescan,
      },
      {
        type: "action",
        label: "Remove Folder",
        onSelect: handleForgetFolder,
      },
    ],
    [chooseFolder, rescan, handleForgetFolder]
  );

  const options: SelectableListOption[] = useMemo(
    () => [
      {
        type: "view",
        label: "About",
        viewId: "about",
        preview: SplitScreenPreview.Settings,
      },
      {
        type: "actionSheet",
        label: "Display mode",
        listOptions: displayModeOptions,
        preview: SplitScreenPreview.Settings,
      },
      ...getConditionalOption(isAuthorized, {
        type: "actionSheet",
        label: "Music folder",
        listOptions: folderOptions,
        preview: SplitScreenPreview.Music,
      }),
      /** Add shuffle mode options */
      ...getConditionalOption(isAuthorized, {
        type: "actionSheet",
        label: "Shuffle",
        listOptions: [
          {
            type: "action",
            isSelected: shuffleMode === "off",
            label: `Off ${shuffleMode === "off" ? "(Current)" : ""}`,
            onSelect: () => setShuffleMode("off"),
          },
          {
            type: "action",
            isSelected: shuffleMode === "songs",
            label: `Songs ${shuffleMode === "songs" ? "(Current)" : ""}`,
            onSelect: () => setShuffleMode("songs"),
          },
          {
            type: "action",
            isSelected: shuffleMode === "albums",
            label: `Albums ${shuffleMode === "albums" ? "(Current)" : ""}`,
            onSelect: () => setShuffleMode("albums"),
          },
        ],
        preview: SplitScreenPreview.Settings,
      }),
      /** Add repeat mode options */
      ...getConditionalOption(isAuthorized, {
        type: "actionSheet",
        label: "Repeat",
        listOptions: [
          {
            type: "action",
            isSelected: repeatMode === "off",
            label: `Off ${repeatMode === "off" ? "(Current)" : ""}`,
            onSelect: () => setRepeatMode("off"),
          },
          {
            type: "action",
            isSelected: repeatMode === "one",
            label: `One ${repeatMode === "one" ? "(Current)" : ""}`,
            onSelect: () => setRepeatMode("one"),
          },
          {
            type: "action",
            isSelected: repeatMode === "all",
            label: `All ${repeatMode === "all" ? "(Current)" : ""}`,
            onSelect: () => setRepeatMode("all"),
          },
        ],
        preview: SplitScreenPreview.Settings,
      }),
      {
        type: "actionSheet",
        label: "Device theme",
        listOptions: themeOptions,
        preview: SplitScreenPreview.Theme,
      },
      {
        type: "actionSheet",
        label: "Haptic feedback",
        listOptions: [
          {
            type: "action",
            isSelected: hapticsEnabled,
            label: `On ${hapticsEnabled ? "(Current)" : ""}`,
            onSelect: () => setHapticsEnabled(true),
          },
          {
            type: "action",
            isSelected: !hapticsEnabled,
            label: `Off ${!hapticsEnabled ? "(Current)" : ""}`,
            onSelect: () => setHapticsEnabled(false),
          },
        ],
        preview: SplitScreenPreview.Settings,
      },
      ...(chooseFolderOptions ?? []).map(
        (option): SelectableListOption => ({
          ...option,
          preview: SplitScreenPreview.Music,
        })
      ),
    ],
    [
      isAuthorized,
      displayModeOptions,
      folderOptions,
      themeOptions,
      chooseFolderOptions,
      shuffleMode,
      setShuffleMode,
      repeatMode,
      setRepeatMode,
      hapticsEnabled,
      setHapticsEnabled,
    ]
  );

  return <SelectableListView viewId="settings" options={options} />;
};

export const SettingsView = Object.assign(SettingsViewComponent, {
  viewConfig: defineView({
    component: SettingsViewComponent,
    type: "split",
    title: "Settings",
    isSplitScreen: true,
    preview: SplitScreenPreview.Settings,
  }),
});
