// Run with Node 20+, Playwright and a local licensed Foundry v14 installation:
// FOUNDRY_APP_ROOT=/path/to/resources/app node --test tests/rules-reference.e2e.cjs
const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright");

const root = path.resolve(__dirname, "..");
const app = process.env.FOUNDRY_APP_ROOT;
const referenceModule = "modules/apps/rules-reference.mjs";
let browser;

before(async () => {
  assert.ok(app, "Set FOUNDRY_APP_ROOT to the installed Foundry resources/app directory");
  browser = process.env.PLAYWRIGHT_CDP
    ? await chromium.connectOverCDP(process.env.PLAYWRIGHT_CDP)
    : await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
});
after(async () => { await browser?.close(); });

// Use Foundry's installed keybinding registry and keyboard dispatcher. Only the
// surrounding game lifecycle and client settings are supplied by this harness.
async function openWorld(t, options = {}) {
  const page = await browser.newPage({ viewport: { width: 640, height: 600 } });
  t.after(() => page.close());
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  const manifest = JSON.parse(await fs.readFile(path.join(root, "system.json"), "utf8"));
  await page.route("http://world.test/**", async route => {
    const name = new URL(route.request().url()).pathname.slice(1);
    if (!name) return route.fulfill({contentType: "text/html; charset=utf-8", body: `<!doctype html>
      <html lang="ru"><meta charset="utf-8"><link rel="icon" href="data:,">
      <script type="importmap">{"imports":{"@client/":"/client/"}}</script>
      <main><textarea aria-label="Чат"></textarea></main></html>`});
    const source = name.startsWith("client/") ? path.join(app, name) : path.join(root, name);
    await route.fulfill({contentType: name.endsWith(".css") ? "text/css" : "text/javascript", body: await fs.readFile(source)});
  });
  await page.goto("http://world.test/");
  assert.ok(manifest.esmodules.includes(referenceModule), "Foundry must load the F1 reference from system.json");
  for (const css of manifest.styles.filter(style => style.includes("rules-reference"))) {
    await page.addStyleTag({url: "/" + css});
  }
  await page.evaluate(async ({options, referenceModule}) => {
    const hooks = new Map();
    window.Hooks = {once: (event, callback) => hooks.set(event, callback)};
    window.CONST = { KEYBINDING_PRECEDENCE: {PRIORITY: 0, NORMAL: 1, DEFERRED: 2} };
    window.CONFIG = {debug: {keybindings: false}};
    window.foundry = {applications: {detached: {}}, utils: {getType: el => el instanceof HTMLElement ? "HTMLElement" : "unknown"}};
    const settings = options.remap ? {"starwarsffg.rulesReference": [{key: "F2", modifiers: []}]} : {};
    window.game = {user: {isGM: !!options.gm}, modules: new Map(),
      settings: {get: (_namespace, key) => key === "keybindings" ? settings : false}};
    if (options.pdf !== undefined) {
      game.modules.set("starwars-ffg-compendium-rus", {active: true});
      foundry.applications.ux = {TextEditor: {implementation: {enrichHTML: async token => {
        const page = Number(/^@SWFFGPage\[(\d+)\]$/.exec(token)[1]);
        return options.pdf ? '<a href="/campaign/books/core.pdf#page=' + page + '">с. ' + page + '</a>' : '<span>с. ' + page + '</span>';
      }}}};
    }
    const {default: Registry} = await import("/client/helpers/interaction/client-keybindings.mjs");
    const {default: Keyboard} = await import("/client/helpers/interaction/keyboard-manager.mjs");
    game.keybindings = new Registry();
    game.keyboard = new Keyboard();
    window.otherHelp = 0;
    game.keybindings.register("example", "help", {name: "Other help", editable: [{key: "F1"}],
      onDown: () => { window.otherHelp++; return true; }});
    await import("/" + referenceModule);
    hooks.get("init")();
    game.keybindings.initialize();
    game.keyboard._activateListeners();
    hooks.get("ready")?.();
  }, {options, referenceModule});
  return page;
}

test("A player opens the Russian reference, navigates every section, and returns to the game", async t => {
  const page = await openWorld(t);
  await page.keyboard.press("F1");
  const dialog = page.getByRole("dialog", {name: "Справка по правилам"});
  await dialog.waitFor();
  for (const [button, rule, source] of [
    ["Ход и действия", "2 напряжения", "224–225"],
    ["Бой", "поглощение", "229–233"],
    ["Расход символов", "3 Преимущества", "231"],
    ["Расход символов", "2 Угрозы", "231"],
    ["Сила и Судьба", "Конфликт", "311"],
    ["Ранения и лечение", "Критическое ранение", "246"],
    ["Проверки", "Триумф", "20–21"]
  ]) {
    await dialog.getByRole("button", {name: button, exact: true}).click();
    assert.ok((await dialog.innerText()).includes(rule), rule);
    assert.ok((await dialog.innerText()).includes(source), source);
  }
  assert.equal(await page.evaluate(() => window.otherHelp), 0);
  await page.keyboard.press("F1");
  assert.equal(await page.getByRole("dialog").count(), 1);
  await page.keyboard.press("Escape");
  await dialog.waitFor({state: "hidden"});
});

test("A GM can open F1 from a chat input and return to the draft", async t => {
  const page = await openWorld(t, {gm: true});
  const chat = page.getByRole("textbox");
  await chat.fill("черновик");
  await page.keyboard.press("F1");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", {name: "Закрыть"}).click();
  assert.equal(await chat.inputValue(), "черновик");
  assert.ok(await chat.evaluate(el => el === document.activeElement));
});

test("A player can reassign the shortcut; F1 and modified F1 are left alone", async t => {
  const page = await openWorld(t, {remap: true});
  await page.keyboard.press("F1");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(await page.evaluate(() => window.otherHelp), 1);
  await page.getByRole("textbox").focus();
  await page.keyboard.press("F1");
  await page.keyboard.press("Shift+F1");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("textbox").evaluate(el => el.blur());
  await page.keyboard.press("F2");
  await page.getByRole("dialog").waitFor();
});

test("PDF ranges use the compendium's route and open their first physical page", async t => {
  const page = await openWorld(t, {pdf: true});
  await page.keyboard.press("F1");
  const source = page.getByRole("link", {name: "«Сила и судьба», с. 224–225"});
  await source.waitFor();
  assert.equal(await source.evaluate(el => el.href), "http://world.test/campaign/books/core.pdf#page=224");
  assert.equal(await source.getAttribute("target"), "_blank");
});

test("Physical page numbers remain readable with an unconfigured compendium", async t => {
  const page = await openWorld(t, {pdf: false});
  await page.keyboard.press("F1");
  await page.getByText("«Сила и судьба», с. 224–225", {exact: true}).waitFor();
  assert.equal(await page.getByRole("link").count(), 0);
});
