// @ts-check
import { serwist } from "@serwist/next/config";

export default serwist({
  swSrc: "app/sw.ts",
  // The site is a static export, so the worker goes straight into the exported folder.
  swDest: "out/sw.js",
  globIgnores: ["public/dev-fixtures/**"],
});
