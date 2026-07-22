#!/usr/bin/env python3
"""创建或复用 Gitee Release（幂等），输出 release_id 供下游步骤守卫使用。

由 .github/workflows/release-gitee-sync.yml 在镜像 tag 到 Gitee 之后调用。
best-effort：tag 可能尚未镜像 / 网络抽风 / token 问题 → 仅 ::warning:: 不写 release_id，
下游步骤凭 release_id 守卫自动跳过，绝不硬失败阻塞 job。

输入（环境变量）：
  GITEE_OWNER   Gitee 组织/用户名（ocean-open）
  GITEE_REPO    Gitee 仓库名（we-health-tick-app）
  TAG           发版 tag（如 v0.1.38）
  GITEE_TOKEN   Gitee 个人访问令牌
  GITHUB_SHA    tag 实际指向的 commit（target_commitish）
  GITHUB_OUTPUT Actions 步骤输出文件路径

输出：
  GITHUB_OUTPUT 追加 `release_id=<id>`（仅成功时）
"""
import json
import os
import urllib.error
import urllib.request


def main() -> None:
    owner = os.environ["GITEE_OWNER"]
    repo = os.environ["GITEE_REPO"]
    tag = os.environ["TAG"]
    token = os.environ["GITEE_TOKEN"]
    sha = os.environ.get("GITHUB_SHA", "main")
    base = f"https://gitee.com/api/v5/repos/{owner}/{repo}"

    # 幂等：先查 tag 是否已有 release
    rid = ""
    try:
        with urllib.request.urlopen(f"{base}/releases/tags/{tag}?access_token={token}") as r:
            rid = str(json.load(r)["id"])
            print(f"Existing Gitee release found: id={rid}")
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise

    if not rid:
        # Gitee v5 鉴权坑：access_token 放 body，放 header 会返回 HTML 错误页
        body = json.dumps({
            "access_token": token,
            "tag_name": tag,
            "name": f"We Health Tick {tag}",
            "body": f"Release {tag} (mirrored from GitHub)",
            "target_commitish": sha,
        }).encode()
        req = urllib.request.Request(
            f"{base}/releases",
            data=body,
            headers={"Content-Type": "application/json"},
        )
        rid = str(json.load(urllib.request.urlopen(req))["id"])
        print(f"Created Gitee release: id={rid}")

    with open(os.environ["GITHUB_OUTPUT"], "a") as f:
        f.write(f"release_id={rid}\n")


if __name__ == "__main__":
    # best-effort：任何异常都优雅跳过，不阻塞 job
    try:
        main()
    except Exception as e:
        # 含 HTTPError / URLError（DNS / 超时 / 连接拒绝）/ JSON 解析等
        print(f"::warning::Gitee release creation skipped (downstream steps will skip): {e}")
