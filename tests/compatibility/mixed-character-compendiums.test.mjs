import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Run the real wizard and sheet methods with Foundry's pack query semantics.
// Dialog rendering is the boundary: assertions inspect exactly what the template receives.
function setup() {
  const gear = ["weapon", "armour", "gear", "itemattachment", "itemmodifier", "shipweapon", "shipattachment", "homesteadupgrade"];
  const types = [...gear, "ability", "species", "background", "career", "motivation", "obligation",
    "specialization", "forcepower", "signatureability", "talent"];
  const docs = types.map(type => ({
    id: type, type, name: type, uuid: "Compendium.mixed." + type, link: type,
    system: { rarity: { value: 0 }, type: "culture", base_cost: 15, required_force_rating: 1, tier: 1 },
  }));
  const signature = docs.find(d => d.type === "signatureability");
  signature.system.uplink_nodes = { uplink0: true };
  // A signature and a talent can have the same display name, but different UUIDs.
  docs.push({ ...docs.find(d => d.type === "talent"), name: signature.name, uuid: "Compendium.mixed.collision" });
  const weapon = docs.find(d => d.type === "weapon");
  docs.push({ ...weapon, name: "rare", system: { rarity: { value: 9 } } });
  docs.push({ ...weapon, name: "restricted", system: { rarity: { value: 1, isrestricted: true } } });
  const packs = new Map([
    ["mixed", { metadata: { label: "Mixed" }, async getDocuments(query = {}) {
      return docs.filter(d => (!query.type || d.type === query.type) && (!query.type__in || query.type__in.includes(d.type)));
    } }],
  ]);
  const world = [{ type: "species", name: "World species", link: "World" }];
  world.get = id => world.find(d => d.id === id);
  let rendered;
  const renderedBoundary = new Error("purchase form rendered");
  const context = vm.createContext({
    game: { items: world, packs, i18n: { localize: key => key }, settings: { get(scope, key) {
      if (key === "maxRarity") return 5;
      if (key === "allowRestricted") return false;
      return "missing,mixed";
    } } },
    foundry: { appv1: { sheets: { ActorSheet: class {} } }, applications: {
      api: { ApplicationV2: class {}, HandlebarsApplicationMixin: Base => Base },
      ux: { TextEditor: { enrichHTML: async link => link } },
      handlebars: { async renderTemplate(path, model) { rendered = model; throw renderedBoundary; } },
    } },
    $: target => ({ data: () => target }),
    fromUuidSync: uuid => docs.find(d => d.uuid === uuid),
  });
  // Imports handle unrelated Foundry subsystems (dice, crew, XP, embedded items).
  for (const relative of ["modules/actors/actor-sheet-ffg.js", "modules/helpers/character-creator.js"]) {
    const source = readFileSync(new URL("../../" + relative, import.meta.url), "utf8");
    vm.runInContext(source.replace(/^import\s+[\s\S]*?\sfrom\s+"[^"]+";\s*$/gm, "").replace(/^export /gm, ""), context, { filename: relative });
  }
  const wizard = vm.runInContext("Object.create(CharacterCreator.prototype)", context);
  const sheet = vm.runInContext("Object.create(ActorSheetFFG.prototype)", context);
  const career = { type: "career", system: { specializations: { a: { name: "owned" } }, signatureabilities: { s: { name: signature.name } } } };
  const specialization = { name: "owned", type: "specialization", system: { talents: { talent16: { islearned: true } } } };
  wizard.calcXp = () => ({ available: 100 });
  wizard.data = { selected: { career }, purchases: { xp: { specializations: [] } } };
  sheet.actor = { verifyEditModeIsNotEnabled: () => true };
  sheet.object = { items: [career, specialization], talentList: [], system: { experience: { total: 100, available: 100 } } };
  return { wizard, sheet, gear, async capture(action) {
    await assert.rejects(action, error => error === renderedBoundary);
    return rendered;
  } };
}

test("wizard lists select the relevant Item subtypes, world sources and allowed gear", async () => {
  const { wizard, gear } = setup();
  const names = list => Array.from(list, d => d.name);
  assert.deepEqual(names(await wizard.getAvailableSpecies()), ["species", "World species"]);
  assert.deepEqual(names(await wizard.getAvailableCareers()), ["career"]);
  assert.deepEqual(names(await wizard.getAvailableMoralities()), ["obligation"]);
  assert.deepEqual(names(await wizard.getAvailableMotivations()), ["motivation"]);
  assert.deepEqual(names((await wizard.getBackgrounds()).cultures), ["background"]);
  assert.deepEqual(names(await wizard.getItems()), gear);
});

test("wizard purchase dialogs filter mixed packs before grouping by career or Force rating", async () => {
  const { wizard, capture } = setup();
  const specs = await capture(() => wizard.handleSpecializationPurchase());
  assert.deepEqual(Array.from(specs.outCareer, d => d.name), ["specialization"]);
  const powers = await capture(() => wizard.handleForcePowerPurchase());
  assert.deepEqual(Array.from(powers.selectableItems, d => d.name), ["forcepower"]);
  assert.deepEqual(Array.from(powers.groups), [1]);
});

test("sheet purchase dialogs preserve the XP, group and prerequisite rules for their subtype", async () => {
  const { sheet, capture } = setup();
  const buy = action => capture(() => sheet._buyCore({ target: action }));
  const specs = await buy("specialization");
  assert.deepEqual(Array.from(specs.outCareer, d => d.name), ["specialization"]);
  const powers = await buy("forcepower");
  assert.deepEqual(Array.from(powers.selectableItems, d => d.name), ["forcepower"]);
  const talents = await buy("talent");
  assert.deepEqual(Array.from(talents.selectableItems.at(-1).items, i => i.cost), [5, 5]);
  const signatures = await buy("signatureability");
  assert.deepEqual(Array.from(signatures.selectableItems, d => d.source), ["Compendium.mixed.signatureability"]);
});
