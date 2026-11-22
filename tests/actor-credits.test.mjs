import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

function blocksBoundTo(sheetType, path) {
  const sheet = new URL(`../templates/actors/ffg-${sheetType}-sheet.html`, import.meta.url);
  const template = readFileSync(sheet, "utf8");
  return Array.from(template.matchAll(/\{\{>[^}]+\}\}/g), match => match[0])
    .filter(block => block.includes(`name="${path}"`));
}

test("the minion group has one numeric credits control bound to its shared balance", () => {
  const [wallet, ...duplicates] = blocksBoundTo("minion", "data.stats.credits.value");
  assert.ok(wallet, "The minion wallet control is missing");
  assert.deepEqual(duplicates, []);
  assert.match(wallet, /title="SWFFG\.DescriptionCredits"/);
  assert.match(wallet, /type="Number"/);
  assert.match(wallet, /value=data\.stats\.credits\.value\b/);
});

test("automatic soak calculation locks only the adversary's soak control", () => {
  const [soak] = blocksBoundTo("adversary", "data.stats.soak.value");
  const [wallet] = blocksBoundTo("adversary", "data.stats.credits.value");
  assert.match(soak, /disabled=this\.settings\.enableSoakCalculation/);
  assert.doesNotMatch(wallet, /enableSoakCalculation/);
});
