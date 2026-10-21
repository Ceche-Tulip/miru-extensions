# Miru 扩展仓库

给 [Miru](https://github.com/miru-project/miru-app) 用的中文小说/漫画扩展。
官方仓库 `miru-project/repo` 已停止维护，这里的源是重新写的，不依赖官方脚本。

配套客户端：[Ceche-Tulip/miru-app](https://github.com/Ceche-Tulip/miru-app)（上游的 fork，修了几处影响扩展的客户端问题，见其 `PATCHES.md`）。

## 安装

**方式一：添加本仓库（推荐）**

Miru → 设置 → 扩展仓库地址，填：

```
https://raw.githubusercontent.com/Ceche-Tulip/miru-extensions/main
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

扩展运行在客户端里，能力边界由客户端决定。这里记录**已知的客户端限制**，与具体扩展无关：

| 限制 | 影响 | 说明 |
| --- | --- | --- |
| 不跟随非 GET 请求的重定向 | 站内搜索报 `DioException ... 302` | 官方客户端基于 `dart:io`，而它只对 GET/HEAD 自动跟随 3xx；「POST 表单 → 302 跳结果页」型站点的搜索因此失败 |

使用 [Ceche-Tulip/miru-app](https://github.com/Ceche-Tulip/miru-app)（fork）已修复上表问题；
官方原版仍可正常浏览列表、查看详情与阅读，只是受影响的搜索不可用。

新发现客户端层面的问题时，会继续补充到这张表。

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

本仓库以 [MIT 许可](LICENSE) 发布，完整条款见 [`LICENSE`](LICENSE)；
每个扩展文件头部的 `MIT` 标记与之一致。
