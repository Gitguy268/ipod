#!/usr/bin/env node
// Checks how tracks are grouped into albums and artists. Run with: node scripts/check-index.mjs

import assert from "node:assert/strict";

import {
  buildIndex,
  searchIndex,
  toTrackRecord,
} from "../app/lib/library/buildIndex.ts";

const file = (path) => ({ path, size: 1, lastModified: 1 });
const ROOT = "Music";

const records = [
  // Tagged album, listed out of order.
  toTrackRecord(file("A/Northern/02 b.mp3"), { title: "Green Ribbon", artist: "Aurora Lane", album: "Northern Lights", trackNumber: 2 }, ROOT),
  toTrackRecord(file("A/Northern/01 a.mp3"), { title: "First Light", artist: "Aurora Lane", album: "Northern Lights", trackNumber: 1 }, ROOT),
  // Two discs in separate folders, joined by the album artist tag (whatever its capitalisation).
  toTrackRecord(file("A/Long/CD2/01.mp3"), { title: "Return", artist: "Aurora Lane", albumArtist: "aurora lane", album: "Long Way Round", trackNumber: 1, discNumber: 2 }, ROOT),
  toTrackRecord(file("A/Long/CD1/02.mp3"), { title: "Motorway", artist: "Aurora Lane", albumArtist: "Aurora Lane", album: "Long Way Round", trackNumber: 2, discNumber: 1 }, ROOT),
  toTrackRecord(file("A/Long/CD1/01.mp3"), { title: "Departure", artist: "Aurora Lane", albumArtist: "Aurora Lane", album: "Long Way Round", trackNumber: 1, discNumber: 1 }, ROOT),
  // Compilation with no album artist tag.
  toTrackRecord(file("Comp/Summer/01.mp3"), { title: "Poolside", artist: "The Lidos", album: "Summer Mix", trackNumber: 1 }, ROOT),
  toTrackRecord(file("Comp/Summer/02.mp3"), { title: "Heatwave", artist: "Marta Sol", album: "Summer Mix", trackNumber: 2 }, ROOT),
  // Two different albums that happen to share a name.
  toTrackRecord(file("X/Greatest Hits/01.mp3"), { title: "One", artist: "Band X", album: "Greatest Hits" }, ROOT),
  toTrackRecord(file("Y/Greatest Hits/01.mp3"), { title: "Two", artist: "Band Y", album: "Greatest Hits" }, ROOT),
  // Two discs in "CD1"/"Disc 2" folders with no album artist tag.
  toTrackRecord(file("Z/Double/CD1/01.mp3"), { title: "Side A", artist: "Band Z", album: "Double", trackNumber: 1, discNumber: 1 }, ROOT),
  toTrackRecord(file("Z/Double/Disc 2/01.mp3"), { title: "Side C", artist: "Band Z", album: "Double", trackNumber: 1, discNumber: 2 }, ROOT),
  // Untagged files in a disc folder take the album name from the folder above it.
  toTrackRecord(file("Garage Tapes/Live Set/CD1/01 Intro.mp3"), undefined, ROOT),
  // No tags at all.
  toTrackRecord(file("Garage Tapes/Basement Sessions/07 - Untitled Demo.wav"), undefined, ROOT),
  toTrackRecord(file("loose.mp3"), undefined, ROOT),
];

const index = buildIndex(records, { "folder:A/Northern|northern lights": "blob:northern" });
const album = (name, artist) =>
  index.albums.find((a) => a.name === name && (!artist || a.artistName === artist));

assert.equal(index.songs.length, records.length);
assert.equal(index.albums.length, 9);

// Track order and artwork.
assert.deepEqual(album("Northern Lights").songs.map((s) => s.name), ["First Light", "Green Ribbon"]);
assert.equal(album("Northern Lights").artwork.url, "blob:northern");
assert.equal(album("Northern Lights").songs[0].artwork.url, "blob:northern");
assert.equal(album("Summer Mix").artwork, undefined);

// Discs stay in one album, ordered by disc and then track.
assert.deepEqual(album("Long Way Round").songs.map((s) => s.name), ["Departure", "Motorway", "Return"]);

assert.deepEqual(album("Double").songs.map((s) => s.name), ["Side A", "Side C"]);
const intro = index.songsById.get("Garage Tapes/Live Set/CD1/01 Intro.mp3");
assert.deepEqual([intro.name, intro.albumName, intro.artistName], ["Intro", "Live Set", "Garage Tapes"]);

// Compilations stay together under "Various Artists" but keep each track's artist.
assert.equal(album("Summer Mix").artistName, "Various Artists");
assert.deepEqual(album("Summer Mix").songs.map((s) => s.artistName), ["The Lidos", "Marta Sol"]);

// Same album name in different folders stays separate.
assert.ok(album("Greatest Hits", "Band X"));
assert.ok(album("Greatest Hits", "Band Y"));

// Missing tags fall back to the path.
const demo = index.songsById.get("Garage Tapes/Basement Sessions/07 - Untitled Demo.wav");
assert.deepEqual(
  [demo.name, demo.albumName, demo.artistName, demo.trackNumber],
  ["Untitled Demo", "Basement Sessions", "Garage Tapes", 7]
);
const loose = index.songsById.get("loose.mp3");
assert.deepEqual([loose.name, loose.albumName, loose.artistName], ["loose", "Music", "Unknown Artist"]);

// Artists are album artists, sorted by name.
assert.deepEqual(
  index.artists.map((a) => a.name),
  ["Aurora Lane", "Band X", "Band Y", "Band Z", "Garage Tapes", "Unknown Artist", "Various Artists"]
);
assert.equal(index.artistsById.get("artist:aurora lane").albums.length, 2);
assert.equal(index.albumIdBySongId.get("A/Long/CD2/01.mp3"), album("Long Way Round").id);

// Search.
const results = searchIndex(index, "  LIGHT ");
assert.deepEqual(results.albums.map((a) => a.name), ["Northern Lights"]);
assert.deepEqual(results.songs.map((s) => s.name).sort(), ["First Light", "Green Ribbon"]);
assert.deepEqual(searchIndex(index, "").songs, []);

console.log("index checks passed");
