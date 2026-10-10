#!/usr/bin/env node
// Checks how tracks are grouped into albums and artists. Run with: node scripts/check-index.mjs

import assert from "node:assert/strict";

import {
  buildIndex,
  resolvePlaylist,
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

// Artists: a leading "The" is ignored when sorting; albums run oldest first.
const dated = buildIndex([
  toTrackRecord(file("z/1.mp3"), { title: "a", artist: "Zebra", album: "Stripes", year: 1999, genre: "Rock" }, ROOT),
  toTrackRecord(file("b/1.mp3"), { title: "b", artist: "The Beatles", album: "Late One", year: 1969, genre: "Rock" }, ROOT),
  toTrackRecord(file("b/2.mp3"), { title: "c", artist: "The Beatles", album: "Early One", year: 1963, genre: "Pop" }, ROOT),
  toTrackRecord(file("b/3.mp3"), { title: "d", artist: "The Beatles", album: "Undated" }, ROOT),
  toTrackRecord(file("c/1.mp3"), { title: "e", artist: "Coltrane", album: "Blue", year: 1957, genre: "Jazz" }, ROOT),
  toTrackRecord(file("c/2.mp3"), { title: "f", artist: "Coltrane", album: "Blue", year: 1957, genre: "jazz" }, ROOT),
  toTrackRecord(file("c/3.mp3"), { title: "g", artist: "Coltrane", album: "Blue", year: 1958, genre: "Bop" }, ROOT),
]);
assert.deepEqual(dated.artists.map((a) => a.name), ["The Beatles", "Coltrane", "Zebra"]);
assert.deepEqual(
  dated.artistsById.get("artist:the beatles").albums.map((a) => a.name),
  ["Early One", "Late One", "Undated"]
);

// Albums take the year and genre most of their tracks agree on.
const blue = dated.albums.find((a) => a.name === "Blue");
assert.equal(blue.year, 1957);
assert.equal(blue.genre, "Jazz");
assert.deepEqual(dated.genres.map((g) => `${g.name}:${g.albums.length}`), ["Jazz:1", "Pop:1", "Rock:2"]);

// Playlists: the many ways a line can point at a song.
const songPaths = [
  "Aurora Lane/Long Way Round/CD1/01 Departure.mp3",
  "Mesa Verde/Dust and Echo/01 Arroyo.m4a",
  "Compilations/Summer Mix/02 Heatwave.mp3",
  "Low Tide Club/Harbour Songs/03 Ebb.flac",
  "X/Greatest Hits/01.mp3",
  "Y/Greatest Hits/01.mp3",
];
assert.deepEqual(
  resolvePlaylist(
    {
      path: "Playlists/Road Trip.m3u",
      text: [
        "\uFEFF#EXTM3U",
        "#EXTINF:8,Aurora Lane - Departure",
        "../Aurora Lane/Long Way Round/CD1/01 Departure.mp3", // relative to the playlist
        "..\\Mesa Verde\\Dust and Echo\\01 Arroyo.m4a", // Windows separators
        "C:\\Users\\someone\\Music\\Compilations\\Summer Mix\\02 HEATWAVE.mp3", // absolute, other case
        "file:///Volumes/Music/Low%20Tide%20Club/Harbour%20Songs/03%20Ebb.flac", // escaped URL
        "Y/Greatest Hits/01.mp3", // relative to the music folder
        "01.mp3", // ambiguous: two songs have this name
        "../Missing/Not Here.mp3",
        "",
      ].join("\r\n"),
    },
    songPaths
  ),
  [
    "Aurora Lane/Long Way Round/CD1/01 Departure.mp3",
    "Mesa Verde/Dust and Echo/01 Arroyo.m4a",
    "Compilations/Summer Mix/02 Heatwave.mp3",
    "Low Tide Club/Harbour Songs/03 Ebb.flac",
    "Y/Greatest Hits/01.mp3",
  ]
);

// Playlists in the index: named after the file, and dropped if nothing matched.
const withPlaylists = buildIndex(records, {}, [
  { path: "Lists/Mix Tape.m3u8", text: "../Comp/Summer/02.mp3\n../A/Northern/01 a.mp3\n" },
  { path: "Lists/Empty.m3u", text: "nothing/here.mp3\n" },
]);
assert.deepEqual(withPlaylists.playlists.map((p) => p.name), ["Mix Tape"]);
assert.deepEqual(withPlaylists.playlists[0].songs.map((s) => s.name), ["Heatwave", "First Light"]);
assert.equal(withPlaylists.playlists[0].description, "2 songs");
assert.deepEqual(searchIndex(withPlaylists, "tape").playlists.map((p) => p.name), ["Mix Tape"]);

console.log("index checks passed");
