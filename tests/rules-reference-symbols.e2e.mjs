// Run in a connected Foundry v14 client:
// await (await import("/systems/starwarsffg/tests/rules-reference-symbols.e2e.mjs")).verifyReferenceSymbols()
export function verifyReferenceSymbols() {
  const selector = "#starwarsffg-rules-reference";
  const wasOpen = !!document.querySelector(selector)?.open;
  if (!wasOpen) {
    for (const type of ["keydown", "keyup"]) {
      document.activeElement.dispatchEvent(new KeyboardEvent(type, {key: "F1", code: "F1", bubbles: true, cancelable: true}));
    }
  }
  const dialog = document.querySelector(selector);
  if (!dialog?.open) throw new Error("F1 did not open the system reference");
  const originalTab = dialog.querySelector('nav [aria-pressed="true"]');
  const originalFocus = document.activeElement;
  const expected = [
    ["Расход символов", [
      ["1 Преимущество", "advantage"], ["2 Преимущества", "advantage"], ["3 Преимущества", "advantage"],
      ["1 Триумф", "triumph"], ["1 Угроза", "threat"], ["2 Угрозы", "threat"],
      ["3 Угрозы", "threat"], ["1 Отчаяние", "despair"]
    ]],
    ["Проверки", [
      ["Успех и Неудача", "success", "failure"], ["Преимущество и Угроза", "advantage", "threat"],
      ["Триумф и Отчаяние", "triumph", "despair"]
    ]],
    ["Сила и Судьба", [["Светлая и тёмная стороны", "light", "dark"]]]
  ];
  let labels = 0;
  let icons = 0;
  try {
    for (const [name, terms] of expected) {
      const tab = Array.from(dialog.querySelectorAll("nav button")).find(button => button.textContent === name);
      if (!tab) throw new Error("Missing section: " + name);
      tab.click();
      for (const [label, ...symbols] of terms) {
        const term = Array.from(dialog.querySelectorAll("dt")).find(row => row.innerText === label);
        if (!term) throw new Error("Missing visible label: " + label);
        const rendered = Array.from(term.querySelectorAll("[data-ffg-symbol]"));
        if (rendered.length !== symbols.length || !rendered.every((icon, index) =>
          icon.dataset.ffgSymbol === symbols[index] && icon.getAttribute("aria-hidden") === "true"
          && icon.getBoundingClientRect().width > 0)) throw new Error("Incorrect result icons: " + label);
        labels++;
        icons += rendered.length;
      }
    }
    return {labels, icons};
  } finally {
    if (wasOpen) {
      originalTab?.click();
      originalFocus?.focus();
    } else {
      dialog.close();
    }
  }
}
