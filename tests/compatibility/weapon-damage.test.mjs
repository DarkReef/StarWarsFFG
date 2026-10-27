import assert from "node:assert/strict";
import test from "node:test";
import {prepareWeaponCharacteristicDamage as prepare} from "../../modules/compatibility/weapon-damage.js";

test("weapon damage uses final characteristic effects, once, and preserves other modifiers", () => {
  const actor = {type: "character", system: {characteristics: {Brawn: {value: 1, label: "Сила"}}}};
  const source = {name: "Attachment", value: "+1"};
  const item = {type: "weapon", system: {characteristic: {value: "Brawn"}, damage: {value: 2, adjusted: 3, sources: [source]}}};
  prepare(item, actor);
  assert.equal(item.system.damage.adjusted, 4);
  actor.system.characteristics.Brawn.value = 3;
  prepare(item, actor);
  prepare(item, actor);
  assert.equal(item.system.damage.adjusted, 6);
  assert.equal(item.system.damage.value, 2);
  assert.deepEqual(item.system.damage.sources, [source, {name: "Сила", value: "+3"}]);
  actor.system.characteristics.Brawn.value = 1;
  prepare(item, actor);
  assert.equal(item.system.damage.adjusted, 4);
  item.system.damage = {value: 2, adjusted: 3, sources: [source]};
  prepare(item, actor);
  assert.equal(item.system.damage.adjusted, 4);
  item.system.characteristic.value = "";
  prepare(item, actor);
  assert.equal(item.system.damage.adjusted, 3);
});
