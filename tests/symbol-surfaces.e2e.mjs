// Run from a connected Foundry client. The roll is evaluated in memory.
export async function verifySymbolSurfaces() {
  const base = '/systems/starwarsffg/modules';
  const [{default: Editor}, {RollFFG}, {DicePoolFFG}, {GroupManager}] = await Promise.all([
    import(base + '/popout-editor.js'), import(base + '/dice/roll.js'), import(base + '/dice/pool.js'), import(base + '/groupmanager-ffg.js')
  ]);
  const keys = ['success','failure','advantage','threat','triumph','despair','light','dark'];
  const tokens = '[SU] [FA] [AD] [TH] [TR] [DE] [LI] [DA]';
  const node = html => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
  };
  const require = (ok, label) => { if (!ok) throw new Error(label); };
  const symbol = (root, key) => root.querySelector(`[data-ffg-symbol="${key}"]`);
  for (const [surface, html] of [
    ['journal', await foundry.applications.ux.TextEditor.enrichHTML(tokens)],
    ['item', await Editor.renderDiceImages(tokens, {})]
  ]) {
    const root = node(html);
    for (const key of keys) require(symbol(root,key), surface + '/' + key);
  }
  const chat = node('<article><button title="[SU]">Перебросить</button><p>' + tokens + '</p><code>[AD]</code></article>');
  const button = chat.querySelector('button');
  let clicked = 0;
  button.addEventListener('click', () => clicked++);
  Editor.renderChatDiceImages(chat);
  const icon = symbol(chat, 'advantage');
  Editor.renderChatDiceImages(chat);
  chat.querySelector('button').click();
  require(clicked === 1 && chat.querySelector('button') === button && button.title === '[SU]', 'чужие узлы и обработчики чата');
  require(icon && symbol(chat,'advantage') === icon && chat.querySelector('code').textContent === '[AD]', 'повторное обогащение и код');
  const pool = new DicePoolFFG({ability:1,success:1,threat:-2,dark:1});
  const preview = pool.renderAdvancedPreview();
  require(symbol(preview,'success') && symbol(preview,'dark') && symbol(preview,'threat'), 'предпросмотр пула');
  require(preview.querySelector('img') && !preview.textContent.includes('[TH]'), 'кости и модификаторы пула');
  const group = new GroupManager();
  const manager = node(await foundry.applications.handlebars.renderTemplate(group.options.template, group.getData()));
  for (const key of ['light','dark']) {
    require(symbol(manager.querySelector(`input[name="dPool.${key}"]`).closest('label'),key), 'счётчик ' + key);
  }
  const roll = new RollFFG('1da', {}, {light:2});
  await roll.evaluate();
  const card = node(await roll.render());
  require(symbol(card.querySelector('.dice-result ul'),'light'), 'числовой итог штатной карточки');
  require(card.querySelector('.dice-tooltip'), 'подсказка к броску');
  const hidden = node(await roll.render({isPrivate:true}));
  require(!hidden.querySelector('.dice-result'), 'закрытый бросок');
  return {world:game.world.id, version:game.system.version, journal:8, item:8, chat:8, preview:true, group:true, roll:true};
}
