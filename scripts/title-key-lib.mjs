// scripts/title-key-lib.mjs
//
// Shared title normalization and hash-key derivation used by interview-lib.mjs
// and deviation-log-lib.mjs. Each was carrying its own byte-for-byte identical
// copy of normalizeTitle + featureKey/planKey -- extracted here so a bug fix
// or normalization change in one place applies to both.
//
// Dependency-free (node: builtins only), matching the codebase convention.

import crypto from "node:crypto";

export function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleKey(title) {
  return crypto.createHash("sha256").update(normalizeTitle(title)).digest("hex").slice(0, 16);
}
