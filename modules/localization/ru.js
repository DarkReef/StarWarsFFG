// System strings load before module translations. Older ru-ru dictionaries contain
// English fallbacks for StarWarsFFG, so restore this fork's complete dictionary
// after localization initialization without changing core or other-system strings.
const response = await fetch(new URL("../../lang/ru.json", import.meta.url));
const russian = response.ok ? await response.json() : {};

Hooks.once("i18nInit", () => {
  if (game.i18n.lang.split("-")[0] !== "ru") return;
  foundry.utils.mergeObject(game.i18n.translations, foundry.utils.expandObject(russian));
  document.documentElement.dataset.ffgLanguage = "ru";
});
