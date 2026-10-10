import styled from "styled-components";

import { APP_URL } from "@/utils/constants/api";

const Track = styled.div<{ $height: number }>`
  position: relative;
  width: 100%;
  height: ${({ $height }) => $height}px;
  background: url("${APP_URL}/gloss-overlay.svg") repeat-x;
  background-size: auto 100%;
`;

const Fill = styled.div.attrs<{ $percent: number }>(({ $percent }) => ({
  style: { width: `${$percent}%` },
}))<{ $percent: number }>`
  height: 100%;
  background: url("${APP_URL}/gloss-blue.svg") repeat-x;
  background-size: auto 100%;
`;

/** An invisible native slider on top of the bar provides dragging and keyboard control. */
const Slider = styled.input`
  position: absolute;
  inset: -6px 0;
  width: 100%;
  height: calc(100% + 12px);
  margin: 0;
  opacity: 0;
  cursor: pointer;

  &:focus-visible + span {
    outline: 2px solid #2dd7ff;
    outline-offset: 3px;
  }
`;

const FocusRing = styled.span`
  position: absolute;
  inset: 0;
  pointer-events: none;
`;

interface Props {
  /** 0 to 100 */
  percent: number;
  height?: number;
  label: string;
  /** Makes the bar adjustable. Receives the new value from 0 to 100. */
  onChange?: (percent: number) => void;
  className?: string;
}

/** The glossy blue bar the iPod uses for track progress and volume. */
const GelBar = ({ percent, height = 12, label, onChange, className }: Props) => (
  <Track $height={height} className={className}>
    <Fill $percent={Math.min(Math.max(percent || 0, 0), 100)} />
    {onChange && (
      <>
        <Slider
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={percent || 0}
          aria-label={label}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <FocusRing />
      </>
    )}
  </Track>
);

export default GelBar;
