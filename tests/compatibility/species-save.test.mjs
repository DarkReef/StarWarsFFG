import assert from "node:assert/strict";
import test from "node:test";

globalThis.FormApplication = class {};
globalThis.game = {release: {generation: 14}};
globalThis.CONFIG = {logger: {debug() {}}};
globalThis.foundry = {utils: {deepClone: structuredClone, expandObject: value => value}};
const {default: ModifierHelpers} = await import("../../modules/helpers/modifiers.js");

function species() {
  const effect = {name: "(inherent)", _source: {system: {changes: []}},
    async update(data) {this._source.system.changes = data["system.changes"];} };
  return {type: "species", system: {attributes: {}}, effect, getEmbeddedCollection: () => [effect]};
}
function form(wounds = 10, strain = 10) {
  return {data: {attributes: {
    Brawn: {key: "Brawn", modtype: "Characteristic", mod: "Brawn", value: 3},
    Willpower: {key: "Willpower", modtype: "Characteristic", mod: "Willpower", value: 2},
    Wounds: {key: "Wounds", modtype: "Stat", mod: "Wounds", value: wounds},
    Strain: {key: "Strain", modtype: "Stat", mod: "Strain", value: strain},
  }}};
}
test("saving a new species builds missing inherent effects and thresholds", async () => {
  const item = species();
  await ModifierHelpers.applyActiveEffectOnUpdate(item, form());
  const changes = Object.fromEntries(item.effect._source.system.changes.map(c => [c.key, c.value]));
  assert.equal(changes["system.characteristics.Brawn.value"], 3);
  assert.equal(changes["system.stats.soak.value"], 3);
  assert.equal(changes["system.stats.encumbrance.max"], 8);
  assert.equal(changes["system.stats.wounds.max"], 13);
  assert.equal(changes["system.stats.strain.max"], 12);
});
test("species resave accepts zero thresholds and does not duplicate changes", async () => {
  const item = species();
  await ModifierHelpers.applyActiveEffectOnUpdate(item, form());
  const count = item.effect._source.system.changes.length;
  item.system.attributes = {Wounds: {value: 10}, Strain: {value: 10}};
  await ModifierHelpers.applyActiveEffectOnUpdate(item, form(0, 0));
  const changes = item.effect._source.system.changes;
  assert.equal(changes.length, count);
  assert.equal(changes.find(c => c.key === "system.stats.wounds.max").value, 3);
  assert.equal(changes.find(c => c.key === "system.stats.strain.max").value, 2);
});
