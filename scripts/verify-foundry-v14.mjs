/** Run in a ready Foundry V14 GM client, not in Node. Creates one disposable
 * actor, removes it in finally, and never posts chat messages. */
export async function verifyFoundryV14() {
  if (!game.ready || !game.user.isGM || game.release.generation !== 14) {
    throw new Error("A ready Foundry V14 GM client is required");
  }
  const checks = [];
  const check = (name, pass, actual) => checks.push({ name, pass: Boolean(pass), actual });
  const ActorClass = CONFIG.Actor.documentClass;
  for (const equipped of [false, true]) {
    const actor = new ActorClass({ name: "QA transient armor", type: "character",
      system: { characteristics: { Brawn: { value: 3 } }, stats: { soak: { value: 3 } } },
      items: [{ _id: foundry.utils.randomID(), name: "QA armor", type: "armour",
        system: { soak: { value: 2 }, defence: { value: 1 }, encumbrance: { value: 4 },
          quantity: { value: 1 }, equippable: { equipped } },
        effects: [{ name: "(inherent)", transfer: true, system: { changes: [
          { key: "system.stats.soak.value", type: "add", value: 2 },
          { key: "system.stats.defence.melee", type: "add", value: 1 }
        ] } }] }] });
    const stats = actor.system.stats;
    check(`Immediate armor calculation, equipped=${equipped}`,
      stats.encumbrance.value === (equipped ? 1 : 4) && stats.soak.value === (equipped ? 5 : 3)
      && stats.defence.melee === (equipped ? 1 : 0),
      { encumbrance: stats.encumbrance.value, soak: stats.soak.value, defence: stats.defence.melee });
  }
  const forceActor = new ActorClass({ name: "QA transient Force", type: "character",
    system: { stats: { forcePool: { max: 1, value: 1 } } }, effects: [
      { name: "Rating", system: { changes: [{ key: "system.stats.forcePool.max", type: "add", value: 2 }] } },
      { name: "Disabled rating", disabled: true, system: { changes: [{ key: "system.stats.forcePool.max", type: "add", value: 99 }] } },
      { name: "Skill", system: { changes: [{ key: "system.skills.Athletics.force", type: "add", value: 0 }] } }
    ] });
  for (const reset of [false, true]) {
    if (reset) forceActor.reset();
    check(`Force pool and immutable effect source, reset=${reset}`,
      forceActor.system.stats.forcePool.max === 3 && forceActor.system.skills.Athletics.force === 2
      && forceActor.effects.contents[2]._source.system.changes[0].value === 0,
      { rating: forceActor.system.stats.forcePool.max, skill: forceActor.system.skills.Athletics.force });
  }
  for (const [wounds, survivors] of [[0, 3], [5, 3], [6, 2], [10, 2], [11, 1], [15, 1], [16, 0]]) {
    const actor = new ActorClass({ name: "QA transient minions", type: "minion",
      system: { quantity: { max: 3 }, unit_wounds: { value: 5 }, stats: { wounds: { value: wounds } },
        skills: { Athletics: { groupskill: true } } } });
    check(`Minion group at ${wounds} wounds`, actor.system.quantity.value === survivors
      && actor.system.skills.Athletics.rank === Math.max(survivors - 1, 0),
      { survivors: actor.system.quantity.value, rank: actor.system.skills.Athletics.rank });
  }
  let actor;
  try {
    actor = await ActorClass.create({ name: "QA V14 disposable regression", type: "character",
      flags: { starwarsffg: { runtimeTest: true } },
      system: { characteristics: { Brawn: { value: 3 } }, stats: { wounds: { max: 13 } } } });
    await actor.update({ "system.stats.wounds.value": 4 });
    actor.reset();
    check("Actor update survives data reset", actor.system.stats.wounds.value === 4);
    const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [{ name: "QA agility",
      system: { changes: [{ key: "system.characteristics.Agility.value", type: "add", value: 2 }] } }]);
    check("V14 embedded effect applies", actor.system.characteristics.Agility.value === 2);
    await effect.update({ disabled: true });
    check("Disabling an effect removes its bonus", actor.system.characteristics.Agility.value === 0);
    const [weapon] = await actor.createEmbeddedDocuments("Item", [{ name: "QA weapon", type: "weapon",
      system: { damage: { value: 6 }, description: "[SU] [AD]" } }]);
    if (weapon._inherentAECreation) await weapon._inherentAECreation;
    for (const key of ["uuid", "ffgUuid"]) {
      const original = weapon.system;
      const data = weapon.toObject(false);
      foundry.utils.setProperty(data, `flags.starwarsffg.${key}`, weapon.uuid);
      const roll = new game.ffg.RollFFG("1da", data);
      await roll.evaluate();
      await roll.render();
      check(`Weapon roll preserves typed model (${key})`, weapon.system === original
        && weapon.system instanceof foundry.abstract.TypeDataModel, weapon.system.constructor.name);
    }
    const roll = new game.ffg.RollFFG("1dp + 1da + 1dc + 1di + 1db + 1ds + 1df");
    await roll.evaluate();
    const restored = game.ffg.RollFFG.fromData(roll.toJSON());
    check("Seven dice and serialization", roll.dice.length === 7
      && JSON.stringify(roll.ffg) === JSON.stringify(restored.ffg));
    for (const mode of ["public", "gm", "blind", "self"]) {
      const message = await roll.toMessage({ speaker: { alias: "QA" } }, { messageMode: mode, create: false });
      const html = await message.renderHTML();
      const expected = mode === "public" ? [] : mode === "self" ? [game.user.id]
        : game.users.filter(user => user.isGM).map(user => user.id);
      check(`Chat rendering and visibility: ${mode}`, html instanceof HTMLElement
        && message.blind === (mode === "blind") && expected.length === message.whisper.length
        && expected.every(id => message.whisper.includes(id)),
        { blind: message.blind, recipients: message.whisper.length });
    }
  } finally {
    if (actor?.flags.starwarsffg?.runtimeTest) await actor.delete();
  }
  return { core: game.version, language: game.i18n.lang, passed: checks.every(c => c.pass), checks };
}
