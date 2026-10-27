import assert from "node:assert/strict";
import test from "node:test";
import {combatEffectIcons} from "../../modules/compatibility/combat-effects.js";

test("claimed initiative slots display V14 effects without legacy token fields", () => {
  const modes = {ALWAYS: 1, CONDITIONAL: 2, NEVER: 0};
  const effect = (img, showIcon, isTemporary = false, statuses = []) => ({img, showIcon, isTemporary, statuses: new Set(statuses)});
  const actor = {appliedEffects: [effect('always.svg', 1), effect('temporary.svg', 2, true),
    effect('permanent.svg', 2), effect('hidden.svg', 0), effect('defeated.svg', 1, false, ['dead']), effect('always.svg', 1)]};
  assert.deepEqual([...combatEffectIcons(actor, modes, 'dead')], ['always.svg', 'temporary.svg']);
  assert.deepEqual([...combatEffectIcons(undefined, modes, 'dead')], []);
});
