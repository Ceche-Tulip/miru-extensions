# Miru 扩展仓库

给 [Miru](https://github.com/miru-project/miru-app) 用的中文小说/漫画扩展。
官方仓库 `miru-project/repo` 已停止维护，这里的源是重新写的，不依赖官方脚本。

## 安装

**方式一：添加本仓库（推荐）**

Miru → 设置 → 扩展仓库地址，填：

```
https://raw.githubusercontent.com/<用户名>/miru-extensions/main
```

然后到「扩展 → 仓库」里点安装。地址末尾**不要**带 `/index.json`，App 会自己拼。

**方式二：手动放文件**

把 `repo/<package>.js` 复制到 Miru 的扩展目录，文件名必须和扩展头里的 `@package` 一致：

| 平台 | 目录 |
| --- | --- |
| Windows | `%USERPROFILE%\Documents\miru\extensions\` |
| Android | 应用私有目录下的 `miru/extensions/`（用 App 内「导入扩展 → 扩展目录」打开） |

**方式三：通过链接安装**

把 `repo/shuhaige.net.js` 的 raw 链接粘进「导入扩展 → 通过链接导入」。

## 扩展列表

| 扩展 | 类型 | 站点 | 说明 |
| --- | --- | --- | --- |
| 书海阁 `shuhaige.net` | 小说 | shuhaige.net | 书库浏览（排序/分类/状态）、搜索、详情、正文（含章节内分页合并） |

## 客户端要求

**书海阁的搜索需要「会跟随 POST 302」的客户端。** 官方原版基于 `dart:io`，而 `dart:io` 的自动重定向
只对 GET/HEAD 生效，所以官方版点搜索会直接报 `DioException ... 302`。

两种选择：

1. 用本项目的自编译客户端（见 `miru-client` 仓库，已修此问题）；
2. 或者只用书库浏览、详情和阅读——这些在官方版上正常。

## 目录结构

```
.
├── index.json          # 扩展索引，App 读这个
├── repo/               # 扩展本体，App 按 <仓库地址>/repo/<package>.js 下载
├── tools/
│   ├── harness.mjs     # 不开 App 直接跑扩展的本地调试器
│   └── deploy.py       # 把 repo/ 同步到本机 Miru 扩展目录
└── package.json        # 只有调试器需要（cheerio）
```

## 开发

```bash
npm install                      # 只为 harness 装 cheerio
node tools/harness.mjs repo/shuhaige.net.js latest:1
node tools/harness.mjs repo/shuhaige.net.js "search:大梦主"
node tools/harness.mjs repo/shuhaige.net.js detail:/91566/
node tools/harness.mjs repo/shuhaige.net.js watch:/7055/10069559.html
node tools/harness.mjs repo/shuhaige.net.js "all:大梦主"        # 搜索→详情→正文
MIRU_STRICT=1 node tools/harness.mjs repo/shuhaige.net.js "search:xx"   # 模拟官方客户端
```

调试器复刻了 App 的运行时（包括 QuickJS 里那套反直觉的 `Element` 行为），本地过了线上基本也过。

改完 `python tools/deploy.py` 推到本机 Miru，App 会热重载。

### 写扩展时的四个坑

1. `querySelector` 是懒执行的，链式 `el.querySelector()` 会丢上下文。
2. `Element.getAttributeText(attr)` 用「元素自身 outerHTML + 完整选择器」去查，
   后代选择器（`#a img`）必然取不到 → 用基类 `this.getAttributeText(content, selector, attr)`。
3. 参数是字符串插值，关键词里带 `"` 会写坏脚本。
4. 网络层固定 UTF-8，GBK 站点会乱码。

## 许可

各扩展文件头部自带许可（当前均为 MIT）。
