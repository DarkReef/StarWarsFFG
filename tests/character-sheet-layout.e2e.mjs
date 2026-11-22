// Run in a connected Foundry v14 client. A copy of a real player character,
// native permission checks and off-screen forms keep actors and open windows intact.
export async function verifyCharacterSheetLayout({actorId, auditOnly = false} = {}) {
  const users = game.users.filter(user => !user.isGM);
  const original = actorId ? game.actors.get(actorId) : game.actors.find(actor =>
    actor.type === "character" && actor.items.some(item => item.type === "weapon") &&
    users.some(user => actor.testUserPermission(user, "OWNER")));
  if (!original) throw new Error("Нужен персонаж игрока с оружием");
  const owner = users.find(user => original.testUserPermission(user, "OWNER"));
  if (!owner) throw new Error("У выбранного персонажа нет игрока-владельца");
  const observer = users.find(user => user.id !== owner.id) ?? new CONFIG.User.documentClass({
    _id: foundry.utils.randomID(), name: "Observer", role: CONST.USER_ROLES.PLAYER
  });
  const levels = CONST.DOCUMENT_OWNERSHIP_LEVELS;
  const {default: DiceHelpers} = await import("/systems/starwarsffg/modules/helpers/dice-helpers.js");
  const source = original.toObject();
  source._id = foundry.utils.randomID();
  source.ownership = {default: levels.NONE, [owner.id]:levels.OWNER, [observer.id]:levels.OBSERVER};
  const failures = [];
  const profiles = [];
  const layouts = [];
  const check = (value, message) => { if (!value) failures.push(message); };

  for (const [role, user] of [["owner",owner],["observer",observer]]) {
    const actor = new CONFIG.Actor.documentClass(foundry.utils.deepClone(source));
    const editable = actor.canUserModify(user, "update");
    check(editable === (role === "owner"), role + "/ownership");
    // The legacy constructor initializes edit-mode flags even on preview sheets.
    Object.defineProperty(actor, "setFlag", {value:async () => actor});
    Object.defineProperty(actor, "isOwner", {get:() => editable});
    for (const version of ["ActorSheetFFG","ActorSheetFFGV2"]) {
      const Sheet = CONFIG.Actor.sheetClasses.character["ffg."+version].cls;
      const sheet = new Sheet(actor, {editable});
      const context = await sheet.getData({});
      const host = document.createElement("section");
      host.className = ["app","window-app",...sheet.options.classes].join(" ");
      host.inert = true;
      host.setAttribute("aria-hidden", "true");
      host.style.cssText = "position:fixed;left:-20000px;top:0;width:820px;min-width:0;height:650px;visibility:hidden;pointer-events:none;";
      host.innerHTML = '<header class="window-header"></header><section class="window-content"></section>';
      const body = host.querySelector(".window-content");
      body.innerHTML = await foundry.applications.handlebars.renderTemplate(sheet.template, context);
      const form = body.querySelector("form");
      sheet.form = form;
      document.body.append(host);
      try {
        sheet._activateCoreListeners($(form));
        const tabs = [...form.querySelectorAll(".sheet-tabs [data-tab]")];
        const panels = [...form.querySelectorAll(".sheet-body > .tab")];
        function selectTab(id) {
          for (const tab of [...tabs,...panels]) tab.classList.toggle("active",tab.dataset.tab===id);
        }
        const prefix = version + "/" + role;
        check(tabs.some(tab => tab.dataset.tab === "items") && tabs.some(tab => tab.dataset.tab === "characteristics"), prefix+"/tabs");
        let fieldCount = 0;
        for (const path of ["stats.wounds.value","stats.wounds.max","stats.strain.value","stats.strain.max",
          "stats.soak.value","stats.defence.melee","stats.defence.ranged","stats.forcePool.value","stats.forcePool.max",
          "stats.credits.value","stats.encumbrance.value","stats.encumbrance.max","experience.available","experience.total"]) {
          if (path.startsWith("stats.strain") && actor.flags.starwarsffg?.config?.enableStrainThreshold === false) continue;
          if (path.startsWith("stats.forcePool") && actor.flags.starwarsffg?.config?.enableForcePool === false) continue;
          const input = form.querySelector(`[name="data.${path}"],[name="system.${path}"]`);
          check(input && String(foundry.utils.getProperty(context.data,path)) === input.value, prefix+"/"+path);
          if (input) {
            fieldCount++;
            if (!editable) check(input.disabled || input.readOnly, prefix+"/read-only/"+path);
          }
        }
        const uses = actor.system.stats.medical?.uses ?? 0;
        check(form.querySelector(".medical")?.parentElement.textContent.includes(uses + "/5"),prefix+"/medical-uses");
        selectTab("items");
        const inventory = form.querySelector('.tab[data-tab="items"]');
        const items = actor.items.filter(item => ["weapon","armour","gear"].includes(item.type));
        for (const item of items) check(inventory?.querySelector('[data-item-id="'+item.id+'"]'), prefix+"/equipment/"+item.name);
        selectTab("characteristics");
        const rows = [...form.querySelectorAll(".skill[data-ability]")];
        check(rows.length > 0,prefix+"/skills");
        const usable = [];
        for (const row of rows) {
          const button = row.querySelector(".roll-button");
          const rank = row.querySelector('[name$=".rank"]');
          const key = row.dataset.ability;
          check(rank && Number(rank.value) === Number(actor.system.skills[key]?.rank),prefix+"/rank/"+key);
          const isButton = button?.matches('button[type="button"]');
          const name = button?.getAttribute("aria-label") || button?.textContent.trim();
          if (isButton && name && name.trim() && !button.disabled) usable.push(key);
          if (!editable && isButton) check(button.disabled,prefix+"/observer-roll/"+key);
        }
        if (editable) check(usable.length === rows.length,prefix+"/accessible-rolls "+usable.length+"/"+rows.length);
        check(Boolean(context.canManageXP) === editable, prefix+"/xp-permission");
        profiles.push({version,role,skills:rows.length,namedRolls:usable.length,fields:fieldCount,items:items.length});
        if (!editable) continue;
        // Exercise the native calculation for both event targets without
        // publishing a roll, opening a dialog or replacing global handlers.
        const row = rows.find(row => row.dataset.ability === "Athletics") ?? rows[0];
        const key = row.dataset.ability;
        await DiceHelpers.addSkillDicePool(context,row);
        const control = row.querySelector(".roll-button");
        const outputs = [];
        class RollPreview extends DiceHelpers {
          static displayRollDialog(data,pool,title,skill) { outputs.push({skill,formula:pool.renderDiceExpression()}); }
        }
        for (const target of [control,control.querySelector("img") ?? control]) {
          await RollPreview.rollSkill(sheet,{target,currentTarget:control});
        }
        check(outputs.length === 2 && outputs.every(result =>
          result.skill === context.data.skills[key].label && result.formula && result.formula === outputs[0].formula),prefix+"/native-roll-route/"+key);
        profiles.at(-1).skillRoll = {key,formula:outputs[0]?.formula};
        for (const width of [820,600,420]) {
          host.style.width = width+"px";
          const grid = form.querySelector(".skillsTablesGrid");
          const columns = [...grid.querySelectorAll(".skillColumnGrid")];
          const rects = columns.map(column => column.getBoundingClientRect());
          const sideBySide = rects.length >= 2 && Math.abs(rects[0].top-rects[1].top)<3 &&
            rects[1].left >= rects[0].right-3;
          const nav = form.querySelector(".sheet-tabs").getBoundingClientRect();
          const skillViewport = Math.round(Math.min(grid.getBoundingClientRect().height,host.getBoundingClientRect().bottom-grid.getBoundingClientRect().top));
          const rowHeight = row.getBoundingClientRect().height;
          const headerHeight = grid.querySelector(".skillsHeader")?.getBoundingClientRect().height ?? 0;
          const visibleRows = rowHeight ? Math.max(0,Math.floor((skillViewport-headerHeight)/rowHeight)) : 0;
          const overflow = Math.max(0,Math.ceil(form.scrollWidth-form.clientWidth));
          layouts.push({version,width,sideBySide,navHeight:Math.round(nav.height),skillViewport,visibleRows,overflow});
          check(width > 600 ? sideBySide : !sideBySide,prefix+"/columns/"+width);
          if (width>=600) {
            check(visibleRows >= 2,prefix+"/visible-skills/"+width+"="+visibleRows);
            check(overflow <= 2,prefix+"/horizontal-overflow/"+width+"="+overflow);
          }
        }
      } finally {
        host.remove();
      }
    }
  }
  const result = {world:game.world.id,system:game.system.version,character:original.name,profiles,layouts,failures};
  if (failures.length && !auditOnly) throw new Error(JSON.stringify(result));
  return result;
}
