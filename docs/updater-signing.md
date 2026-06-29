# Updater 签名密钥配置指南

本文档说明如何为「检查更新」功能（基于 `tauri-plugin-updater`）生成 Ed25519 签名密钥、配置 GitHub Secrets，并在首次发布前激活 updater。这是上线检查更新功能的**必经步骤**——Tauri updater 强制要求签名校验，未配置密钥时 `check()` 会失败。

## 前置条件

- 本地已安装 Tauri CLI（项目内 `pnpm tauri` 即可调用）
- 对 GitHub 仓库 `oceanopen/we-health-tick-app` 有 Settings → Secrets 写入权限
- 已合并本次检查更新功能的全部代码改动（参考 commit 历史）

## 当前状态

代码已落地，但 `src-tauri/tauri.conf.json` 中：

```json
"updater": {
  "active": false,        // ← 待激活
  "pubkey": "",           // ← 待填入公钥
  ...
}
```

`active: false` 状态下，客户端点「检查更新」会直接返回 null（显示「已是最新版本」），不会触发签名校验失败。**完成下文步骤 2 后再将 `active` 改为 `true`。**

## 步骤 1：本地生成签名密钥对

在项目根目录执行：

```bash
pnpm tauri signer generate -w ~/.tauri/we-health-tick.key
```

交互提示：

- **密码**：可留空（直接回车）或设置一个强密码。设了密码需要额外配置一个 Secret（见步骤 3）。
- **输出**：命令会打印一段 `Public Key:`（Base64 字符串），同时把私钥写入 `~/.tauri/we-health-tick.key`。

⚠️ **私钥安全红线**：

- 私钥文件 `~/.tauri/we-health-tick.key` **永远不要**提交到 git
- 私钥**永远不要**分享给任何人（包括 AI 助手）
- 建议把私钥备份到密码管理器或离线存储，丢失后无法补发（已发布的版本签名链会断）
- 项目根目录已确认无 `.tauri/` 引用，无需改 `.gitignore`，但本地路径 `~/.tauri/` 在 home 目录之外

## 步骤 2：填入公钥并激活 updater

编辑 `src-tauri/tauri.conf.json`：

```jsonc
"plugins": {
  "updater": {
    "active": true,                                    // ← 改为 true
    "endpoints": [
      "https://github.com/oceanopen/we-health-tick-app/releases/latest/download/latest.json"
    ],
    "pubkey": "BASE64_PUBLIC_KEY_HERE",                // ← 粘贴步骤 1 输出的公钥字符串
    "windows": {
      "installMode": "passive"
    }
  }
}
```

注意：

- `pubkey` 是公钥**字符串内容本身**（如 `dW50cnVzdGVkIGNvbW1l...`），**不是**文件路径
- 公钥可以公开，提交到 git 无安全问题
- 改完后跑 `pnpm build` 确认配置正确加载

## 步骤 3：配置 GitHub Secrets

进入 GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret，添加以下条目：

| Secret 名称          | 值                                                                                                                                          | 必填         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `TAURI_PRIVATE_KEY`  | 步骤 1 生成的私钥文件 `~/.tauri/we-health-tick.key` 的**完整内容**（用 `cat ~/.tauri/we-health-tick.key` 输出粘贴）                         | ✅           |
| `TAURI_KEY_PASSWORD` | 步骤 1 设置的密码。**未设密码则跳过此 Secret**，并同时删除 `.github/workflows/release-assets.yml` 里对 `TAURI_KEY_PASSWORD` 的两处 env 引用 | 仅密码非空时 |

CI 工作流 `.github/workflows/release-assets.yml` 已在 tag 触发的「Build and release」步骤中引用这两个 Secret：

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
  TAURI_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}
