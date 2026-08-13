// scripts/tests/work-log-lib.test.mjs
//
// Run: node --test scripts/tests/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  newSessionId,
  isSafeSessionId,
  appendEntry,
  readCurrent,
  listSessions,
  generateKickoff,
  ensureInitialized,
  workLogDir,
  currentPath,
  kickoffPath,
  WorkLogError,
} from "../work-log-lib.mjs";

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "worklog-"));
}

const BASE_ENTRY = {
  skill: "fix-bug",
  requester: "abhijith",
  summary: "Fixed the Play Store hyperlink pointing at the wrong bundle id.",
  status: "done",
};

// ---------------------------------------------------------------------------
describe("newSessionId / isSafeSessionId", () => {
  test("generated ids are always filename-safe", () => {
    for (let i = 0; i < 20; i++) {
      assert.ok(isSafeSessionId(newSessionId()));
    }
  });

  test("ids are unique across rapid calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newSessionId()));
    assert.equal(ids.size, 50);
  });

  test("rejects path-traversal-shaped ids", () => {
    assert.equal(isSafeSessionId("../../etc/passwd"), false);
    assert.equal(isSafeSessionId("s/../../x"), false);
  });
});

// ---------------------------------------------------------------------------
describe("appendEntry — validation", () => {
  test("throws on missing required fields", () => {
    const repo = tmpRepo();
    assert.throws(() => appendEntry(repo, { sessionId: "s-1" }), WorkLogError);
  });

  test("throws on invalid status", () => {
    const repo = tmpRepo();
    assert.throws(
      () => appendEntry(repo, { ...BASE_ENTRY, sessionId: "s-1", status: "vibes-good" }),
      WorkLogError
    );
  });

  test("throws on unsafe sessionId", () => {
    const repo = tmpRepo();
    assert.throws(
      () => appendEntry(repo, { ...BASE_ENTRY, sessionId: "../escape" }),
      WorkLogError
    );
  });
});

// ---------------------------------------------------------------------------
describe("appendEntry — writing", () => {
  test("creates the session file under .dev-agent/work-log/", () => {
    const repo = tmpRepo();
    const { file } = appendEntry(repo, { ...BASE_ENTRY, sessionId: "s-1" });
    assert.equal(file, path.join(workLogDir(repo), "s-1.md"));
    assert.ok(fs.existsSync(file));
    const content = fs.readFileSync(file, "utf8");
    assert.match(content, /Fixed the Play Store hyperlink/);
    assert.match(content, /Requested by:\*\* abhijith/);
  });

  test("second entry in the same session appends, does not overwrite", () => {
    const repo = tmpRepo();
    appendEntry(repo, { ...BASE_ENTRY, sessionId: "s-1", summary: "Step one done." });
    appendEntry(repo, { ...BASE_ENTRY, sessionId: "s-1", summary: "Step two done." });
    const content = fs.readFileSync(path.join(workLogDir(repo), "s-1.md"), "utf8");
    assert.match(content, /Step one done\./);
    assert.match(content, /Step two done\./);
  });

  test("writing an entry refreshes CURRENT.md to that entry", () => {
    const repo = tmpRepo();
    appendEntry(repo, { ...BASE_ENTRY, sessionId: "s-1", summary: "First.", status: "in-progress" });
    appendEntry(repo, { ...BASE_ENTRY, sessionId: "s-2", summary: "Second.", status: "done" });
    const current = readCurrent(repo);
    assert.match(current, /Second\./);
    assert.doesNotMatch(current, /First\./);
    assert.match(current, /session s-2/);
  });

  test("nextAction shows up in both the session file and CURRENT.md", () => {
    const repo = tmpRepo();
    appendEntry(repo, {
      ...BASE_ENTRY,
      sessionId: "s-1",
      status: "blocked",
      nextAction: "Waiting on Adhil to confirm the correct bundle id.",
    });
    const current = readCurrent(repo);
    assert.match(current, /Waiting on Adhil/);
  });
});

// ---------------------------------------------------------------------------
describe("readCurrent", () => {
  test("returns null when no work-log exists yet", () => {
    const repo = tmpRepo();
    assert.equal(readCurrent(repo), null);
    assert.equal(fs.existsSync(currentPath(repo)), false);
  });
});

// ---------------------------------------------------------------------------
describe("listSessions", () => {
  test("returns most-recent-first, excludes CURRENT.md", () => {
    const repo = tmpRepo();
    appendEntry(repo, { ...BASE_ENTRY, sessionId: "s-1" });
    // Force a distinguishable mtime ordering.
    const first = path.join(workLogDir(repo), "s-1.md");
    fs.utimesSync(first, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));
    appendEntry(repo, { ...BASE_ENTRY, sessionId: "s-2" });

    const sessions = listSessions(repo, { limit: 5 });
    assert.equal(sessions.length, 2);
    assert.equal(sessions[0].sessionId, "s-2");
    assert.ok(sessions.every((s) => s.sessionId !== "CURRENT"));
  });

  test("respects the limit", () => {
    const repo = tmpRepo();
    for (let i = 0; i < 6; i++) appendEntry(repo, { ...BASE_ENTRY, sessionId: `s-${i}` });
    assert.equal(listSessions(repo, { limit: 2 }).length, 2);
  });

  test("empty repo returns empty array, not an error", () => {
    const repo = tmpRepo();
    assert.deepEqual(listSessions(repo), []);
  });
});

