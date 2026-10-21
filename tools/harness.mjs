// Miru 扩展本地调试器：在 Node 中模拟 Miru(QuickJS) 运行时，直接跑扩展源码
// 用法: node harness.mjs <扩展文件.js> [scenario]
// scenario: latest | search:<关键词> | detail:<url> | watch:<url> | all:<关键词>
import fs from "node:fs";
import * as cheerio from "cheerio";

const BASE = "https://www.shuhaige.net";

// ---- 极简 cookie jar（模拟 Miru 的 PersistCookieJar）----
const jar = new Map();
function jarFor(url) {
  const host = new URL(url).host;
  return jar.get(host) || new Map();
}
function storeCookies(url, res) {
  const host = new URL(url).host;
  const store = jarFor(url);
  const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const raw of list) {
    const [pair] = raw.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) store.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
  jar.set(host, store);
}
function cookieHeader(url) {
  const store = jarFor(url);
  return [...store.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

// ---- 模拟 Dart 侧能力 ----
async function request(args) {
  const [url, options = {}] = args;
  const headers = Object.assign({}, options.headers || {});
  const ck = cookieHeader(url);
  if (ck) headers["Cookie"] = ck;
  // MIRU_STRICT=1 模拟 Miru 的真实行为：dart:io 不跟随 POST 的 301/302，
  // dio 的 validateStatus 会把 3xx 当异常抛出。用它来验证"线上会不会炸"。
  const strict = process.env.MIRU_STRICT === "1";
  const init = { method: (options.method || "get").toUpperCase(), headers, redirect: strict ? "manual" : "follow" };
  if (options.data !== undefined && init.method !== "GET") init.body = options.data;
  const res = await fetch(url, init);
  storeCookies(url, res);
  if (strict && res.status >= 300 && res.status < 400) {
    throw new Error(`DioException [bad response]: status code of ${res.status} (Location: ${res.headers.get("location")})`);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function parseDoc(content) {
  return cheerio.load(content || "");
}

class Element {
  constructor(content, selector) {
    this.content = content;
    this.selector = selector || "";
  }
  async excute(fun) {
    const $ = parseDoc(this.content);
    const node = this.selector ? $(this.selector).first() : null;
    if (!node || node.length === 0) return "";
    if (fun === "text") return node.text();
    if (fun === "innerHTML") return node.html();
    return $.html(node);
  }
  get text() {
    return this.excute("text");
  }
  get outerHTML() {
    return this.excute("outerHTML");
  }
  get innerHTML() {
    return this.excute("innerHTML");
  }
  async getAttributeText(attr) {
    // 与真实运行时一致：先取自身 outerHTML，再用 this.selector 去查。
    // 所以后代选择器（如 "#fmimg img"）在这里必然查不到 —— 复现线上行为，别"修得太好"。
    const html = await this.excute();
    const $ = parseDoc(html);
    const node = this.selector ? $(this.selector).first() : null;
    if (!node || node.length === 0) return null;
    return node.attr(attr) ?? null;
  }
  async querySelector(selector) {
    return new Element(await this.excute(), selector);
  }
  async removeSelector(selector) {
    const $ = parseDoc(this.content);
    $(selector).remove();
    this.content = $.html();
    return this;
  }
}

class Extension {
  constructor() {
    this.package = "test";
    this.name = "test";
    this.settingKeys = [];
  }
  async request(url, options) {
    const o = options || {};
    const miruUrl = (o.headers && o.headers["Miru-Url"]) || BASE;
    return await request([miruUrl + url, o]);
  }
  querySelector(content, selector) {
    return new Element(content, selector);
  }
  async querySelectorAll(content, selector) {
    const $ = parseDoc(content);
    const out = [];
    $(selector).each((_, el) => out.push(new Element($.html(el), selector)));
    return out;
  }
  async getAttributeText(content, selector, attr) {
    const $ = parseDoc(content);
    return $(selector).first().attr(attr) ?? null;
  }
  async getSetting() {
    return null;
  }
  async registerSetting() {
    return null;
  }
  async load() {}
  latest() {
    throw new Error("not implement latest");
  }
  search() {
    throw new Error("not implement search");
  }
  detail() {
    throw new Error("not implement detail");
  }
  watch() {
    throw new Error("not implement watch");
  }
  createFilter() {
    throw new Error("not implement createFilter");
  }
}

// ---- 载入扩展，复刻 Dart 侧的正则替换 ----
function loadExtension(file) {
  const src = fs.readFileSync(file, "utf8").replace(/export default class.*/, "class Ext extends Extension {");
  const factory = new Function("Extension", "Element", `${src}\nreturn Ext;`);
  const Ext = factory(Extension, Element);
  return new Ext();
}

// ---- 运行 ----
const file = process.argv[2];
const scenario = process.argv[3] || "all:大梦主";
const ext = loadExtension(file);
await ext.load();

const [kind, arg] = scenario.split(":");
const t0 = Date.now();
let result;
if (kind === "latest") result = await ext.latest(parseInt(arg) || 1);
else if (kind === "search") result = await ext.search(arg, 1);
else if (kind === "searchpage") {
  const [kw, page] = arg.split("@");
  result = await ext.search(kw, parseInt(page));
} else if (kind === "searchpages") {
  for (const p of [1, 2, 3]) {
    const r = await ext.search(arg, p);
    console.log(`-- page ${p}: ${r.length} 条 | ${r.slice(0, 3).map((x) => x.title).join(" / ")}`);
  }
  result = null;
} else if (kind === "filters") {
  const f = await ext.createFilter();
  console.log("createFilter:", JSON.stringify(f, null, 1));
  const cases = [
    { label: "默认(无筛选)", filter: null },
    { label: "玄幻+连载+字数", filter: { sort: ["size"], cat: ["1"], status: ["1"] } },
    { label: "都市+完本+周点击", filter: { sort: ["weekvisit"], cat: ["4"], status: ["2"] } },
  ];
  for (const c of cases) {
    const r = await ext.search("", 1, c.filter);
    console.log(`-- ${c.label}: ${r.length} 条 | ${r.slice(0, 3).map((x) => x.title).join(" / ")}`);
    console.log(`   cover: ${r[0] ? r[0].cover : "-"}`);
    console.log(`   update: ${r[0] ? r[0].update : "-"}`);
  }
  result = null;
} else if (kind === "detail") result = await ext.detail(arg);
else if (kind === "watch") result = await ext.watch(arg);
else if (kind === "all") {
  const list = await ext.search(arg, 1);
  console.log("== search ==");
  console.log(JSON.stringify(list.slice(0, 5), null, 2));
  if (!list.length) process.exit(1);
  const d = await ext.detail(list[0].url);
  console.log("== detail ==");
  console.log(
    JSON.stringify(
      { title: d.title, cover: d.cover, desc: (d.desc || "").slice(0, 120), groups: d.episodes.map((g) => ({ title: g.title, count: g.urls.length, first: g.urls[0], last: g.urls[g.urls.length - 1] })) },
      null,
      2
    )
  );
  const target = d.episodes[0].urls[0].url;
  const w = await ext.watch(target);
  console.log(`== watch ${target} ==`);
  console.log(JSON.stringify({ title: w.title, paragraphs: w.content.length, head: w.content.slice(0, 3), tail: w.content.slice(-2) }, null, 2));
  result = null;
} else {
  throw new Error("unknown scenario " + scenario);
}
if (result !== null && result !== undefined) console.log(JSON.stringify(result, null, 2));
console.log(`\n[done in ${Date.now() - t0} ms]`);
