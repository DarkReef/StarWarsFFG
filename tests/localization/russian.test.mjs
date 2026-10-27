import assert from "node:assert/strict";
import {readFileSync, readdirSync, existsSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import Handlebars from "handlebars";

const root = new URL("../../", import.meta.url);
const read = file => readFileSync(new URL(file, root), "utf8");
const en = JSON.parse(read("lang/en.json"));
const ru = JSON.parse(read("lang/ru.json"));
function files(folder, extension) {
  return readdirSync(new URL(folder, root), {withFileTypes: true}).flatMap(entry => {
    const file = `${folder}/${entry.name}`;
    return entry.isDirectory() ? files(file, extension) : file.endsWith(extension) ? [file] : [];
  });
}

test("Russian dictionary covers every English key and preserves substitutions", () => {
  assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
  const tokens = value => (value.match(/\{[\w]+\}|\[(?:SU|AD|TR|FA|TH|DE|FO|PR|AB|BO|SE|DI|CH)\]/g) ?? []).sort();
  for (const [key, english] of Object.entries(en)) {
    assert.match(ru[key], /[А-Яа-яЁё]/, `${key} has no Russian text`);
    assert.deepEqual(tokens(ru[key]), tokens(english), `${key} changed substitution tokens`);
    assert.ok(!ru[key].includes("\uFFFD"), `${key} has a broken Unicode character`);
  }
});

test("all UI templates compile and static system localization references resolve", () => {
  for (const file of files("templates", ".html")) {
    assert.doesNotThrow(() => Handlebars.precompile(read(file)), file);
  }
  for (const file of [...files("templates", ".html"), ...files("modules", ".js")]) {
    for (const [, key] of read(file).matchAll(/["'](SWFFG\.[\w.]+)["']/g)) {
      assert.ok(key in ru, `${file} references missing key ${key}`);
    }
  }
});

test("wizard renders selected documents without translating stored data paths", () => {
  const handlebars = Handlebars.create();
  handlebars.registerHelper("localize", key => ru[key] ?? key);
  const render = handlebars.compile(read("templates/wizards/char_creator/header.html"));
  const html = render({data: {selected: {species: {name: "Тестовый вид"}, career: {name: "Тестовая карьера"}}}});
  assert.match(html, /Тестовый вид/);
  assert.match(html, /Тестовая карьера/);
  assert.match(html, /Специализация не выбрана/);
  assert.doesNotMatch(html, /No Species|No Career|Credits:/);
});

test("manifest contains the Russian assets and all shipped entrypoints exist", () => {
  const manifest = JSON.parse(read("system.json"));
  assert.equal(manifest.id, "starwarsffg");
  assert.equal(manifest.compatibility.maximum, "14");
  assert.ok(manifest.languages.some(language => language.lang === "ru" && language.path === "lang/ru.json"));
  for (const file of [...manifest.esmodules, ...manifest.scripts, ...manifest.styles, ...manifest.languages.map(l => l.path)]) {
    assert.ok(existsSync(new URL(file, root)), `${file} is missing`);
    assert.ok(!path.isAbsolute(file), `${file} must be relative`);
  }
});
