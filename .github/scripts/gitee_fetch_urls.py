#!/usr/bin/env python3
"""查询 Gitee Release 的附件，构建 {文件名: browser_download_url} 映射。

由 .github/workflows/release-gitee-sync.yml 在上传资产之后调用，供 gitee_rewrite_manifest.py 改写 manifest。
best-effort：查询失败 → 仅 ::warning:: 写 ok=false，下游 rewrite/publish 步骤凭 ok 守卫跳过。

输入（环境变量）：
  GITEE_OWNER   Gitee 组织/用户名
  GITEE_REPO    Gitee 仓库名
  RELEASE_ID    Gitee Release ID（由 gitee_create_release.py 输出）
  GITEE_TOKEN   Gitee 个人访问令牌
  GITHUB_OUTPUT Actions 步骤输出文件路径

输出：
  /tmp/gitee_url_map.json   {filename: browser_download_url}
  GITHUB_OUTPUT 追加 `ok=true`（成功）或 `ok=false`（失败）
"""
import json
import os
import urllib.request


def main() -> None:
    owner = os.environ["GITEE_OWNER"]
    repo = os.environ["GITEE_REPO"]
    url = (
        f"https://gitee.com/api/v5/repos/{owner}/{repo}/releases/"
        f"{os.environ['RELEASE_ID']}?access_token={os.environ['GITEE_TOKEN']}"
    )
    rel = json.load(urllib.request.urlopen(url))
    # Gitee API 字段名可能是 assets 或 attach_files，两者都兜底
    assets = rel.get("assets") or rel.get("attach_files") or []
    mapping = {a["name"]: a["browser_download_url"] for a in assets}
    with open("/tmp/gitee_url_map.json", "w") as f:
        json.dump(mapping, f, indent=2)
    with open(os.environ["GITHUB_OUTPUT"], "a") as f:
        f.write("ok=true\n")
    print("Gitee asset URL map:")
    print(json.dumps(mapping, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # 含 HTTPError / URLError（DNS / 超时 / 连接拒绝）—— 优雅跳过
        print(f"::warning::Failed to fetch Gitee asset URLs (manifest rewrite will skip): {e}")
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write("ok=false\n")
