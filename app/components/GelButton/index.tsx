import styled from "styled-components";

/** The glossy blue pill button of the iPod era. */
const GelButton = styled.button`
  padding: 5px 14px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: white;
  text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.35);
  white-space: nowrap;
  border: 1px solid #1c5aa8;
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    #6db3f2 0%,
    #3c94de 50%,
    #1e7fd6 51%,
    #2dbbf5 100%
  );
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

export default GelButton;
