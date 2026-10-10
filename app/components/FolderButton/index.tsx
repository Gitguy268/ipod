import styled from "styled-components";

import { useLibrary } from "@/lib/library";

const Button = styled.button`
  padding: 5px 14px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: white;
  text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.35);
  white-space: nowrap;
  border: 1px solid #1c5aa8;
  border-radius: 999px;
  background: linear-gradient(180deg, #6db3f2 0%, #3c94de 50%, #1e7fd6 51%, #2dbbf5 100%);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  cursor: pointer;

  &:active {
    filter: brightness(0.9);
  }

  &:focus-visible {
    outline: 2px solid #2dd7ff;
    outline-offset: 2px;
  }
`;

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
  const { status, progress, folderName, chooseFolder, reconnect } =
    useLibrary();

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
        <Button className={className} onClick={reconnect}>
          {folderName ? `Reconnect “${folderName}”` : "Reconnect folder"}
        </Button>
      );
    case "ready":
      return showWhenReady ? (
        <Button className={className} onClick={chooseFolder}>
          Choose another folder
        </Button>
      ) : null;
    default:
      return (
        <Button className={className} onClick={chooseFolder}>
          Choose music folder
        </Button>
      );
  }
};

export default FolderButton;
