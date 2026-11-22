// In a Foundry v14 world with the source checkout installed, run
// await (await import("/systems/starwarsffg/tests/chat-render.e2e.mjs")).verifyChatRender()
// The detached fixture writes nothing to the world.
export async function verifyChatRender(enrich) {
  if (!enrich) {
    const { default: Editor } = await import("../modules/popout-editor.js");
    enrich = element => Editor.renderChatDiceImages(element);
  }
  const content = document.createElement("div");
  content.innerHTML = '<article><button title="[SU]">Бросок</button><p>Результат: [SU] :boost:</p><p>[ROLL]Perception, 2[/ROLL]</p><p>&lt;i&gt; [AD]</p><code>[DI]</code></article>';
  const original = content.querySelector("article");
  const button = original.querySelector("button");
  let clicks = 0;
  button.addEventListener("click", () => clicks++);
  const update = enrich(content);
  button.dataset.requestId = "a1";
  await update;
  const first = content.querySelector(".dietype.success");
  await enrich(content);
  content.querySelector("button").click();
  const checks = {
    sameCard: content.firstElementChild === original,
    sameButton: content.querySelector("button") === button,
    click: clicks === 1,
    concurrentUpdate: content.querySelector("button").dataset.requestId === "a1",
    attributesUntouched: content.querySelector("button").title === "[SU]",
    icons: Boolean(first && content.querySelector(".dietype.boost")),
    stableIcon: content.querySelector(".dietype.success") === first,
    roll: content.querySelector(".rollSkillDirect")?.dataset.skill === "Perception",
    escapedText: content.querySelectorAll("p")[2].textContent.includes("<i>") && !content.querySelector("i"),
    code: content.querySelector("code").textContent === "[DI]"
  };
  const failed = Object.keys(checks).filter(key => !checks[key]);
  if (failed.length) throw new Error("Chat card regression: " + failed.join(", "));
  return checks;
}
