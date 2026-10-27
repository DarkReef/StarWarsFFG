/** Apply skill Force dice after rating effects, without mutating persisted changes. */
export function prepareSkillForceChanges(actor, phase) {
  if (phase !== "initial" && phase !== "final") return;
  const pool = actor.system.stats?.forcePool;
  const available = Math.max((Number(pool?.max) || 0) - (Number(pool?.value) || 0), 0);
  for (const effect of actor.allApplicableEffects()) {
    if (!effect.active) continue;
    for (const change of effect.system.changes) {
      if (!change.key?.startsWith("system.skills.") || !change.key.endsWith(".force")) continue;
      if (phase === "initial") change.phase = "final";
      else change.value = available;
    }
  }
}
