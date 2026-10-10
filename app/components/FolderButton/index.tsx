import styled from "styled-components";

import GelButton from "@/components/GelButton";
import { useLibrary } from "@/lib/library";

const Status = styled.span`
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  opacity: 0.75;
`;

interface Props {
  /** Also offer to switch folders once a library is loaded. */
  showWhenReady?: boolean;
  className?: string;
}

/** The one place a click opens the system folder picker. */
const FolderButton = ({ showWhenReady, className }: Props) => {
  const {
    status,
    progress,
    artworkProgress,
    folderName,
    chooseFolder,
    reconnect,
  } = useLibrary();

  switch (status) {
    case "scanning":
      return (
        <Status className={className} role="status">
          {progress.total
            ? `Loading ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()}`
            : "Loading library…"}
        </Status>
      );
    case "needsPermission":
      return (
        <GelButton className={className} onClick={reconnect}>
          {folderName ? `Reconnect “${folderName}”` : "Reconnect folder"}
        </GelButton>
      );
    case "ready":
      if (showWhenReady) {
        return (
          <GelButton className={className} onClick={chooseFolder}>
            Choose another folder
          </GelButton>
        );
      }

      return artworkProgress.done < artworkProgress.total ? (
        <Status className={className} role="status">
          Loading artwork {artworkProgress.done.toLocaleString()} of{" "}
          {artworkProgress.total.toLocaleString()}
        </Status>
      ) : null;
    default:
      return (
        <GelButton className={className} onClick={chooseFolder}>
          Choose music folder
        </GelButton>
      );
  }
};

export default FolderButton;
