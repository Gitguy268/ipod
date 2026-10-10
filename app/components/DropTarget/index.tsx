import { useCallback, useEffect, useRef, useState } from "react";

import styled from "styled-components";

import { useAudioPlayer, useEventListener } from "@/hooks";
import { readDrop, useLibrary } from "@/lib/library";
import { Unit } from "@/utils/constants";

const Overlay = styled.div`
  z-index: 20;
  position: fixed;
  inset: 0;
  display: grid;
  place-content: center;
  gap: ${Unit.XS};
  padding: ${Unit.XL};
  text-align: center;
  color: white;
  background: rgba(0, 0, 0, 0.82);
  /* Lets the drop land on the window rather than on this layer. */
  pointer-events: none;
`;

const Title = styled.p`
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.01em;
`;

const Text = styled.p`
  margin: 0;
  color: #9a9da1;
`;

const isFileDrag = (event: DragEvent) =>
  !!event.dataTransfer?.types.includes("Files");

/** Lets a music folder be dragged from the desktop onto the page. */
const DropTarget = () => {
  const { openDropped } = useLibrary();
  const { reset } = useAudioPlayer();
  const [isDragging, setIsDragging] = useState(false);
  const [notice, setNotice] = useState<string>();
  /** Drag events fire for every element the pointer crosses, so count them in and out. */
  const depthRef = useRef(0);

  const handleDragEnter = useCallback((event: DragEvent) => {
    if (isFileDrag(event)) {
      depthRef.current++;
      setNotice(undefined);
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    if (isFileDrag(event) && --depthRef.current <= 0) {
      depthRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((event: DragEvent) => {
    // Without this the browser opens the dropped file instead.
    if (isFileDrag(event)) {
      event.preventDefault();
    }
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      if (!isFileDrag(event) || !event.dataTransfer) {
        return;
      }

      event.preventDefault();
      depthRef.current = 0;
      setIsDragging(false);

      const folder = readDrop(event.dataTransfer.items);

      if (folder) {
        reset();
        openDropped(folder);
      } else {
        setNotice("Drop a folder, not individual files");
      }
    },
    [openDropped, reset]
  );

  useEventListener("dragenter", handleDragEnter);
  useEventListener("dragleave", handleDragLeave);
  useEventListener("dragover", handleDragOver);
  useEventListener("drop", handleDrop);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = setTimeout(() => setNotice(undefined), 3000);

    return () => clearTimeout(timeoutId);
  }, [notice]);

  if (!isDragging && !notice) {
    return null;
  }

  return (
    <Overlay role="status">
      <Title>{notice ?? "Drop your music folder"}</Title>
      {!notice && <Text>It replaces the library that is loaded now.</Text>}
    </Overlay>
  );
};

export default DropTarget;
