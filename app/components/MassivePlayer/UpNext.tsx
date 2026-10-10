import styled from "styled-components";

import { useQueue } from "@/hooks";
import { Unit } from "@/utils/constants";

import { SongRow, SongRowMeta, SongRowTitle, SUBDUED } from "./styles";

/** How many upcoming songs to list. */
const VISIBLE_COUNT = 5;

const Container = styled.div`
  margin-top: ${Unit.XL};
`;

const Label = styled.h2`
  margin: 0 0 ${Unit.XXS};
  padding: 0 ${Unit.XS};
  font-size: 13px;
  font-weight: 500;
  color: ${SUBDUED};
`;

const Row = styled(SongRow)`
  grid-template-columns: minmax(0, 1fr) minmax(0, auto);
  gap: ${Unit.MD};
`;

/** The next few songs in the queue. Clicking one jumps to it. */
const UpNext = () => {
  const { songs, position, skipTo } = useQueue();
  const upcoming = songs.slice(position + 1, position + 1 + VISIBLE_COUNT);

  if (!upcoming.length) {
    return null;
  }

  return (
    <Container>
      <Label>Up next</Label>
      {upcoming.map((song, offset) => (
        <Row
          key={`${song.id}-${offset}`}
          onClick={() => skipTo(position + 1 + offset)}
        >
          <SongRowTitle>{song.name}</SongRowTitle>
          <SongRowMeta>{song.artistName}</SongRowMeta>
        </Row>
      ))}
    </Container>
  );
};

export default UpNext;
