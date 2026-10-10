import styled from "styled-components";

import { useLibrary } from "@/lib/library";
import { Unit } from "@/utils/constants";

const RootContainer = styled.div`
  display: grid;
  place-content: center;
  justify-items: center;
  text-align: center;
  height: 100%;
  padding: ${Unit.XS};
  background: white;
`;

const FolderIcon = styled.svg`
  height: 48px;
  width: 48px;
`;

const Title = styled.h3`
  margin: ${Unit.XS} 0 ${Unit.XXS};
  font-weight: bold;
  font-size: 16px;
`;

const Text = styled.p`
  font-size: 13px;
  margin: 0;
  max-width: 150px;
  color: rgb(100, 100, 100);
`;

const strings = {
  empty: {
    title: "No Music",
    message: "Select Choose Folder in the main menu",
  },
  needsPermission: {
    title: "Reconnect",
    message: "Select Reconnect Folder in the main menu",
  },
  scanningTitle: "Loading Library",
  scanningMessage: "Looking for music…",
};

interface Props {
  message?: string;
}

/** Shown wherever music would be, until a music folder has been loaded. */
const AuthPrompt = ({ message }: Props) => {
  const { status, progress, error } = useLibrary();

  const isScanning = status === "scanning";
  const content =
    status === "needsPermission" ? strings.needsPermission : strings.empty;

  return (
    <RootContainer>
      <FolderIcon viewBox="0 0 48 48" aria-hidden>
        <path
          d="M4 12a4 4 0 0 1 4-4h10l4 5h18a4 4 0 0 1 4 4v19a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V12z"
          fill="#5b9bf0"
        />
        <path
          d="M4 18h40v18a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V18z"
          fill="#8cbcf8"
        />
      </FolderIcon>
      {isScanning ? (
        <>
          <Title>{strings.scanningTitle}</Title>
          <Text>
            {progress.total
              ? `${progress.done.toLocaleString()} of ${progress.total.toLocaleString()}`
              : strings.scanningMessage}
          </Text>
        </>
      ) : (
        <>
          <Title>{content.title}</Title>
          <Text>{error ?? message ?? content.message}</Text>
        </>
      )}
    </RootContainer>
  );
};

export default AuthPrompt;
