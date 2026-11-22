// Run on a Foundry client. The documents and rendered forms stay in memory.
export async function verifyActorCredits(render = foundry.applications.handlebars.renderTemplate) {
  const owner = new CONFIG.User.documentClass({
    _id: foundry.utils.randomID(), name: "Preview owner", role: CONST.USER_ROLES.PLAYER
  });
  const observer = new CONFIG.User.documentClass({
    _id: foundry.utils.randomID(), name: "Preview observer", role: CONST.USER_ROLES.PLAYER
  });
  function previewActor(type, system = {}) {
    const actor = new CONFIG.Actor.documentClass({
      _id: foundry.utils.randomID(), type, name: `Preview ${type}`, system,
      ownership: {default: 0, [owner.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
        [observer.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER},
      flags: {starwarsffg: {loaded: true, config: {enableEditMode: false, editModeActor: ""}}}
    });
    // The legacy sheet constructor sets two persistent flags even when previewing a sheet.
    Object.defineProperty(actor, "setFlag", {value: async () => actor});
    return actor;
  }
  async function renderForm(sheet, context) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = await render(sheet.template, context);
    sheet.form = wrapper.querySelector("form");
    sheet._activateCoreListeners($(sheet.form));
    return sheet.form;
  }
  const results = [];
  const permissions = [[owner, true], [observer, false]];
  const selector = '.tab[data-tab="items"] input[name="data.stats.credits.value"]';
  for (const size of [1, 3]) {
    const group = previewActor("minion", {quantity: {value: size, max: size}});
    for (const id of ["ffg.ActorSheetFFG", "ffg.ActorSheetFFGV2"]) {
      const Sheet = CONFIG.Actor.sheetClasses.minion[id].cls;
      for (const [user, canEdit] of permissions) {
        const sheet = new Sheet(group, {editable: group.canUserModify(user, "update")});
        const form = await renderForm(sheet, await sheet.getData());
        const inputs = form.querySelectorAll(selector);
        const input = inputs[0];
        if (inputs.length !== 1 || input.disabled !== !canEdit || input.dataset.dtype !== "Number" ||
          input.value !== String(group.system.stats.credits.value)) {
          throw new Error(`${id}: minion group wallet with ${user.name}, size ${size}`);
        }
        results.push({id, canEdit, size});
      }
    }
  }
  const actor = previewActor("character");
  for (const id of ["ffg.AdversarySheetFFG", "ffg.AdversarySheetFFGV2"]) {
    const Sheet = CONFIG.Actor.sheetClasses.character[id].cls;
    for (const [user, canEdit] of permissions) {
      const permitted = actor.canUserModify(user, "update");
      if (permitted !== canEdit) throw new Error(`Unexpected update permission for ${user.name}`);
      const sheet = new Sheet(actor, {editable: permitted});
      const context = await sheet.getData();
      for (const automaticSoak of [true, false]) {
        context.settings.enableSoakCalculation = automaticSoak;
        const form = await renderForm(sheet, context);
        const credits = form.querySelector(selector);
        const soak = form.querySelector('input[name="data.stats.soak.value"]');
        if (!credits || credits.disabled !== !canEdit) {
          throw new Error(`${id}: credits with ${user.name}, automatic soak ${automaticSoak}`);
        }
        if (!soak || soak.disabled !== (automaticSoak || !canEdit)) {
          throw new Error(`${id}: soak with ${user.name}, automatic soak ${automaticSoak}`);
        }
        results.push({id, canEdit, automaticSoak});
      }
    }
  }
  return results;
}
