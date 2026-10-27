const contributions = new WeakMap();

/** Reconcile the characteristic bonus after actor effects, without touching source data. */
export function prepareWeaponCharacteristicDamage(item, actor) {
  if (item.type !== "weapon" || actor.type === "vehicle") return;
  const damage = item.system.damage;
  const previous = contributions.get(item);
  // Item preparation rebuilds sources; only remove a contribution still in this calculation.
  if (previous && damage.sources?.includes(previous.source)) {
    damage.adjusted -= previous.amount;
    damage.sources.splice(damage.sources.indexOf(previous.source), 1);
  }
  contributions.delete(item);
  const key = item.system.characteristic?.value;
  const characteristic = actor.system.characteristics?.[key];
  if (!characteristic) return;
  const amount = Number(characteristic.value) || 0;
  const source = {name: characteristic.label || key, value: amount > 0 ? `+${amount}` : `${amount}`};
  damage.adjusted += amount;
  damage.sources ??= [];
  damage.sources.push(source);
  contributions.set(item, {source, amount});
}
