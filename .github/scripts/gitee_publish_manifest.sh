#!/usr/bin/env bash
# 把 latest-gitee.json 推到 release-manifest orphan 分支（GitHub + Gitee）。
# 由 .github/workflows/release-gitee-sync.yml 在 gitee_rewrite_manifest.py 之后调用。
# orphan 分支类 gh-pages：每次全新 init + force-push，分支只保留最新一份 manifest。
#
# 输入（环境变量）：
#   GITHUB_REPOSITORY  GitHub 仓库（owner/repo，Actions 自动可用）
#   GH_TOKEN           GitHub token（推 GitHub orphan 分支，step 级）
#   GITEE_OWNER        Gitee 组织/用户名（ocean-open，job 级）
#   GITEE_REPO         Gitee 仓库名（job 级）
#   GITEE_USER         Gitee 用户名（secrets，step 级）
#   GITEE_TOKEN        Gitee token（secrets，step 级）
#   TAG                发版 tag（job 级）
#   GITHUB_WORKSPACE   工作区路径（latest-gitee.json 所在，Actions 自动可用）
#
# 两次 push 相互独立：Gitee 是客户端拉取的关键目标，GitHub 是备份；
# 任一失败仅 ::warning::，不阻断另一个（&& echo || echo 模式，set -e 下安全）。
set -euo pipefail

WORKDIR="/tmp/release-manifest"
rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"
cd "$WORKDIR"

git init -q
git config user.name  "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git checkout -q -b release-manifest

cp "$GITHUB_WORKSPACE/latest-gitee.json" .
git add latest-gitee.json
git commit -q -m "chore(manifest): update latest-gitee.json for ${TAG}"

# GitHub orphan 分支（留存 + 审计）—— 失败仅 warn，不影响 Gitee push
git push -q --force "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" release-manifest \
  && echo "Pushed release-manifest to GitHub" \
  || echo "::warning::GitHub release-manifest push failed"

# Gitee orphan 分支（即时可用，不等下次镜像）—— 关键目标
git push -q --force "https://${GITEE_USER}:${GITEE_TOKEN}@gitee.com/${GITEE_OWNER}/${GITEE_REPO}.git" release-manifest \
  && echo "Pushed release-manifest to Gitee" \
  || echo "::warning::Gitee release-manifest push failed"

echo "::notice::Gitee manifest URL: https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/raw/release-manifest/latest-gitee.json"
