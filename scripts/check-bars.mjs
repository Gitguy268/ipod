#!/usr/bin/env node
// Checks the spectrum behind the Bars visualizer. Run with: node scripts/check-bars.mjs

import assert from "node:assert/strict";

import {
  createBarsState,
  stepBars,
} from "../app/components/views/VisualizerView/bars.ts";

const BINS = 1024;
const spectrum = (db) => new Float32Array(BINS).fill(db);

// Bands cover every bin above DC and widen with frequency.
const { edges } = createBarsState(BINS);
assert.equal(edges[0], 1);
assert.equal(edges.at(-1), BINS);
assert.ok(edges.every((edge, i) => i === 0 || edge > edges[i - 1]));

// Silence stays flat, and a number.
let state = createBarsState(BINS);
for (let i = 0; i < 10; i++) stepBars(state, spectrum(-Infinity), 1 / 60);
assert.ok([...state.smooth, ...state.smear].every((value) => value === 0));

// The loudest band rises to full height, with its smear behind it.
state = createBarsState(BINS);
const sound = spectrum(-60);
sound[state.edges[4]] = -10;
stepBars(state, sound, 1 / 60);
assert.ok(state.smear[4] < state.smooth[4]);
for (let i = 0; i < 300; i++) stepBars(state, sound, 1 / 60);
assert.ok(Math.abs(state.smooth[4] - 1) < 0.01);

// Faint noise is not stretched to full height, and music that stops falls to nothing.
state = createBarsState(BINS);
for (let i = 0; i < 300; i++) stepBars(state, spectrum(-60), 1 / 60);
assert.ok(Math.max(...state.smooth) < 0.25);
stepBars(state, spectrum(-Infinity), 5);
assert.equal(Math.max(...state.smooth), 0);

console.log("bars checks passed");
