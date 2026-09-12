import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileAuthStore } from "../src/lib/auth/store.server.ts";

test("email signup hashes passwords and sessions persist", async () => {
  const directory = await mkdtemp(join(tmpdir(), "astera-auth-"));
  const path = join(directory, "auth.json");
  try {
    const store = new FileAuthStore(path);
    const user = await store.signup("Mishaal", "Mishaal@example.com", "correct-horse-battery");
    assert.ok(user);
    assert.equal(user.email, "mishaal@example.com");
    assert.equal(await store.signup("Again", "mishaal@example.com", "another-password"), null);
    assert.equal((await store.login("mishaal@example.com", "wrong-password")), null);
    assert.equal((await store.login("mishaal@example.com", "correct-horse-battery"))?.id, user.id);
    const raw = await readFile(path, "utf8");
    assert.doesNotMatch(raw, /correct-horse-battery/);
    const token = await store.createSession(user.id);
    assert.equal((await new FileAuthStore(path).getBySession(token))?.id, user.id);
    const updated = await store.updateProfile(user.id, { interests: ["Food"], pace: "relaxed", stayStyle: "mid-range", diet: "Halal", completed: true });
    assert.equal(updated?.profile.completed, true);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
