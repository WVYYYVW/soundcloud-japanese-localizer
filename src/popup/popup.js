(function () {
  "use strict";
  const api = globalThis.browser ?? globalThis.chrome;
  const DEFAULTS = { enabled: true, logUntranslated: false };

  document.getElementById("version").textContent = api.runtime.getManifest().version;

  api.storage.local.get(DEFAULTS).then((settings) => {
    for (const key of Object.keys(DEFAULTS)) {
      const input = document.getElementById(key);
      input.checked = !!settings[key];
      input.addEventListener("change", () => {
        api.storage.local.set({ [key]: input.checked });
      });
    }
  });
})();
