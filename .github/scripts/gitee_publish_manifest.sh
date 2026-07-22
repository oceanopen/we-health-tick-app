#!/usr/bin/env bash
# 把 latest-gitee.json 推到 release-manifest orphan 分支（Gitee + GitHub）。
# 由 .github/workflows/release-gitee-sync.yml 在 gitee_rewrite_manifest.py 之后调用。
# orphan 分支类 gh-pages：每次全新 init + force-push，分支只保留最新一份 manifest。
#
# 失败语义：任一 push 失败 → set -e 中止 → exit 非 0 → 步骤红。
# Gitee（客户端拉取的关键目标）排在 GitHub（备份）之前：确保关键 push 先完成，
# 再尝试备份；备份失败也会让步骤红（暴露问题），但关键 manifest 已就位。
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

# Gitee orphan 分支（关键目标：客户端从这里拉 manifest，即时可用）—— 失败即中止
git push -q --force "https://${GITEE_USER}:${GITEE_TOKEN}@gitee.com/${GITEE_OWNER}/${GITEE_REPO}.git" release-manifest
echo "Pushed release-manifest to Gitee"

# GitHub orphan 分支（备份 + 审计）—— 失败也中止（暴露问题）
git push -q --force "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" release-manifest
echo "Pushed release-manifest to GitHub"

echo "::notice::Gitee manifest URL: https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/raw/release-manifest/latest-gitee.json"
