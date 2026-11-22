import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { normalizeResultIcon, resultIconLabel, resultIconHTML, createResultIcon } from "../../modules/dice/result-icons.mjs";

const outcomes = {
  SU: "success", FA: "failure", AD: "advantage", TH: "threat", TR: "triumph", DE: "despair",
  LI: "light", DA: "dark", FP: "forcePoint",
};

test("an isolated icon has a translatable spoken name and Force points are distinct from pips", () => {
  assert.equal(resultIconLabel("[SU]"), "Success");
  assert.equal(resultIconLabel("[FP]"), "Force point");
  assert.equal(resultIconLabel("[FO]"), "");
  try {
    globalThis.game = { i18n: { lang: "ru", localize: key => key === "SWFFG.Success" ? "Успех" : key } };
    assert.equal(resultIconLabel("[SU]"), "Успех");
    assert.equal(resultIconLabel("[LI]"), "Светлая точка");
    assert.equal(resultIconLabel("[DA]"), "Тёмная точка");
    assert.equal(resultIconLabel("[FP]"), "Очко Силы");
  } finally {
    delete globalThis.game;
  }
});

test("shortcodes and named results have distinct, packaged vector assets", () => {
  const artwork = new Set();
  for (const [code, name] of Object.entries(outcomes)) {
    for (const key of [name, code, "[" + code.toLowerCase() + "]"]) {
      assert.equal(normalizeResultIcon(key), name);
    }
    const html = resultIconHTML(code);
    assert.match(html, new RegExp('data-ffg-symbol="' + name + '"'));
    assert.ok(html.includes('aria-hidden="true"'));
    const asset = html.match(/\bsrc="[^"]*\/(images\/result-icons\/[^"]+\.svg)"/)?.[1];
    assert.ok(asset, html);
    const svg = readFileSync(new URL("../../" + asset, import.meta.url), "utf8");
    assert.match(svg, /viewBox="0 0 24 24"/);
    assert.ok(!svg.includes("<text"));
    artwork.add(svg.replace(/<title>.*?<\/title>/g, ""));
  }
  assert.equal(artwork.size, Object.keys(outcomes).length);
});

test("unknown codes cannot turn into file paths and the Force die stays distinct", () => {
  for (const unknown of ["[FO]", "constructor", "__proto__", "x.svg", "<img>", "", undefined, null]) {
    assert.equal(normalizeResultIcon(unknown), null);
    assert.equal(resultIconHTML(unknown), "");
    assert.equal(createResultIcon(unknown), null);
  }
});

test("the named image is accessible and markup characters in its label remain text", () => {
  const attributes = new Map();
  const document = { createElement(tag) {
    assert.equal(tag, "img");
    return { setAttribute: (name, value) => attributes.set(name, value) };
  } };
  const label = 'Светлая точка "<&"';
  assert.ok(createResultIcon("[LI]", {label, document}));
  assert.equal(attributes.get("role"), "img");
  assert.equal(attributes.get("aria-label"), label);
  assert.equal(attributes.has("aria-hidden"), false);
  assert.match(resultIconHTML("[LI]", {label}), /&quot;&lt;&amp;&quot;/);
});
