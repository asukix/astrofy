// The Surpriser Chrome extension, offered for download on /apps/surpriser/bovitmeny.
// Its source is a separate repo (~/Documents/Repo/surpriser-chrome); a new version means:
// `sh tools/package.sh` there → the zip into public/apps/surpriser/, `node tools/build-bookmarklet.mjs`
// → bookmarklet.txt here, and the numbers below.
import bookmarklet from "./bookmarklet.txt?raw";

export const EXTENSION = {
  version: "0.3.0",
  updated: "2026. november 7.",
  zipUrl: "/apps/surpriser/surpriser-chrome-0.3.0.zip",
  zipSizeKb: 19,
  /** `javascript:` link: the same reading logic, without installing anything. */
  bookmarklet: bookmarklet.trim(),
};
