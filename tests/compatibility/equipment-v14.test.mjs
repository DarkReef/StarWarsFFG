import assert from "node:assert/strict";
import test from "node:test";

globalThis.FormApplication = class {};
globalThis.foundry = {documents: {ActiveEffect: class {
  shouldApplyChange() { return true; }
  apply() { return {applied: true}; }
}}};
const {ActiveEffectFFG} = await import("../../modules/active-effects/active-effect-ffg.js");

test("V14 carried armor grants encumbrance but no armor bonus until equipped", () => {
  const effect = new ActiveEffectFFG();
  effect.parent = {type: "armour", system: {equippable: {equipped: false}}};
  assert.equal(effect.shouldApplyChange({key: "system.stats.soak.value"}, {}), false);
  assert.equal(effect.shouldApplyChange({key: "system.stats.encumbrance.value"}, {}), true);
  effect.parent.system.equippable.equipped = true;
  assert.equal(effect.shouldApplyChange({key: "system.stats.soak.value"}, {}), true);
});

test("weapon equip gating preserves V13 behavior and does not suppress species", () => {
  const effect = new ActiveEffectFFG();
  effect.parent = {type: "weapon", system: {equippable: {equipped: false}}};
  assert.deepEqual(effect.apply({}, {key: "system.stats.soak.value"}), {});
  effect.parent.type = "species";
  assert.equal(effect.shouldApplyChange({key: "system.characteristics.brawn.value"}, {}), true);
});
