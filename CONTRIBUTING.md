# Contributing

Thanks for wanting to help. Bug reports, ideas and pull requests are all welcome.

## Getting set up

You need [Node.js](https://nodejs.org) (the version in `.tool-versions`) and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000/ipod> and choose a music folder.

To work without your own music, generate a test library (needs [ffmpeg](https://ffmpeg.org)) and open the page with `?fixture`:

```bash
node scripts/make-fixtures.mjs                          # a handful of awkward cases
node scripts/make-fixtures.mjs --albums 200 --tracks 10 # plus 2,000 songs for checking speed
```

## Before you open a pull request

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm build
```

All four run on every pull request.

- Keep a pull request to one change, with a description of what it does and why.
- If you change how tracks are grouped into albums, artists or playlists, add a case to `scripts/check-index.mjs`.
- Try the change in a browser. The folder picker is a system dialog that tests can't click, so say in the pull request what you tried.
- Don't add images, fonts or dependencies unless their licence allows it, and credit them in the README.
- Never commit music files, secrets, or anything personal. `public/dev-fixtures` is ignored on purpose.

## Where things are

| Path | What lives there |
|---|---|
| `app/lib/library/` | Reading a folder: file access, tags, artwork, the cache, and the index of songs, albums, artists, genres and playlists |
| `app/hooks/audio/` | Playback: the queue, the two audio elements, resume, media keys |
| `app/components/views/` | The iPod's screens |
| `app/components/MiniPlayer`, `MassivePlayer` | The compact and massive display modes |
| `scripts/` | The index and visualizer checks and the test-library generator |

## Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
