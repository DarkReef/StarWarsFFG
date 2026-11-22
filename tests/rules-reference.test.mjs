import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import test from "node:test";

// Point this at a previous system installation to reproduce the original failure.
const root = process.env.SWFFG_SYSTEM_ROOT || fileURLToPath(new URL("../", import.meta.url));

test("Foundry loads the player-accessible reference and respects other shortcuts in text fields", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "system.json"), "utf8"));
  const script = manifest.esmodules.find(name => name.endsWith("/rules-reference.mjs"));
  assert.ok(script, "the system must load the F1 reference");
  const hooks = new Map();
  const events = new Map();
  let assigned = [{key: "F1"}];
  let registration;
  globalThis.CONST = {KEYBINDING_PRECEDENCE: {PRIORITY: 0}};
  globalThis.Hooks = {once: (name, callback) => hooks.set(name, callback)};
  globalThis.window = {addEventListener: (name, callback) => events.set(name, callback)};
  globalThis.game = {keyboard: {hasFocus: true}, keybindings: {
    register: (namespace, action, config) => { registration = {namespace, action, ...config}; },
    get: () => assigned
  }};
  await import(pathToFileURL(path.join(root, script)).href);
  hooks.get("init")();
  assert.equal(registration.namespace, manifest.id);
  assert.equal(registration.action, "rulesReference");
  assert.deepEqual(registration.editable, [{key: "F1"}]);
  assert.equal(registration.restricted, false);
  assert.equal(registration.precedence, CONST.KEYBINDING_PRECEDENCE.PRIORITY);
  assert.equal(typeof registration.onDown, "function");
  assert.equal(registration.repeat, true);
  assert.equal(registration.onDown({repeat: true}), true);
  hooks.get("ready")();
  const keydown = events.get("keydown");
  const preventDefault = () => assert.fail("unrelated keyboard event was consumed");
  keydown({code: "KeyF", preventDefault});
  keydown({code: "F1", ctrlKey: true, preventDefault});
  keydown({code: "F1", isComposing: true, preventDefault});
  assigned = [{key: "F2"}];
  keydown({code: "F1", preventDefault});
});
