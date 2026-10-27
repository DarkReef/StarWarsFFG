const pending = new WeakMap();

/** Serialize uses per actor so rapid clicks read the result of the previous treatment. */
export function useMedicalItem(actor, itemId, consume) {
  const operation = (pending.get(actor) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const item = actor.items.get(itemId);
    const type = Number(item?.flags.starwarsffg?.config?.medicalType);
    if (!item || ![1, 2].includes(type)) return {used: false};
    if (consume && item.system.quantity.value <= 0) return {used: false};
    const uses = actor.system.stats.medical.uses ?? 0;
    if (uses >= 5) return {used: false, reason: "limit"};
    const healing = type === 1 ? 5 - uses : 3;
    if (consume) await item.update({"system.quantity.value": item.system.quantity.value - 1});
    await actor.update({
      "system.stats.medical.uses": uses + 1,
      "system.stats.wounds.value": Math.max(actor.system.stats.wounds.value - healing, 0),
    });
    return {used: true, uses: uses + 1};
  });
  pending.set(actor, operation);
  return operation.finally(() => {
    if (pending.get(actor) === operation) pending.delete(actor);
  });
}