// ---------------------------------------------------------------------------
describe("generateKickoff", () => {
  test("with no history, says so plainly instead of a blank file", () => {
    const repo = tmpRepo();
    const { content } = generateKickoff(repo);
    assert.match(content, /No work-log entries yet/);
  });

  test("includes current state and recent sessions", () => {
    const repo = tmpRepo();
    appendEntry(repo, {
      ...BASE_ENTRY,
      sessionId: "s-1",
      summary: "Investigated the broken Play Store link.",
      status: "handed-off",
      nextAction: "Adhil to review PR #42.",
    });
    const { file, content } = generateKickoff(repo);
    assert.equal(file, kickoffPath(repo));
    assert.match(content, /Investigated the broken Play Store link/);
    assert.match(content, /Adhil to review PR #42/);
    assert.match(content, /s-1/);
  });

  test("does not double-nest CURRENT.md's own header under its own heading", () => {
    const repo = tmpRepo();
    appendEntry(repo, { ...BASE_ENTRY, sessionId: "s-1", summary: "Only entry." });
    const { content } = generateKickoff(repo);
    // Exactly one "Current state" heading of any level should appear before
    // the recent-sessions section -- not "## Current state" immediately
    // followed by a redundant "# Current state".
    const beforeRecent = content.split("## Recent sessions")[0];
    const headingCount = (beforeRecent.match(/#{1,2}\s*Current state/g) || []).length;
    assert.equal(headingCount, 1);
  });

  test("is regenerated fresh each call — stale sessions fall off past the limit", () => {
    const repo = tmpRepo();
    appendEntry(repo, { ...BASE_ENTRY, sessionId: "s-1", summary: "Oldest." });
    appendEntry(repo, { ...BASE_ENTRY, sessionId: "s-2", summary: "Middle." });
    appendEntry(repo, { ...BASE_ENTRY, sessionId: "s-3", summary: "Newest." });
    const { content } = generateKickoff(repo, { recentLimit: 1 });
    assert.match(content, /Newest\./);
    // Only CURRENT.md (which is always the latest) plus 1 recent session
    // are included at recentLimit: 1, so the oldest entry's unique text
    // should not appear in the recent-sessions section.
    const recentSection = content.split("## Recent sessions")[1] || "";
    assert.doesNotMatch(recentSection, /Oldest\./);
  });
});

// ---------------------------------------------------------------------------
describe("ensureInitialized", () => {
  test("on a repo with no .dev-agent/ at all, creates it and writes placeholders", () => {
    const repo = tmpRepo();
    assert.equal(fs.existsSync(workLogDir(repo)), false);
    const result = ensureInitialized(repo);
    assert.equal(result.alreadyInitialized, false);
    assert.equal(result.sessionCount, 0);
    assert.ok(fs.existsSync(currentPath(repo)));
    assert.ok(fs.existsSync(kickoffPath(repo)));
    assert.match(fs.readFileSync(currentPath(repo), "utf8"), /No sessions logged yet/);
    assert.match(fs.readFileSync(kickoffPath(repo), "utf8"), /No prior session history/);
  });

  test("is idempotent — calling it twice on a fresh repo doesn't change anything the second time", () => {
    const repo = tmpRepo();
    ensureInitialized(repo);
    const firstCurrent = fs.readFileSync(currentPath(repo), "utf8");
    const result = ensureInitialized(repo);
    assert.equal(result.alreadyInitialized, true);
    assert.equal(fs.readFileSync(currentPath(repo), "utf8"), firstCurrent);
  });

  test("does NOT overwrite real session content that already exists", () => {
    const repo = tmpRepo();
    appendEntry(repo, { ...BASE_ENTRY, sessionId: "s-1", summary: "Real work happened here." });
    const before = fs.readFileSync(currentPath(repo), "utf8");
    const result = ensureInitialized(repo);
    assert.equal(result.alreadyInitialized, true);
    assert.equal(result.sessionCount, 1);
    assert.equal(fs.readFileSync(currentPath(repo), "utf8"), before);
    assert.match(before, /Real work happened here\./);
  });

  test("does not touch fix-attempts/, quiz/, interviews/, or deviations/ — those stay lazy", () => {
    const repo = tmpRepo();
    ensureInitialized(repo);
    for (const dir of ["fix-attempts", "quiz", "interviews", "deviations"]) {
      assert.equal(fs.existsSync(path.join(repo, ".dev-agent", dir)), false);
    }
  });

  test("sessionCount reflects real sessions, not just file existence", () => {
    const repo = tmpRepo();
    appendEntry(repo, { ...BASE_ENTRY, sessionId: "s-1" });
    appendEntry(repo, { ...BASE_ENTRY, sessionId: "s-2" });
    const result = ensureInitialized(repo);
    assert.equal(result.sessionCount, 2);
  });
});
