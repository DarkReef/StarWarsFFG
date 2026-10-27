import assert from "node:assert/strict";
import test from "node:test";
import {prepareSkillForceChanges} from "../../modules/compatibility/skill-force.js";

test("skill Force dice use the prepared rating in the final phase and leave source intact", () => {
  const source={key:"system.skills.Athletics.force",type:"add",value:0,phase:"initial"};
  const effect={active:true,_source:{system:{changes:[source]}},system:{changes:[{...source}]}};
  const disabled={active:false,system:{changes:[{...source}]}};
  const actor={system:{stats:{forcePool:{max:1,value:1}}},allApplicableEffects:()=>[effect,disabled]};
  prepareSkillForceChanges(actor,"initial");
  assert.equal(effect.system.changes[0].phase,"final");
  assert.equal(disabled.system.changes[0].phase,"initial");
  actor.system.stats.forcePool.max=3;
  prepareSkillForceChanges(actor,"final");
  assert.equal(effect.system.changes[0].value,2);
  assert.equal(source.value,0);
  assert.equal(source.phase,"initial");
});

test("committed Force dice cannot produce a negative pool", () => {
  const force={key:"system.skills.Athletics.force",value:5};
  const unrelated={key:"system.stats.forcePool.max",value:2};
  const actor={system:{stats:{forcePool:{max:2,value:4}}},allApplicableEffects:()=>[{active:true,system:{changes:[force,unrelated]}}]};
  prepareSkillForceChanges(actor,"final");
  assert.equal(force.value,0);
  assert.equal(unrelated.value,2);
});
