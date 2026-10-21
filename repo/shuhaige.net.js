// ==MiruExtension==
// @name         书海阁
// @version      v0.4.0
// @author       Rune
// @lang         zh-cn
// @icon         https://www.shuhaige.net/tpl/pc/images/logo.png
// @license      MIT
// @package      shuhaige.net
// @type         fikushon
// @webSite      https://www.shuhaige.net
// @description  书海阁小说网（shuhaige.net）中文网络小说：书库分类浏览、搜索、书籍详情、正文阅读（自动合并章节分页）。
// ==/MiruExtension==
export default class extends Extension {
  ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  mua = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

  // 书库 URL 形如 /shuku/{排序}_{分类}_{状态}_{页码}.html
  cats = {
    "0": "全部分类", "1": "玄幻", "2": "奇幻", "3": "武侠", "4": "都市", "5": "历史",
    "6": "军事", "7": "悬疑", "8": "游戏", "9": "科幻", "10": "体育", "11": "古言",
    "12": "现言", "13": "幻言", "14": "仙侠", "15": "青春", "16": "穿越", "17": "女生", "18": "其他",
  };
  sorts = {
    "0": "默认", weekvisit: "周点击", monthvisit: "月点击", dayvisit: "日点击",
    allvisit: "总点击", weekvote: "周推荐", monthvote: "月推荐", dayvote: "日推荐",
    allvote: "总推荐", goodnum: "总收藏", size: "字数", postdate: "入库",
  };
  statuses = { "0": "全部", "1": "连载", "2": "完本" };

