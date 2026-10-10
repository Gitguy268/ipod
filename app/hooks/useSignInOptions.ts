import { useMemo } from "react";

import { SelectableListOption } from "@/components/SelectableList";
import { useLibrary } from "@/lib/library";

/** Returns the options for loading a music folder, or null once a library is loaded. */
const useSignInOptions = (): SelectableListOption[] | null => {
  const { status, chooseFolder, reconnect } = useLibrary();

  return useMemo(() => {
    switch (status) {
      case "empty":
        return [
          {
            type: "action",
            label: "Choose Folder",
            onSelect: chooseFolder,
          },
        ];
      case "needsPermission":
        return [
          {
            type: "action",
            label: "Reconnect Folder",
            onSelect: reconnect,
          },
          {
            type: "action",
            label: "Choose Folder",
            onSelect: chooseFolder,
          },
        ];
      default:
        return null;
    }
  }, [status, chooseFolder, reconnect]);
};

export default useSignInOptions;
