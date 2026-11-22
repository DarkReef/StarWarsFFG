import { resultIconHTML, resultIconLabel } from "./dice/result-icons.mjs";
import { resultTokens } from "./helpers/journal.js";
import {migrateDataToSystem} from "./helpers/migration.js";

/**
 * A specialized form used to pop out the editor.
 * @extends {FormApplication}
 */
export default class PopoutEditor extends FormApplication {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "popout-editor",
      classes: ["starwarsffg", "sheet"],
      title: "Pop-out Editor",
      template: "systems/starwarsffg/templates/popout-editor.html",
      width: 320,
      height: 320,
      resizable:true,
    });
  }

  /**
   * Return a reference to the target attribute
   * @type {String}
   */
  get attribute() {
    return this.options.name;
  }

  /** @override */
  getData() {
    // Get current value
    let attr = foundry.utils.getProperty(this.object.system, this.attribute.replace('data.', ''));

    // Return data
    return {
      value: attr,
      cssClass: "editable popout-editor-window",
    };
  }

  /* -------------------------------------------- */

  /** @override */
  _updateObject(event, formData) {
    const updateData = {};
    updateData[`${this.attribute}`] = formData.value;

    // Update the object
    this.object.update(
        migrateDataToSystem(updateData)
    );

    this.close();
  }

  /**
   * Renders the dice symbols based on strings
   * @param  {String} string
   */
  static async renderDiceImages(str, actorData) {
    const content = document.createElement("div");
    content.innerHTML = str || "";
    this.renderChatDiceImages(content, actorData);
    const html = content.innerHTML;
    try {
      return await foundry.applications.ux.TextEditor.implementation.enrichHTML(html, { secrets: true, documents: true, async: false });
    } catch (err) {
      // ignore the message below, it means that we already created an entity link (this could be part of an editor text)
      if (err.message !== "An Entity subclass must configure the EntityCollection it belongs to.") {
        CONFIG.logger.error(err);
      }
    }

    return html;
  }

  /**
   * ChatMessage has already enriched and permission-filtered the content.
   * Other render hooks may have bound listeners to nodes in the same card.
   */
  static renderChatDiceImages(content, actorData) {
    const doc = content.ownerDocument;
    const walker = doc.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    const candidates = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!/\[[\w/]+\]|:\w+(?:-\d)?:/.test(node.data)) continue;
      if (node.parentElement.closest("code, pre, script, style, textarea, [contenteditable=true], .dietype, [data-ffg-symbol], .content-link, .inline-roll, .rollSkillDirect")) continue;
      candidates.push(node);
    }
    for (const node of candidates) {
      // A chat message can contain literal markup. Keep it text, including
      // quotes if a roll tag interpolates its skill name into an attribute.
      const escaped = node.data.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
      const rendered = this.replaceDiceSymbols(this.replaceRollTags(escaped, actorData));
      if (rendered === escaped) continue;
      const template = doc.createElement("template");
      template.innerHTML = rendered;
      node.replaceWith(template.content);
    }
  }

  static replaceDiceSymbols(html) {
    const dicetheme = game.settings.get("starwarsffg", "dicetheme");

    const replaceValues = [
      {
        type: "ability",
        character: "d",
        class: "starwars",
        pattern: /:(ability):|\[(AB)(ILITY)?\]/gim,
      },
      {
        type: "difficulty",
        character: "di",
        class: "starwars",
        pattern: /:(average):/gim,
      },
      {
        type: "boost",
        character: "b",
        class: "starwars",
        pattern: /:(boost):|\[(BO)(OST)?\]/gim,
      },
      {
        type: "challenge",
        character: "c",
        class: "starwars",
        pattern: /:(challenge):|\[(CH)(ALLENGE)?\]/gim,
      },
      {
        type: "difficulty",
        character: "dddd",
        class: "starwars",
        pattern: /:(daunting):/gim,
      },
      {
        type: "difficulty",
        character: "d",
        class: "starwars",
        pattern: /:(difficulty):|\[(DI)(FFICULTY)?\]/gim,
      },
      {
        type: "difficulty",
        character: "d",
        class: "starwars",
        pattern: /:(easy):/gim,
      },
      {
        type: "challenge",
        character: "c",
        class: "starwars",
        pattern: /:(easy-1):/gim,
      },
      {
        type: "difficulty",
        character: "ddddd",
        class: "starwars",
        pattern: /:(formidable):/gim,
      },
      {
        type: "force",
        character: "C",
        class: "starwars",
        pattern: /:(force):|\[(FO)(RCE)?\]/gim,
      },
      {
        type: "difficulty",
        character: "ddd",
        class: "starwars",
        pattern: /:(hard):/gim,
      },
      {
        type: "proficiency",
        character: "c",
        class: "starwars",
        pattern: /:(proficiency):|\[(PR)(OFICIENCY)?\]/gim,
      },
      {
        type: "remsetback",
        character: "b",
        class: "starwars",
        pattern: /\[(RS*|REMSETBACK)\]/gim,
      },
      {
        type: "restricted",
        character: "z",
        class: "starwars",
        pattern: /\[(RE)(STRICTED)?\]/gim,
      },
      {
        type: "setback",
        character: "b",
        class: "starwars",
        pattern: /:(setback):|\[(SE)(TBACK)?\]/gim,
      },
      {
        type: "adddifficulty",
        character: "d",
        class: "starwars",
        pattern: /\[(DD|ADDDIFFICULTY)\]/gim,
      },
      {
        type: "updifficulty",
        character: "d",
        class: "starwars",
        pattern: /\[(UD|UPDIFFICULTY)\]/gim,
      },
      {
        type: "cancelthreat",
        character: "t",
        class: dicetheme,
        pattern: /\[(CT|CANCELTHREAT)\]/gim,
      },
    ];

    for (const [key, pattern] of Object.entries(resultTokens)) {
      html = html.replace(pattern, () => resultIconHTML(key, {label: resultIconLabel(key)}));
    }
    replaceValues.forEach((item) => {
      html = html.toString().replace(item.pattern, `<span class='dietype ${item.class} ${item.type}'>${item.character}</span>`);
    });

    const regex = /:(average|hard|daunting|formidable)-(\d):/gim;
    let m;
    while ((m = regex.exec(html)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      let symbolCount = 0;
      let replaceString = "";

      switch (m[1]) {
        case "average": {
          symbolCount = 2;
          break;
        }
        case "hard": {
          symbolCount = 3;
          break;
        }
        case "daunting": {
          symbolCount = 4;
          break;
        }
        case "formidable": {
          symbolCount = 5;
          break;
        }
      }

      for (let i = 0; i < symbolCount; i += 1) {
        if (i + 1 <= parseInt(m[2], 10)) {
          replaceString += `<span class='dietype starwars challenge'>c</span>`;
        } else {
          replaceString += `<span class='dietype starwars difficulty'>d</span>`;
        }
      }

      html = html.toString().replace(m[0], replaceString);
    }

    const oggdudeTags = [
      {
        startTag: "<span class='bold'>",
        endTag: "</span>",
        pattern: /(\[B\])(.[^\[]*)\[b\]/gm,
      },
      {
        startTag: "<p>",
        endTag: "</p>",
        pattern: /(\[P\])(.[^\[]*)/gm,
      },
      {
        startTag: "<br />",
        endTag: "",
        pattern: /(\[BR\])(.[^\[]*)/gm,
      },
      {
        startTag: "<span class='italic'>",
        endTag: "</span>",
        pattern: /(\[I\])(.[^\[]*)\[i\]/gm,
      },
      {
        startTag: "<h1>",
        endTag: "</h1>",
        pattern: /(\[H1\])(.[^\[]*)\[h1\]/gm,
      },
      {
        startTag: "<h2>",
        endTag: "</h2>",
        pattern: /(\[H2\])(.[^\[]*)\[h2\]/gm,
      },
      {
        startTag: "<h3>",
        endTag: "</h3>",
        pattern: /(\[H3\])(.[^\[]*)\[h3\]/gm,
      },
      {
        startTag: "<h4>",
        endTag: "</h4>",
        pattern: /(\[H4\])(.[^\[]*)\[h4\]/gm,
      },
    ];

    oggdudeTags.forEach((item) => {
      html = html.toString().replace(item.pattern, `${item.startTag}$2${item.endTag}`);
    });

    return html;
  }

  static replaceRollTags(html, actorData) {
    const rollTag = /(\[ROLL\])(.[^\[]*)\[\/ROLL\]/gm;
    const formula = html.toString().replace(rollTag, function (content) {
      content = content.replace(rollTag, `$2`);
      const args = content.split(",").map(function (arg) {
        return arg.trim();
      });
      if (!args[0] || !/^[0-5]$/.test(args[1] ?? "")) return `[ROLL]${content}[/ROLL]`;
      const di = "[DI]";
      let difficulty = "";
      switch (args[1]) {
        case "0":
          difficulty = "Simple";
          break;
        case "1":
          difficulty = "Easy";
          break;
        case "2":
          difficulty = "Average";
          break;
        case "3":
          difficulty = "Hard";
          break;
        case "4":
          difficulty = "Daunting";
          break;
        case "5":
          difficulty = "Formidable";
          break;
      }
      const id = actorData?._id ? actorData._id : "";

      let formula = `<span class="rollable rollSkillDirect" data-skill="${args[0]}" data-difficulty="${args[1]}" data-actor-id="${id}"><strong>${difficulty} (${di.repeat(args[1])}) ${args[0]}</strong></span>`;
      return formula;
    });

    return formula;
  }
}
