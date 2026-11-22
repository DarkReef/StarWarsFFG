import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import Handlebars from "handlebars";

const template = readFileSync(new URL("../../templates/parts/shared/ffg-tabs.html", import.meta.url), "utf8");
const handlebars = Handlebars.create();
handlebars.registerHelper({
  and: (a, b) => a && b,
  eq: (a, b) => a === b,
  contains: (text, fragment) => text.includes(fragment),
  localize: key => ({"SWFFG.TabGear": "Снаряжение", "SWFFG.TabCharacteristics": "Характеристики"})[key]
});
const render = handlebars.compile(template);

for (const cls of ["ActorSheetFFG", "ActorSheetFFGV2"]) {
  test(`${cls} renders an accessible equipment control without a browser destination`, () => {
    const html = render({playerCharacter: true, items: [
      {cls, tab: "characteristics", label: "SWFFG.TabCharacteristics", icon: "fas fa-user-circle"},
      {cls, tab: "items", label: "SWFFG.TabGear", icon: "fas fa-toolbox"}
    ]});
    // v14's global click listener opens any a[href], even when Tabs has prevented the default.
    assert.doesNotMatch(html, /\bhref\s*=/i);
    assert.deepEqual([...html.matchAll(/data-tab="([^"]+)"/g)].map(match => match[1]), ["characteristics", "items"]);
    const equipment = html.match(/<([\w-]+)\b([^>]*\bdata-tab="items"[^>]*)>([\s\S]*?)<\/\1>/);
    assert.ok(equipment, "equipment control");
    const [markup, tag, attributes, content] = equipment;
    if (tag === "button") assert.match(attributes, /\btype="button"/);
    else {
      assert.match(attributes, /\brole="(?:button|tab)"/);
      assert.match(attributes, /\btabindex="0"/);
    }
    assert.match(markup, /Снаряжение/);
    assert.equal((content.match(/<i\b/g) ?? []).length, cls.endsWith("V2") ? 1 : 0);
    if (cls.endsWith("V2")) assert.match(content, /\bfa-toolbox\b/);
  });
}
