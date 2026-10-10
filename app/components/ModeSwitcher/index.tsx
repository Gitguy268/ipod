import styled, { css } from "styled-components";

import FolderButton from "@/components/FolderButton";
import { DisplayMode, useSettings } from "@/hooks";
import { Unit } from "@/utils/constants";

const Container = styled.div<{ $onBlack: boolean }>`
  z-index: 10;
  position: fixed;
  top: calc(${Unit.SM} + env(safe-area-inset-top));
  right: ${Unit.SM};
  display: flex;
  align-items: center;
  gap: ${Unit.SM};
  color: #4a4a4a;

  @media (prefers-color-scheme: dark) {
    color: #d0d0d0;
  }

  ${({ $onBlack }) =>
    $onBlack &&
    css`
      color: #d0d0d0;
    `}
`;

const Segments = styled.div`
  display: flex;
  border: 1px solid currentColor;
  border-radius: 6px;
  overflow: hidden;
  opacity: 0.55;
  transition: opacity 0.15s;

  &:hover,
  &:focus-within {
    opacity: 1;
  }
`;

const Segment = styled.button<{ $isActive: boolean }>`
  padding: 3px 10px;
  font: inherit;
  font-size: 12px;
  color: inherit;
  border: none;
  background: transparent;
  cursor: pointer;

  & + & {
    border-left: 1px solid currentColor;
  }

  ${({ $isActive }) =>
    $isActive &&
    css`
      font-weight: 600;
      background: rgba(128, 128, 128, 0.35);
    `}

  &:focus-visible {
    outline: 2px solid #3c94de;
    outline-offset: -2px;
  }
`;

const MODES: { mode: DisplayMode; label: string }[] = [
  { mode: "compact", label: "Compact" },
  { mode: "full", label: "Full" },
  { mode: "massive", label: "Massive" },
];

/** Switches between the mini player, the iPod, and the window-filling player. */
const ModeSwitcher = () => {
  const { displayMode, setDisplayMode, isAuthorized } = useSettings();

  return (
    <Container $onBlack={displayMode === "massive"}>
      {/* Until a library is loaded, the other two modes show this inside their own layout. */}
      {(displayMode === "full" || isAuthorized) && <FolderButton />}
      <Segments role="group" aria-label="Display mode">
        {MODES.map(({ mode, label }) => (
          <Segment
            key={mode}
            $isActive={displayMode === mode}
            aria-pressed={displayMode === mode}
            onClick={() => setDisplayMode(mode)}
          >
            {label}
          </Segment>
        ))}
      </Segments>
    </Container>
  );
};

export default ModeSwitcher;
