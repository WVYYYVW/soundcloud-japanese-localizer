/*
 * コンテンツスクリプトの起動処理。
 * 設定（有効/無効、未翻訳ログ）を読み込み、DOM の変化を監視して翻訳し続ける。
 */
(function () {
  "use strict";

  const api = globalThis.browser ?? globalThis.chrome;
  const DEFAULTS = { enabled: true, logUntranslated: false };

  const translator = globalThis.SCJA_createTranslator({
    dictionary: globalThis.SCJA_DICTIONARY,
    onUntranslated(text) {
      console.info("[SoundCloud 日本語化] 未翻訳:", JSON.stringify(text));
    },
  });

  let observer = null;
  let titleObserver = null;

  // MutationObserver の通知をまとめて処理する（大量の DOM 更新時の負荷対策）
  let pending = [];
  let scheduled = false;
  function onMutations(mutations) {
    pending.push(...mutations);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      const batch = pending;
      pending = [];
      scheduled = false;
      translator.handleMutations(batch);
    });
  }

  function start() {
    if (observer || !document.body) return;
    document.documentElement.setAttribute("data-scja", "on");
    translator.setEnabled(true);
    translator.translateTree(document.body);
    translator.translateTitle(document);

    observer = new MutationObserver(onMutations);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: globalThis.SCJA_TRANSLATED_ATTRIBUTES,
    });

    const titleEl = document.querySelector("head > title");
    if (titleEl) {
      titleObserver = new MutationObserver(() => translator.translateTitle(document));
      titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
  }

  function stop() {
    if (observer) observer.disconnect();
    if (titleObserver) titleObserver.disconnect();
    observer = titleObserver = null;
    pending = [];
    translator.setEnabled(false);
    translator.revertTree(document.body);
    document.documentElement.removeAttribute("data-scja");
  }

  function apply(settings) {
    translator.setReportUntranslated(settings.logUntranslated);
    if (settings.enabled) start();
    else stop();
    if (settings.logUntranslated && settings.enabled) {
      // 既に表示されている文言も一度ログに出す
      translator.translateTree(document.body);
    }
  }

  async function init() {
    let settings = DEFAULTS;
    try {
      settings = { ...DEFAULTS, ...(await api.storage.local.get(DEFAULTS)) };
    } catch (e) {
      // storage が使えない環境でも翻訳だけは動かす
    }
    apply(settings);

    api.storage.onChanged.addListener(async (changes, area) => {
      if (area !== "local") return;
      if (!("enabled" in changes) && !("logUntranslated" in changes)) return;
      const next = { ...DEFAULTS, ...(await api.storage.local.get(DEFAULTS)) };
      apply(next);
    });
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init, { once: true });
})();
