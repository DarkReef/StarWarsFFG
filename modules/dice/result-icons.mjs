// Result shortcodes are distinct from die-type codes, including [FO] for the Force die.
const aliases = new Map();
for (const [key, codes] of [
  ["success", ["SU"]], ["failure", ["FA"]], ["advantage", ["AD"]],
  ["threat", ["TH"]], ["triumph", ["TR"]], ["despair", ["DE"]],
  ["light", ["LI", "LS"]], ["dark", ["DA", "DS"]], ["forcePoint", ["FP"]],
]) {
  for (const token of [key, ...codes]) aliases.set(token.toLowerCase(), key);
}

export function normalizeResultIcon(value) {
  if (typeof value !== "string") return null;
  const token = value.trim();
  const bare = token.startsWith("[") && token.endsWith("]") ? token.slice(1, -1) : token;
  return aliases.get(bare.toLowerCase()) ?? null;
}

// Standalone notation needs a spoken name. The sheet's Light/Dark labels are
// adjectives in Russian; the rules name each result as a point on a die.
const labels = {
  success: ["SWFFG.Success", "Success", "Успех"],
  failure: ["SWFFG.Failure", "Failure", "Неудача"],
  advantage: ["SWFFG.Advantage", "Advantage", "Преимущество"],
  threat: ["SWFFG.Threat", "Threat", "Угроза"],
  triumph: ["SWFFG.Triumph", "Triumph", "Триумф"],
  despair: ["SWFFG.Despair", "Despair", "Отчаяние"],
  light: ["SWFFG.Lightside", "Light side point", "Светлая точка"],
  dark: ["SWFFG.Darkside", "Dark side point", "Тёмная точка"],
  forcePoint: ["SWFFG.ForcePoint", "Force point", "Очко Силы"],
};

export function resultIconLabel(value) {
  const key = normalizeResultIcon(value);
  if (!key) return "";
  const [token, english, russian] = labels[key];
  const i18n = globalThis.game?.i18n;
  if (i18n?.lang?.toLowerCase().split("-")[0] === "ru") return russian;
  const translated = i18n?.localize?.(token);
  return translated && translated !== token ? translated : english;
}

function iconAttributes(value, label) {
  const key = normalizeResultIcon(value);
  if (!key) return null;
  const fileName = key === "forcePoint" ? "force-point" : key;
  const path = "systems/starwarsffg/images/result-icons/" + fileName + ".svg";
  const accessible = typeof label === "string" && label.trim();
  return {
    class: "ffg-result-icon",
    "data-ffg-symbol": key,
    src: globalThis.foundry?.utils?.getRoute?.(path) ?? path,
    width: "16", height: "16",
    alt: accessible ? label : "",
    ...(accessible ? { role: "img", "aria-label": label } : { "aria-hidden": "true" }),
  };
}

export function createResultIcon(value, { label, document = globalThis.document } = {}) {
  const attributes = iconAttributes(value, label);
  if (!attributes) return null;
  const image = document.createElement("img");
  for (const [key, val] of Object.entries(attributes)) image.setAttribute(key, val);
  return image;
}

function escapeAttribute(text) {
  return text.replaceAll("&", "&amp;").replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// Chat content can be serialized before a document exists.
export function resultIconHTML(value, { label } = {}) {
  const attributes = iconAttributes(value, label);
  if (!attributes) return "";
  const pairs = Object.entries(attributes).map(([key, val]) => key + '="' + escapeAttribute(val) + '"');
  return "<img " + pairs.join(" ") + ">";
}