```

Secret 名称**严格大小写敏感**，必须与上文完全一致。

## 步骤 4：验证发布流程

推一个 `v*` 格式的 tag 触发发布（如 `v0.1.20`）：

```bash
# 项目用 bumpp 管理版本，会同步 package.json / Cargo.toml / tauri.conf.json / Cargo.lock
pnpm release
# 或手动：git tag v0.1.20 && git push origin v0.1.20
```

在 GitHub Actions 页面观察 `Release Assets` workflow：

- ✅ macOS + Windows 两个 job 都成功
- ✅ GitHub Release 页面 `v0.1.20` 上有以下产物：
  - `We Health Tick_0.1.20_universal.dmg`（macOS 安装包）
  - `We Health Tick_0.1.20_universal.app.tar.gz` + `.sig`（macOS updater 产物）
  - `We Health Tick_0.1.20_x64-setup.exe`（Windows NSIS 安装包）
  - `We Health Tick_0.1.20_x64-setup.exe.tar.gz` + `.sig`（Windows updater 产物）
  - `latest.json`（updater manifest，含版本、下载 URL、签名）

如果 `latest.json` 没上传，说明 tauri-action 没识别到 updater 配置——回头检查 `pubkey` 是否已填、`active` 是否为 `true`、`bundle.createUpdaterArtifacts` 是否为 `true`。

## 步骤 5：客户端实测更新链路

1. 下载并安装 `v0.1.20` 的 dmg / exe
2. 打开应用 → 设置 → 关于页 → 点「检查更新」（应显示「已是最新版本 v0.1.20」）
3. 推一个更高版本的 tag（如 `v0.1.21`），等 CI 跑完
4. 在旧版本（v0.1.20）上再点「检查更新」：
   - 状态文字显示「发现新版本 v0.1.21」
   - 按钮文字变为「下载并安装 v0.1.21」
   - 点击 → 按钮变「下载中 xx%」（带进度）
   - 下载完成 → 应用自动重启，进入 v0.1.21

## 故障排查

### `check()` 抛签名校验错误

**症状**：客户端点「检查更新」后状态文字显示「检查失败：signature verification failed」之类。

**原因**：`pubkey` 与签名用的私钥不匹配，或 `latest.json` 中的 signature 字段缺失。

**排查**：

1. 确认 `tauri.conf.json` 的 `pubkey` 是步骤 1 输出的**公钥字符串**，不是文件路径
2. 确认 GitHub Secret `TAURI_PRIVATE_KEY` 是私钥文件的**完整内容**（含 `-----BEGIN PRIVATE KEY-----` 等头尾，如果有）
3. 在 GitHub Release 页面打开 `latest.json`，检查 `signature` 字段非空
4. 本地对比：`pnpm tauri signer sign <某个产物>`，与 CI 上传的 `.sig` 比对

### workflow_dispatch 手动触发失败

**症状**：在 Actions 页面手动跑 `Release Assets` workflow 时，macOS/Windows job 在「Build only」步骤失败，报签名相关错误。

**预期行为**：手动触发模式**不应**签名（CI 配置已剥离 `TAURI_PRIVATE_KEY` 引用）。如果仍报错，检查 `.github/workflows/release-assets.yml` 的「Build only」步骤 env 是否仅含 `GITHUB_TOKEN`。

### 推 tag 后没有生成 `latest.json`

**原因**：tauri-action 只在 `tagName` 提供时生成 manifest。「Build only」分支（workflow_dispatch）不会生成，这是预期的。

**排查**：确认 tag 推送触发的是「Build and release」分支（`if: github.ref_type == 'tag'`）。

### Windows 更新后应用未自动重启

**症状**：下载进度到 100% 后状态卡在「重启并安装」，应用没退出。

**原因**：plugin-updater 在 Windows passive 模式下应该自动重启，但偶尔会失败。

**对策**：手动关闭应用再打开即可。如果频繁出现，考虑改 `installMode` 为 `basicUi`（带 NSIS UI，用户手动确认安装）。

## 安全注意事项

- **私钥永不外泄**：丢失或泄露后，必须立即重新生成密钥对、发布新版本、通知所有用户升级（旧版本将无法验证新版本的更新）
- **公钥可公开**：嵌入 `tauri.conf.json` 提交到 git 是预期的，没问题
- **GitHub Secret 不会出现在日志**：但 Actions 日志可能间接暴露（如错误信息），定期审查 workflow 运行日志
- **密码强度**：如设置密码，至少 32 位随机字符串；密码丢失不可恢复，但可以通过重新生成密钥对重置

## 相关文件

- `src-tauri/tauri.conf.json` — updater 配置（endpoints / pubkey / installMode）
- `src-tauri/Cargo.toml` — `tauri-plugin-updater = "2"` 依赖
- `src-tauri/src/lib.rs` — 插件注册 `.plugin(tauri_plugin_updater::Builder::new().build())`
- `src-tauri/capabilities/default.json` — `updater:default` 权限
- `src/windows/settings/components/AboutPage.tsx` — 检查更新按钮 UI 与状态机
- `.github/workflows/release-assets.yml` — 构建发布工作流（含签名 env）
- 参考实现：`~/MyFiles/Project/health-tick-release/Sources/UpdateChecker.swift`（Swift 版自研 updater，本项目采用官方 plugin 替代）
