/** Replace the system theme in Foundry's existing stylesheet declarations.
 * V14 wraps package styles in @import ... layer(system); adding an unlayered
 * link bypasses that cascade and makes the theme override every module/style.
 */
export function applySystemTheme(theme, documentRoot = document) {
  const selected = theme === "mandar" ? "mandar" : "starwarsffg";
  const pattern = /systems\/starwarsffg\/styles\/(?:starwarsffg|mandar)\.css/g;
  const replacement = `systems/starwarsffg/styles/${selected}.css`;
  for (const style of documentRoot.querySelectorAll("style")) {
    const updated = style.textContent.replace(pattern, replacement);
    if (updated !== style.textContent) style.textContent = updated;
  }
  // Older Foundry versions use ordinary links rather than layered imports.
  for (const link of documentRoot.querySelectorAll('link[rel="stylesheet"]')) {
    const href = link.getAttribute("href") ?? "";
    const updated = href.replace(pattern, replacement);
    if (updated !== href) link.setAttribute("href", updated);
  }
}
