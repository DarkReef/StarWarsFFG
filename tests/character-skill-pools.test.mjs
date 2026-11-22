import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("preparing dice previews reads sheet data once per render with skill rows", async () => {
  const script = readFileSync(new URL("../modules/actors/actor-sheet-ffg.js", import.meta.url), "utf8");
  const previews = [];
  const sandbox = vm.createContext({
    DiceHelpers: {addSkillDicePool: async (context, row) => previews.push([context, row])},
    foundry: {appv1: {sheets: {ActorSheet: class {activateListeners() {}}}}, applications: {ux: {Tabs: class {}}}}
  });
  vm.runInContext(script.replace(/^import\s+[\s\S]*?\sfrom\s+"[^"]+";\s*$/gm, "")
    .replace(/^export /gm, ""), sandbox);
  const sheet = vm.runInContext("Object.create(ActorSheetFFG.prototype)", sandbox);
  let reads = 0;
  const context = {skills: {}};
  sheet.getData = async () => { reads++; return context; };
  sheet._filters = {skills: new Set()};
  function render(rows) {
    const empty = {on() {}, click() {}};
    const skillElements = {length: rows.length, get: () => rows, each: callback => rows.forEach((row, i) => callback(i, row))};
    sheet.activateListeners({get() {}, find: selector => selector === ".skill" ? skillElements : empty});
    return new Promise(resolve => setImmediate(resolve));
  }
  await render([]);
  assert.equal(reads, 0);
  const rows = ["Brawl", "Cool", "Survival"];
  await render(rows);
  assert.equal(reads, 1);
  assert.deepEqual(previews, rows.map(row => [context, row]));
  await render(rows.slice(0, 1));
  assert.equal(reads, 2);
});
