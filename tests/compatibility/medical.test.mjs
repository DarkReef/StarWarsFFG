import assert from "node:assert/strict";
import test from "node:test";
import {useMedicalItem} from "../../modules/helpers/medical.js";

function fixture(type = 1, quantity = 2, wounds = 12, uses = 0) {
  const item = {flags: {starwarsffg: {config: {medicalType: type}}}, system: {quantity: {value: quantity}},
    async update(data) {await Promise.resolve(); this.system.quantity.value = data['system.quantity.value'];}};
  const actor = {items: new Map([['stim', item]]), system: {stats: {wounds: {value: wounds}, medical: {uses}}},
    async update(data) {await Promise.resolve(); this.system.stats.wounds.value = data['system.stats.wounds.value']; this.system.stats.medical.uses = data['system.stats.medical.uses'];}};
  return {actor, item};
}

test("concurrent treatments consume and heal once per available item", async () => {
  const {actor, item} = fixture();
  const results = await Promise.all(Array.from({length: 3}, () => useMedicalItem(actor, 'stim', true)));
  assert.deepEqual(results.map(r => r.used), [true, true, false]);
  assert.equal(item.system.quantity.value, 0);
  assert.equal(actor.system.stats.medical.uses, 2);
  assert.equal(actor.system.stats.wounds.value, 3);
});
test("five daily uses, diminishing stimpack recovery, and wound floor", async () => {
  const {actor, item} = fixture(1, 8, 12);
  const wounds = [];
  for (let i = 0; i < 6; i++) {await useMedicalItem(actor, 'stim', true); wounds.push(actor.system.stats.wounds.value);}
  assert.deepEqual(wounds, [7, 3, 0, 0, 0, 0]);
  assert.equal(actor.system.stats.medical.uses, 5);
  assert.equal(item.system.quantity.value, 3);
});
test("droid patches heal three and respect the daily limit with consumption disabled", async () => {
  const {actor, item} = fixture(2, 0, 10, 4);
  assert.equal((await useMedicalItem(actor, 'stim', false)).used, true);
  assert.equal(actor.system.stats.wounds.value, 7);
  assert.equal((await useMedicalItem(actor, 'stim', false)).reason, 'limit');
  assert.equal(item.system.quantity.value, 0);
});
