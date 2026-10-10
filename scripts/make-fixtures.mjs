#!/usr/bin/env node
// Generates a small tagged music library in public/dev-fixtures (not committed).
// Open the app with `?fixture` to load it without the system folder picker.
// Requires ffmpeg.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "dev-fixtures");
const FILES = path.join(OUT, "files");
const SECONDS = 8;

const ffmpeg = (...args) =>
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);

const makeCover = (file, [from, to]) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  ffmpeg(
    "-f", "lavfi",
    "-i", `gradients=s=1200x1200:c0=${from}:c1=${to}:x0=0:y0=0:x1=1200:y1=1200`,
    "-frames:v", "1",
    file
  );
};

/** tags: { title, artist, album, album_artist, track, disc }. cover: path to embed. */
const makeTrack = (relativePath, frequency, tags = {}, cover) => {
  const file = path.join(FILES, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const metadata = Object.entries(tags).flatMap(([key, value]) => [
    "-metadata",
    `${key}=${value}`,
  ]);
  const tone = ["-f", "lavfi", "-i", `sine=frequency=${frequency}:duration=${SECONDS}`];

  if (cover) {
    ffmpeg(
      ...tone, "-i", cover,
      "-map", "0:a", "-map", "1:v",
      "-c:v", "mjpeg", "-disposition:v", "attached_pic",
      ...metadata,
      file
    );
  } else {
    ffmpeg(...tone, ...metadata, file);
  }
};

fs.rmSync(OUT, { recursive: true, force: true });
const covers = path.join(OUT, "covers");

// 1. A regular album: mp3 with embedded artwork.
makeCover(path.join(covers, "northern.jpg"), ["0x0b3d91", "0x7fffd4"]);
["First Light", "Green Ribbon", "Magnetic North", "Slow Dawn"].forEach((title, i) =>
  makeTrack(`Aurora Lane/Northern Lights/0${i + 1} ${title}.mp3`, 220 + i * 40, {
    title, artist: "Aurora Lane", album: "Northern Lights", track: `${i + 1}/4`,
  }, path.join(covers, "northern.jpg"))
);

// 2. A two-disc album split across folders, tied together by the album artist tag.
makeCover(path.join(covers, "longway.jpg"), ["0xff7a00", "0x5b0e2d"]);
[[1, 1, "Departure"], [1, 2, "Motorway"], [2, 1, "Return"], [2, 2, "Home"]].forEach(
  ([disc, track, title], i) =>
    makeTrack(`Aurora Lane/Long Way Round/CD${disc}/0${track} ${title}.mp3`, 300 + i * 30, {
      title, artist: "Aurora Lane", album_artist: "Aurora Lane",
      album: "Long Way Round", track, disc: `${disc}/2`,
    }, path.join(covers, "longway.jpg"))
);

// 3. m4a with embedded artwork.
makeCover(path.join(covers, "dust.jpg"), ["0xc2a878", "0x3b2f2f"]);
["Arroyo", "Dust and Echo", "Switchback"].forEach((title, i) =>
  makeTrack(`Mesa Verde/Dust and Echo/0${i + 1} ${title}.m4a`, 180 + i * 55, {
    title, artist: "Mesa Verde", album: "Dust and Echo", track: i + 1,
  }, path.join(covers, "dust.jpg"))
);

// 4. flac with no embedded artwork, only a cover.jpg in the folder.
["Breakwater", "Harbour Lights", "Ebb"].forEach((title, i) =>
  makeTrack(`Low Tide Club/Harbour Songs/0${i + 1} ${title}.flac`, 260 + i * 35, {
    title, artist: "Low Tide Club", album: "Harbour Songs", track: i + 1,
  })
);
makeCover(path.join(FILES, "Low Tide Club/Harbour Songs/cover.jpg"), ["0x004e64", "0x9fffcb"]);

// 5. A compilation: a different artist on every track and no album artist tag.
makeCover(path.join(covers, "summer.jpg"), ["0xffd23f", "0xee4266"]);
[["Poolside", "The Lidos"], ["Heatwave", "Marta Sol"], ["Last Ferry", "Kit Navarro"]].forEach(
  ([title, artist], i) =>
    makeTrack(`Compilations/Summer Mix/0${i + 1} ${title}.mp3`, 400 + i * 45, {
      title, artist, album: "Summer Mix", track: i + 1,
    }, path.join(covers, "summer.jpg"))
);

// 6. No tags and no artwork at all: everything has to come from the path.
makeTrack("Garage Tapes/Basement Sessions/07 - Untitled Demo.wav", 150);
makeTrack("Garage Tapes/Basement Sessions/08 - Second Take.ogg", 170);

// A file the app should ignore.
fs.writeFileSync(path.join(FILES, "Aurora Lane/notes.txt"), "not music\n");

fs.rmSync(covers, { recursive: true });

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const files = walk(FILES).map((file) => {
  const stat = fs.statSync(file);
  return {
    path: path.relative(FILES, file).split(path.sep).join("/"),
    size: stat.size,
    lastModified: Math.round(stat.mtimeMs),
  };
});

fs.writeFileSync(
  path.join(OUT, "manifest.json"),
  JSON.stringify({ name: "Fixture Music", files }, null, 2)
);

console.log(`Wrote ${files.length} files to ${path.relative(ROOT, OUT)}`);
