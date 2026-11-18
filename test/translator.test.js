// 翻訳エンジンのテスト（jsdom 上で実行）。実行: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const load = (p) => readFileSync(new URL(`../src/content/${p}`, import.meta.url), "utf8");

function setup(html) {
  const dom = new JSDOM(`<!doctype html><html><head><title>Stream on SoundCloud</title></head><body>${html}</body></html>`, {
    runScripts: "outside-only",
  });
  const w = dom.window;
  w.eval(load("dictionary.js"));
  w.eval(load("translator.js"));
  const logged = [];
  const tr = w.SCJA_createTranslator({ dictionary: w.SCJA_DICTIONARY, onUntranslated: (s) => logged.push(s) });
  return { w, doc: w.document, tr, logged };
}

test("完全一致の文言を訳し、前後の空白を保つ", () => {
  const { doc, tr } = setup(`<button> Follow </button><a>Library</a>`);
  tr.translateTree(doc.body);
  assert.equal(doc.querySelector("button").textContent, " フォロー ");
  assert.equal(doc.querySelector("a").textContent, "ライブラリ");
});

test("属性（title / aria-label / placeholder）を訳す", () => {
  const { doc, tr } = setup(`<button title="Like" aria-label="Repost"></button><input placeholder="Search">`);
  tr.translateTree(doc.body);
  assert.equal(doc.querySelector("button").title, "いいね");
  assert.equal(doc.querySelector("button").getAttribute("aria-label"), "リポスト");
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "検索");
});

test("入力欄: placeholder は訳し、入力内容は訳さない", () => {
  const { doc, tr } = setup(`<textarea placeholder="Write a comment">Like</textarea><div class="commentItem__body"><input placeholder="Search"></div>`);
  tr.translateTree(doc.body);
  assert.equal(doc.querySelector("textarea").placeholder, "コメントを書く");
  assert.equal(doc.querySelector("textarea").value, "Like");
  assert.equal(doc.querySelector(".commentItem__body input").placeholder, "Search");
});

test("ユーザー投稿の領域（トラック名など）は訳さない", () => {
  const { doc, tr } = setup(`
    <div class="soundTitle__title"><span>Like</span></div>
    <div class="commentItem__body">Follow</div>
    <div class="soundTitle" title="Home"><span>Repost</span></div>`);
  tr.translateTree(doc.body);
  assert.equal(doc.querySelector(".soundTitle__title span").textContent, "Like");
  assert.equal(doc.querySelector(".commentItem__body").textContent, "Follow");
  // .soundTitle は属性だけ除外し、子要素の UI 文言は訳す
  assert.equal(doc.querySelector(".soundTitle").title, "Home");
  assert.equal(doc.querySelector(".soundTitle span").textContent, "リポスト");
});

test("数字・日付を含む文言をパターンで訳す", () => {
  const { tr } = setup("");
  const cases = {
    "3 days ago": "3日前",
    "1 year ago": "1年前",
    "1,234 plays": "再生回数 1,234",
    "12.5K followers": "フォロワー 12.5K",
    "500+ tracks": "500+曲",
    "Found 500+ people": "500+ 件見つかりました",
    "Posted on 14 September 2017": "2017年9月14日に投稿",
    "Updated 11 years ago": "11年前に更新",
    "22 September 2007": "2007年9月22日",
    "Following 1,254 people": "1,254人をフォロー中",
    "Follow Forss": "Forss をフォロー",
    "Track: Flickermood by Forss": "トラック: Flickermood（Forss）",
    "Play from 0:54": "0:54 から再生",
  };
  for (const [src, want] of Object.entries(cases)) assert.equal(tr.translateString(src), want, src);
  // 完全一致がパターンより優先される
  assert.equal(tr.translateString("Follow back"), "フォローバック");
});

test("文脈辞書: リンクを挟む文の語順を整える", () => {
  const { doc, tr } = setup(`<p class="listenLogin__tout">Follow <a href="/forss">Forss</a> and others on SoundCloud.</p>`);
  tr.translateTree(doc.body);
  assert.equal(
    doc.querySelector("p").textContent.replace(/\s+/g, " ").trim(),
    "Forss やほかのアーティストを SoundCloud でフォローしよう。",
  );
});

test("動的に追加・変更された DOM も訳す（MutationObserver 経由）", async () => {
  const { w, doc, tr } = setup(`<div id="app"></div>`);
  const obs = new w.MutationObserver((m) => tr.handleMutations(m));
  obs.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: w.SCJA_TRANSLATED_ATTRIBUTES });
  const btn = doc.createElement("button");
  btn.textContent = "Like";
  doc.getElementById("app").appendChild(btn);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(btn.textContent, "いいね");
  // SoundCloud 側がラベルを書き換えた場合も追従する
  btn.firstChild.nodeValue = "Liked";
  btn.setAttribute("title", "Unlike");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(btn.textContent, "いいね済み");
  assert.equal(btn.title, "いいねを取り消す");
  obs.disconnect();
});

test("無効化すると元の英語に戻る", () => {
  const { doc, tr } = setup(`<nav><a title="Home">Feed</a><span>Stations</span></nav>`);
  tr.translateTree(doc.body);
  assert.equal(doc.querySelector("a").textContent, "フィード");
  tr.setEnabled(false);
  tr.revertTree(doc.body);
  assert.equal(doc.querySelector("a").textContent, "Feed");
  assert.equal(doc.querySelector("a").title, "Home");
  assert.equal(doc.querySelector("span").textContent, "Stations");
});

test("ページタイトルを訳す", () => {
  const { doc, tr } = setup("");
  tr.translateTitle(doc);
  assert.equal(doc.title, "ストリーム | SoundCloud");
});

test("未翻訳ログ: 英語の UI 文言だけを1回ずつ報告する", () => {
  const { doc, tr, logged } = setup(`<p>Brand new label</p><p>Brand new label</p><p>12.3K</p><p>日本語</p><p>Like</p>`);
  tr.setReportUntranslated(true);
  tr.translateTree(doc.body);
  assert.deepEqual(logged, ["Brand new label"]);
});

test("辞書に重複キーや空の訳がない", () => {
  const src = load("dictionary.js");
  const body = src.slice(src.indexOf("const EXACT"), src.indexOf("const UNITS"));
  const keys = [...body.matchAll(/^\s*"((?:[^"\\]|\\.)*)":/gm)].map((m) => m[1]);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.deepEqual(dup, [], `重複キー: ${dup.join(", ")}`);
  const { w } = setup("");
  for (const [k, v] of Object.entries(w.SCJA_DICTIONARY.EXACT)) assert.ok(v.length > 0, `空の訳: ${k}`);
});
