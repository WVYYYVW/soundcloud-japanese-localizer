/*
 * 翻訳エンジン本体。DOM のテキストノードと一部の属性を辞書で置換する。
 * ブラウザ拡張の API には依存しないため、jsdom 上でもテストできる。
 */
(function (root) {
  "use strict";

  /** 翻訳対象にする属性 */
  const ATTRIBUTES = ["title", "aria-label", "placeholder", "data-title"];

  /** 中身を翻訳しない要素（入力欄・コード・ユーザー投稿のタイトルや本文など） */
  const EXCLUDE_SELECTOR = [
    "script",
    "style",
    "noscript",
    "textarea",
    "input",
    "code",
    "pre",
    "[contenteditable]",
    "[data-scja-skip]",
    // ユーザー名・トラック名・説明文・コメントなど、ユーザーが書いた文字列
    ".soundTitle__title",
    ".soundTitle__username",
    ".soundTitle__usernameText",
    ".soundTitle__tag",
    ".soundTitle__secondary",
    ".playbackSoundBadge__titleLink",
    ".playbackSoundBadge__lightLink",
    ".trackItem__trackTitle",
    ".trackItem__username",
    ".compactTrackListItem__trackTitle",
    ".compactTrackListItem__user",
    ".chartTrack__title",
    ".chartTrack__username",
    ".soundBadge__title",
    ".soundBadge__username",
    ".userBadge__usernameLink",
    ".userBadge__username",
    ".userItem__title",
    ".userItem__username",
    ".profileHeaderInfo__userName",
    ".profileHeaderInfo__additional",
    ".truncatedUserDescription",
    ".truncatedAudioInfo",
    ".listenInfo__description",
    ".listenDetails__description",
    ".commentItem__body",
    ".commentItem__usernameLink",
    ".commentPopover",
    ".waveformCommentsNode",
    ".sc-tagContent",
    ".playlistTitle",
    ".fullHero__title",
    ".fullHero__uploader",
    ".playableTile__descriptionContainer",
    ".playableTile__usernameHeadingContainer",
    ".playableTile__mainHeading",
    ".playableTile__heading",
    ".userBadgeListItem__title",
    ".userItem__details",
    ".searchTags__locations",
    ".web-profiles",
    ".userDropbar__title",
    ".soundBadge__content .soundTitle__title",
    // サードパーティの Cookie 同意画面（法的文言なので原文のまま）
    "#onetrust-consent-sdk",
  ].join(",");

  /** 子要素の文字は訳すが、要素自身の属性（title など）にユーザー投稿の文字列が入る要素 */
  const ATTR_EXCLUDE_SELECTOR = [
    ".soundTitle",
    ".sc-artwork",
    ".playableTile__artworkLink",
    ".soundTitle__title",
  ].join(",");

  /** 未翻訳ログに出す候補：英字を含む短い文字列だけ */
  const LOGGABLE = /^(?=.*[A-Za-z]{2})[\x20-\x7E\u2018-\u201D]{2,300}$/;

  function createTranslator(options) {
    const { dictionary, onUntranslated } = options;
    const exact = new Map(Object.entries(dictionary.EXACT));
    const patterns = dictionary.PATTERNS;
    /** 文脈辞書: [セレクター, Map] の配列。該当要素の内側では通常の辞書より優先する */
    const contexts = (dictionary.CONTEXT || []).map(([sel, map]) => [sel, new Map(Object.entries(map))]);

    /** テキストノード → 元の文字列 / 翻訳後の文字列 */
    const originalText = new WeakMap();
    const translatedText = new WeakMap();
    /** 要素 → { 属性名: 元の値 } */
    const originalAttrs = new WeakMap();

    let enabled = true;
    let reportUntranslated = false;
    const reported = new Set();

    /** 文字列を訳す。訳がなければ null を返す。 */
    function translateString(raw, contextEl) {
      if (!raw) return null;
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const collapsed = trimmed.replace(/\s+/g, " ");

      let result;
      if (contextEl && contexts.length) {
        for (const [sel, map] of contexts) {
          if (map.has(collapsed) && contextEl.closest(sel)) {
            result = map.get(collapsed);
            break;
          }
        }
      }
      if (result === undefined) result = exact.get(collapsed);
      if (result === undefined) {
        for (const [re, rep] of patterns) {
          if (re.test(collapsed)) {
            result = collapsed.replace(re, rep);
            break;
          }
        }
      }
      if (result === undefined || result === null) {
        if (reportUntranslated && LOGGABLE.test(collapsed) && !reported.has(collapsed)) {
          reported.add(collapsed);
          if (onUntranslated) onUntranslated(collapsed);
        }
        return null;
      }
      if (result === collapsed) return null;

      // 元の前後の空白を保つ
      const lead = raw.match(/^\s*/)[0];
      const trail = raw.match(/\s*$/)[0];
      return lead + result + trail;
    }

    function isExcluded(el) {
      return !!(el && el.closest && el.closest(EXCLUDE_SELECTOR));
    }

    function translateTextNode(node) {
      const value = node.nodeValue;
      // 自分が書き込んだ値ならスキップ（MutationObserver のループ防止）
      if (translatedText.get(node) === value) return;
      if (isExcluded(node.parentElement)) return;
      const t = translateString(value, node.parentElement);
      if (t === null) return;
      originalText.set(node, value);
      translatedText.set(node, t);
      node.nodeValue = t;
    }

    function translateAttributes(el) {
      // 入力欄は中身（ユーザーの入力）は触らないが、placeholder などの属性は訳す
      const isField = el.tagName === "INPUT" || el.tagName === "TEXTAREA";
      if (isExcluded(isField ? el.parentElement : el) || el.matches(ATTR_EXCLUDE_SELECTOR)) return;
      for (const name of ATTRIBUTES) {
        const value = el.getAttribute(name);
        if (!value) continue;
        const saved = originalAttrs.get(el);
        if (saved && saved[name] && saved[name].translated === value) continue;
        const t = translateString(value, el);
        if (t === null) continue;
        const entry = saved || {};
        entry[name] = { original: value, translated: t };
        originalAttrs.set(el, entry);
        el.setAttribute(name, t);
      }
    }

    /** node 以下をまとめて翻訳する */
    function translateTree(node) {
      if (!enabled || !node) return;
      if (node.nodeType === 3) {
        translateTextNode(node);
        return;
      }
      if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;

      const doc = node.ownerDocument || node;
      if (node.nodeType === 1) {
        if (isExcluded(node)) return;
        translateAttributes(node);
      }

      const walker = doc.createTreeWalker(node, 1 | 4 /* ELEMENT | TEXT */, {
        acceptNode(n) {
          if (n.nodeType === 1 && n.matches(EXCLUDE_SELECTOR)) {
            if (n.tagName === "INPUT" || n.tagName === "TEXTAREA") translateAttributes(n);
            return 2; // REJECT（子孫ごと除外）
          }
          return 1; // ACCEPT
        },
      });
      let n;
      while ((n = walker.nextNode())) {
        if (n.nodeType === 3) translateTextNode(n);
        else translateAttributes(n);
      }
    }

    function translateTitle(doc) {
      if (!enabled) return;
      const t = translateString(doc.title);
      if (t !== null) doc.title = t;
    }

    /** 翻訳をすべて元に戻す */
    function revertTree(rootNode) {
      const doc = rootNode.ownerDocument || rootNode;
      const walker = doc.createTreeWalker(rootNode, 1 | 4);
      let n;
      while ((n = walker.nextNode())) {
        if (n.nodeType === 3) {
          const orig = originalText.get(n);
          if (orig !== undefined && translatedText.get(n) === n.nodeValue) {
            n.nodeValue = orig;
          }
          originalText.delete(n);
          translatedText.delete(n);
        } else {
          const saved = originalAttrs.get(n);
          if (!saved) continue;
          for (const name of Object.keys(saved)) {
            if (n.getAttribute(name) === saved[name].translated) {
              n.setAttribute(name, saved[name].original);
            }
          }
          originalAttrs.delete(n);
        }
      }
    }

    function handleMutations(mutations) {
      if (!enabled) return;
      for (const m of mutations) {
        if (m.type === "childList") {
          for (const added of m.addedNodes) translateTree(added);
        } else if (m.type === "characterData") {
          translateTextNode(m.target);
        } else if (m.type === "attributes") {
          translateAttributes(m.target);
        }
      }
    }

    return {
      translateString,
      translateTree,
      translateTitle,
      revertTree,
      handleMutations,
      setEnabled(v) {
        enabled = !!v;
      },
      isEnabled() {
        return enabled;
      },
      setReportUntranslated(v) {
        reportUntranslated = !!v;
        if (v) reported.clear();
      },
    };
  }

  root.SCJA_createTranslator = createTranslator;
  root.SCJA_TRANSLATED_ATTRIBUTES = ATTRIBUTES;
  root.SCJA_EXCLUDE_SELECTOR = EXCLUDE_SELECTOR;
})(typeof globalThis !== "undefined" ? globalThis : this);
