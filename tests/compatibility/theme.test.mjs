import assert from "node:assert/strict";
import test from "node:test";
import {applySystemTheme} from "../../modules/helpers/theme.js";

test("V14 theme selection preserves package layers and Russian override order", () => {
  const style = {textContent: '@import "systems/starwarsffg/styles/starwarsffg.css" layer(system);\n@import "systems/starwarsffg/styles/russian.css" layer(system);'};
  const documentRoot = {querySelectorAll: selector => selector === "style" ? [style] : []};
  applySystemTheme("mandar", documentRoot);
  assert.equal(style.textContent, '@import "systems/starwarsffg/styles/mandar.css" layer(system);\n@import "systems/starwarsffg/styles/russian.css" layer(system);');
  applySystemTheme("default", documentRoot);
  assert.match(style.textContent, /styles\/starwarsffg.css" layer\(system\)/);
  assert.doesNotMatch(style.textContent, /mandar/);
});

test("theme selection handles legacy links and preserves route prefixes", () => {
  const link = {href:"/vtt/systems/starwarsffg/styles/starwarsffg.css?v=123",getAttribute() {return this.href;},setAttribute(key,value) {this[key]=value;}};
  const documentRoot = {querySelectorAll: selector => selector === "style" ? [] : [link]};
  applySystemTheme("mandar", documentRoot);
  assert.equal(link.href,"/vtt/systems/starwarsffg/styles/mandar.css?v=123");
});
