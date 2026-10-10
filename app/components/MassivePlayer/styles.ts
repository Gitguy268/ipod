import styled from "styled-components";

import { Unit } from "@/utils/constants";

export const SUBDUED = "#9a9da1";
/** The blue the iPod uses for a selected row. */
export const SELECTION = "linear-gradient(rgb(60, 184, 255) 0%, rgb(52, 122, 181) 100%)";
export const FOCUS_RING = "2px solid #2dd7ff";

/** The black Cover Flow stage, filling the window. */
export const Stage = styled.div`
  position: fixed;
  inset: 0;
  overflow: auto;
  color: white;
  background: black;
`;

export const TextButton = styled.button`
  padding: 0;
  font: inherit;
  font-size: 14px;
  color: ${SUBDUED};
  text-align: left;
  border: none;
  background: none;
  cursor: pointer;

  &:hover {
    color: white;
  }

  &:focus-visible {
    outline: ${FOCUS_RING};
    outline-offset: 4px;
  }
`;

export const BackButton = styled(TextButton)`
  position: absolute;
  top: calc(${Unit.SM} + env(safe-area-inset-top) + 3px);
  left: ${Unit.MD};
`;

/** Cover on one side, details on the other. Stacks on narrow windows. */
export const SplitLayout = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 34rem);
  align-items: center;
  justify-content: center;
  gap: clamp(${Unit.XL}, 6vw, 6rem);
  min-height: 100%;
  padding: ${Unit.XXL} clamp(${Unit.LG}, 5vw, ${Unit.XXL});

  @media (max-width: 800px) {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    align-content: start;
    gap: ${Unit.XL};
  }
`;

export const Cover = styled.img<{ $size?: "large" | "medium" }>`
  display: block;
  width: ${({ $size }) =>
    $size === "medium" ? "min(48vh, 34vw)" : "min(62vh, 44vw)"};
  aspect-ratio: 1;
  object-fit: cover;
  border: 1px solid #2a2a2a;
  /* The floor reflection from Cover Flow. Browsers without it show a plain cover. */
  -webkit-box-reflect: below 2px
    linear-gradient(transparent 68%, rgba(255, 255, 255, 0.22));

  @media (max-width: 800px) {
    width: min(46vh, 78vw);
    -webkit-box-reflect: unset;
  }
`;

export const Details = styled.div`
  min-width: 0;
  width: 100%;
`;

export const Heading = styled.h1`
  margin: 0;
  font-size: clamp(1.75rem, 3.6vw, 3.5rem);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
`;

export const Byline = styled.p`
  margin: ${Unit.XS} 0 0;
  font-size: clamp(1rem, 1.6vw, 1.5rem);
  font-weight: 500;
  color: ${SUBDUED};
  overflow-wrap: anywhere;
`;

/** A row in a list of songs: something small on the left, the title, something small on the right. */
export const SongRow = styled.button<{ $isCurrent?: boolean }>`
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  align-items: baseline;
  gap: ${Unit.XS};
  width: 100%;
  padding: 7px ${Unit.XS};
  font: inherit;
  font-size: 14px;
  color: ${({ $isCurrent }) => ($isCurrent ? "#2dbbf5" : "inherit")};
  text-align: left;
  border: none;
  border-bottom: 1px solid #1c1c1c;
  background: none;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: white;
    background: ${SELECTION};
    outline: none;
  }

  &:hover span,
  &:focus-visible span {
    color: white;
  }
`;

export const SongRowTitle = styled.span`
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const SongRowMeta = styled.span`
  font-variant-numeric: tabular-nums;
  color: ${SUBDUED};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const Notice = styled.div`
  display: grid;
  place-content: center;
  justify-items: center;
  gap: ${Unit.SM};
  min-height: 100%;
  padding: ${Unit.XL};
  text-align: center;

  h1 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  p {
    margin: 0 0 ${Unit.XS};
    max-width: 26rem;
    line-height: 1.45;
    color: ${SUBDUED};
  }
`;
