<div align="center">

# iPod.js (local files)

**The iPod Classic, playing the music on your own computer.**

Point it at a music folder and browse it with the click wheel. Nothing is uploaded: files are read straight from disk in the browser.

</div>

---

A fork of [tvillarete/ipod-classic-js](https://github.com/tvillarete/ipod-classic-js) with the Apple Music and Spotify integrations replaced by a local library.

## Quick Start

```bash
pnpm install
pnpm dev
```

Visit **[http://localhost:3000/ipod](http://localhost:3000/ipod)** and choose your music folder.

## Your music

- Every audio file in the chosen folder and its subfolders is added: mp3, m4a, aac, flac, wav, ogg, opus, aiff (whatever the browser can play).
- Artist, album, track and disc numbers come from the file tags. Files without tags fall back to `Artist/Album/01 Title.mp3` folder naming.
- Album artwork is read from the files. If a file has none, an image named `cover`, `folder`, `front` or `album` (jpg, png, webp) in the same folder is used.
- Tags and artwork thumbnails are cached in the browser, so only new or changed files are read on later visits.

### Browser support

| Browser | Folder access |
|---|---|
| Chrome, Edge | The folder is remembered. On a later visit, one click re-allows it. |
| Safari, Firefox, Brave | The folder has to be chosen again on each visit. The browser words this as an "upload", but nothing leaves the computer. |

Brave switches this browser feature off by default. It can be turned on under `brave://flags` (search for "File System Access API").

The page has to be served from `https://` or `localhost`. It does not work opened as a file.

## Display modes

Switch with the control in the top-right corner, or under Settings.

- **Compact**: a mini player with artwork, title and previous / play / next.
- **Full**: the iPod.
- **Massive**: fills the window with the album cover, or a wall of covers to pick from.

In Compact and Massive, Space plays and pauses and the left and right arrow keys change song.

## Building

```bash
pnpm build
```

This writes a static site to `out/`. Host it on any static host under the `/ipod` path.

## Development

```bash
pnpm type-check
node scripts/check-index.mjs    # how tracks are grouped into albums and artists
node scripts/make-fixtures.mjs  # needs ffmpeg; writes a small test library to public/dev-fixtures
```

With the test library generated, open `http://localhost:3000/ipod?fixture` to load it without the folder picker.

## Built With

Next.js, React, TypeScript, Styled Components, Motion.

## License

MIT

---

<div align="center">

Original iPod.js by **[Tanner Villarete](https://tannerv.com)**

[![GitHub stars](https://img.shields.io/github/stars/tvillarete/ipod-classic-js?style=social)](https://github.com/tvillarete/ipod-classic-js/stargazers)

</div>
