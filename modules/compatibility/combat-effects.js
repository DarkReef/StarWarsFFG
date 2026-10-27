/** V14 keeps visible token status icons on the actor's applied Active Effects. */
export function combatEffectIcons(actor, showIcon, defeatedStatus) {
  const icons = new Set();
  for (const effect of actor?.appliedEffects ?? []) {
    if (effect.statuses?.has(defeatedStatus)) continue;
    if (effect.img && (effect.showIcon === showIcon.ALWAYS
      || (effect.showIcon === showIcon.CONDITIONAL && effect.isTemporary))) icons.add(effect.img);
  }
  return icons;
}