  async req(url, options) {
    options = options || {};
    options.headers = Object.assign(
      {
        "User-Agent": this.ua,
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      options.headers || {}
    );
    return await this.request(url, options);
  }

  // 站内搜索依赖会话 cookie：先访问一次首页拿到 session / waf cookie
  async warmup() {
    if (this.ready) return;
    try {
      await this.req("/");
      this.ready = true;
    } catch (e) {
      console.log("warmup failed: " + e);
    }
  }

  // ---- 基础读取（显式传 content + selector，避免 Element 的懒执行状态错位）----
  async text(content, selector) {
    const el = this.querySelector(content, selector);
    if (!(await el.outerHTML)) return "";
    const t = await el.text;
    return (t || "").replace(/\s+/g, " ").trim();
  }

  async attr(content, selector, name) {
    // 注意：Element.getAttributeText(attr) 内部是「把元素自身 outerHTML 当 content，
    // 再用完整选择器去查」，对 "#fmimg img" 这种后代选择器必然查不到。
    // 这里必须走基类的 getAttributeText(content, selector, attr)。
    const v = await this.getAttributeText(content, selector, name);
    return v || "";
  }

  async html(content, selector) {
    const el = this.querySelector(content, selector);
    if (!(await el.outerHTML)) return "";
    return (await el.innerHTML) || "";
  }

  decode(s) {
    return (s || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
      .replace(/&amp;/g, "&");
  }

  pick(filter, key, fallback, allowed) {
    let v = filter && filter[key] ? filter[key][0] : null;
    if (!v) return fallback;
    v = String(v);
    return allowed && !Object.prototype.hasOwnProperty.call(allowed, v) ? fallback : v;
  }

  // 书库列表：分类 / 排序 / 状态 都在 URL 里，也是唯一带封面的列表页
  async browse(page, filter) {
    const p = Math.max(1, parseInt(page) || 1);
    const sort = this.pick(filter, "sort", "weekvisit", this.sorts);
    const cat = this.pick(filter, "cat", "0", this.cats);
    const status = this.pick(filter, "status", "0", this.statuses);
    const doc = await this.req(`/shuku/${sort}_${cat}_${status}_${p}.html`);
    return this.parseSitebox(doc);
  }

  parseSitebox(doc) {
    const items = [];
    if (!doc) return items;
    const re = /<dl>([\s\S]*?)<\/dl>/g;
    let m;
    while ((m = re.exec(doc)) !== null) {
      const row = m[1];
      const link = /<h3>[\s\S]*?<a href="([^"]+)"[^>]*>([^<]+)<\/a>/.exec(row);
      if (!link) continue;
      const cover = /<dt>[\s\S]*?<img[^>]+src="([^"]+)"/.exec(row);
      const uptime = /<span class="uptime">([^<]*)<\/span>/.exec(row);
      const last = /最新章节:\s*<a[^>]*>([^<]*)<\/a>/.exec(row);
      const author = /作者：<span>([^<]*)<\/span>/.exec(row) || /作者：\s*([^<]*)</.exec(row);
      const bits = [];
      if (author) bits.push(this.decode(author[1]).replace(/\s+/g, " ").trim());
      if (last) bits.push(this.decode(last[1]).replace(/\s+/g, " ").trim());
      if (uptime) bits.push(uptime[1].trim());
      items.push({
        title: this.decode(link[2]).replace(/\s+/g, " ").trim(),
        url: link[1].replace(/^https?:\/\/[^/]+/, ""),
        cover: cover ? cover[1] : "",
        update: bits.join(" · "),
      });
    }
    return items;
  }

  async latest(page) {
    return this.browse(page, null);
  }

  async search(kw, page, filter) {
    const p = Math.max(1, parseInt(page) || 1);
    kw = (kw || "").trim();
    // 没输关键词时，用书库 + 筛选器浏览
    if (!kw) return this.browse(p, filter);

    let doc = "";
    try {
      if (p === 1 || !this.searchId || this.searchKw !== kw) {
        await this.warmup();
        doc = await this.req("/search.html", {
          method: "post",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Referer: "https://www.shuhaige.net/",
            Origin: "https://www.shuhaige.net",
          },
          data: "searchtype=all&searchkey=" + encodeURIComponent(kw),
        });
        const m = /\/search\/(\d+)\//.exec(doc);
        this.searchId = m ? m[1] : null;
        this.searchKw = kw;
        if (!this.searchId && /找不到您要搜索的内容|搜索间隔/.test(doc)) return [];
        if (this.searchId && p > 1) {
          doc = await this.req(`/search/${this.searchId}/${p}.html`);
        }
      } else {
        doc = await this.req(`/search/${this.searchId}/${p}.html`);
      }
    } catch (e) {
      // 书海阁的搜索是「POST 后 302 跳到 /search/{id}/{page}.html」。
      // Miru 的 dio 基于 dart:io，而 dart:io 只对 GET/HEAD 自动跟随重定向，
      // 所以 POST 的 302 会直接抛 DioException。抓不到结果时给出明确日志，别让界面崩。
      console.log("[书海阁] 站内搜索不可用（POST 302 无法跟随）：" + e);
      return [];
    }

    if (/找不到您要搜索的内容|搜索间隔|错误提示/.test(doc)) return [];

    const box = await this.html(doc, "#sitembox");
    const items = [];
    const re = /<dl>([\s\S]*?)<\/dl>/g;
    let m;
    while ((m = re.exec(box)) !== null) {
      const row = m[1];
      const link = /<h3><a href="([^"]+)"[^>]*>([^<]+)<\/a>/.exec(row);
      if (!link) continue;
      const cover = /<dt>[\s\S]*?<img[^>]+src="([^"]+)"/.exec(row);
      const other = /<dd class="book_other">([\s\S]*?)<\/dd>/.exec(row);
      let update = "";
      if (other) {
        const t = this.decode(other[1]).replace(/\s+/g, " ").trim();
        const mm = /作者：\s*(.*?)\s*状态：\s*(.*?)\s*分类/.exec(t);
        update = mm ? `${mm[1]} · ${mm[2]}` : t.slice(0, 40);
      }
      items.push({
        title: this.decode(link[2]).trim(),
        url: link[1],
        cover: cover ? cover[1] : "",
        update,
      });
    }
    return items;
  }

  async detail(url) {
    const path = url.replace(/^https?:\/\/[^/]+/, "").replace(/\/+$/, "") + "/";
    const doc = await this.req(path);
    if (!/id="maininfo"/.test(doc)) throw new Error("书籍页面已失效：" + url);

    const idMatch = /\/(\d+)\/?$/.exec(path);
    const id = idMatch ? idMatch[1] : "";
    const title = await this.text(doc, "#info h1");
    const cover = await this.attr(doc, "#fmimg img", "src");
    console.log("[书海阁] detail " + path + " cover=" + (cover || "(空)"));

    // 页面上 #intro 被站点自身截断成 "…"，og:description 才是完整简介
    let desc = "";
    const og = /<meta[^>]+property="og:description"[^>]+content="([^"]*)"/.exec(doc);
    if (og) {
      desc = this.decode(og[1]).trim();
      const cut = ["观看小说：", "观看小说:", "小说：", "小说:"];
      for (const k of cut) {
        const i = desc.indexOf(k);
        if (i >= 0) {
          desc = desc.slice(i + k.length).trim();
          break;
        }
      }
    }
    if (!desc) {
      desc = await this.text(doc, "#intro p");
      if (!desc) desc = this.decode(await this.html(doc, "#intro")).trim();
    }
    // PC 页和 og:description 都被站点截断（约 280 字）；移动版 shu_<id>.html 的 .intro 才是全文
    if (id && (desc.length < 400 || /(\.\.\.|…)$/.test(desc))) {
      try {
        const mob = await this.req(`/shu_${id}.html`, {
          headers: { "Miru-Url": "https://m.shuhaige.net", "User-Agent": this.mua },
        });
        const raw = await this.html(mob, ".intro p");
        const full = this.decode(raw).replace(/\n{2,}/g, "\n").trim();
        if (full.length > desc.length) desc = full;
      } catch (e) {
        console.log("[书海阁] 移动版简介获取失败: " + e);
      }
    }
    desc = desc.replace(/^《.*?》小说推荐[\s\S]*$/, "").trim();

    // 一次性取出章节目录 HTML，用正则解析（2000+ 章也不会卡住）
    const listHtml = await this.html(doc, "#list");
    const all = [];
    const re = /<a href="([^"]+)"[^>]*>([^<]*)<\/a>/g;
    let m;
    while ((m = re.exec(listHtml)) !== null) {
      const href = m[1].replace(/^https?:\/\/[^/]+/, "");
      if (!new RegExp(`^/?${id}/\\d+\\.html$`).test(href)) continue;
      all.push({ name: this.decode(m[2]).replace(/\s+/g, " ").trim() || href, url: href });
    }
    // “最新章节”段会先倒序重复一遍尾部章节，正文段才是正序全量：只保留每个链接最后一次出现
    const lastAt = {};
    all.forEach((c, i) => {
      lastAt[c.url] = i;
    });
    const chapters = all.filter((c, i) => lastAt[c.url] === i);

    // 上千章不分卷时，下拉里一个"共 N 章"没法用；按 100 章切组，既方便跳段也少渲染
    const SIZE = 100;
    const episodes = [];
    for (let i = 0; i < chapters.length; i += SIZE) {
      const part = chapters.slice(i, i + SIZE);
      episodes.push({
        title: `第 ${i + 1}-${i + part.length} 章`,
        urls: part,
      });
    }

    return {
      title,
      cover,
      desc,
      episodes,
    };
  }

  async watch(url) {
    let next = url.replace(/^https?:\/\/[^/]+/, "");
    let title = "";
    const content = [];
    for (let guard = 0; guard < 30 && next; guard++) {
      const doc = await this.req(next);
      if (guard === 0) {
        title = await this.text(doc, ".bookname h1");
      }
      const body = await this.html(doc, "#content");
      const parts = this.decode(body).split(/\n+/);
      for (const raw of parts) {
        const line = raw.replace(/\s+/g, " ").trim();
        if (!line) continue;
        if (/请收藏|更新速度全网最快|章节错误|手机版阅读|最新网址|请记住本站/.test(line)) continue;
        content.push(line);
      }
      // 章节内部翻页：下一页形如 /book/chid_2.html；否则本章结束
      const href = await this.attr(doc, "#pager_next", "href");
      next = /_\d+\.html$/.test(href) ? href : null;
    }
    return {
      title: title || "正文",
      subtitle: "",
      content,
    };
  }

  // 首页“最近阅读”卡片会调它显示更新提示；本站没有轻量接口，这里直接返回空
  async checkUpdate(url) {
    return "";
  }

  async createFilter() {
    return {
      sort: { title: "排序", min: 1, max: 1, default: "weekvisit", options: this.sorts },
      cat: { title: "分类", min: 1, max: 1, default: "0", options: this.cats },
      status: { title: "状态", min: 1, max: 1, default: "0", options: this.statuses },
    };
  }
}
