"""把 repo/ 里的扩展同步到 Miru 实际读取的插件目录。

Miru 的扩展目录是写死的 `<文档>\miru\extensions`，本机已用目录联接指向
`D:\\Plugins\\miru\\extensions`，所以这里只要把 .js 复制过去即可。

用法:
    python tools/deploy.py                # 同步全部
    python tools/deploy.py shuhaige.net.js  # 只同步一个
"""
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "repo")
STORE = r"D:\Plugins\miru\extensions"
MIRU_PATH = r"C:\Users\Herwin\OneDrive\文档\miru\extensions"


def main():
    if not os.path.isdir(SRC):
        print("找不到 repo/ 目录")
        return
    os.makedirs(STORE, exist_ok=True)
    only = sys.argv[1:] or None
    files = [f for f in os.listdir(SRC) if f.endswith(".js") and (not only or f in only)]
    if not files:
        print("没有找到要同步的 .js")
        return
    for f in files:
        shutil.copy2(os.path.join(SRC, f), os.path.join(STORE, f))
        print(f"[deploy] {f} -> {STORE}")

    print("\n校验 Miru 视角:")
    if os.path.isdir(MIRU_PATH):
        for f in sorted(os.listdir(MIRU_PATH)):
            size = os.path.getsize(os.path.join(MIRU_PATH, f))
            print(f"  {f}  {size} B")
    else:
        print(f"  (路径不存在: {MIRU_PATH})")


if __name__ == "__main__":
    main()
