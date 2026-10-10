import { APP_URL } from "@/utils/constants/api";

import { LibraryEntry } from "./types";

const FIXTURE_URL = `${APP_URL}/dev-fixtures`;

interface FixtureManifest {
  name: string;
  files: { path: string; size: number; lastModified: number }[];
}

export const isFixtureRequested = () =>
  process.env.NODE_ENV === "development" &&
  new URLSearchParams(window.location.search).has("fixture");

/**
 * Loads a test library over HTTP from `public/dev-fixtures`, so the app can be exercised
 * without the system folder picker. Only used by the dev server when the page is opened
 * with `?fixture`. The folder is not part of the repo (see `scripts/make-fixtures.mjs`).
 */
export const loadFixtureEntries = async () => {
  const response = await fetch(`${FIXTURE_URL}/manifest.json`);

  if (!response.ok) {
    return undefined;
  }

  const manifest: FixtureManifest = await response.json();

  const entries: LibraryEntry[] = manifest.files.map((file) => ({
    ...file,
    getFile: async () => {
      const url = `${FIXTURE_URL}/files/${file.path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;
      const blob = await (await fetch(url)).blob();

      return new File([blob], file.path.split("/").pop() ?? file.path, {
        lastModified: file.lastModified,
      });
    },
  }));

  return { name: manifest.name, entries };
};
