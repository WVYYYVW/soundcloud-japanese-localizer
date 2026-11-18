// Chrome 系（Chrome / Edge / Brave など）と Firefox 向けのパッケージを作る。
// 使い方: node scripts/build.mjs
//   dist/chrome/ , dist/firefox/          … 「パッケージ化されていない拡張機能」として読み込めるフォルダ
//   dist/*-chrome.zip , dist/*-firefox.zip … ストア提出用 zip
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const dist = join(root, "dist");
const base = JSON.parse(readFileSync(join(src, "manifest.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

if (base.version !== pkg.version) {
  console.error(`バージョン不一致: manifest ${base.version} / package.json ${pkg.version}`);
  process.exit(1);
}

const targets = {
  chrome(m) {
    // Chrome はこのキーを認識せず警告を出すので削除する
    delete m.browser_specific_settings;
    return m;
  },
  firefox(m) {
    return m;
  },
};

rmSync(dist, { recursive: true, force: true });
for (const [name, transform] of Object.entries(targets)) {
  const out = join(dist, name);
  mkdirSync(out, { recursive: true });
  cpSync(src, out, { recursive: true, filter: (p) => !p.endsWith(".DS_Store") });
  const manifest = transform(structuredClone(base));
  writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const zip = join(dist, `soundcloud-japanese-localizer-${base.version}-${name}.zip`);
  try {
    execFileSync("zip", ["-qr", "-X", zip, "."], { cwd: out });
    console.log(`✓ ${name}: dist/${name}/ と ${zip.slice(root.length + 1)}`);
  } catch {
    console.log(`✓ ${name}: dist/${name}/（zip コマンドがないため zip は作成していません）`);
  }
}
