# 自动更新与签名配置

本文档描述 We Health Tick 桌面应用的自动更新（updater）链路：签名密钥管理、`tauri.conf.json` 配置、GitHub Actions 发布工作流，以及完整的发版流程。

## 整体链路

```
pnpm release (bumpp 改版本号 + 打 tag)
        │
        ▼
push tag v* ──► 触发两个 workflow
        │
        ├─► release-assets.yml  (mac universal + windows)
        │       tauri-action 用 TAURI_SIGNING_PRIVATE_KEY 给产物签名
        │       生成 *.sig + latest.json，全部上传到 GitHub Release
        │
        └─► release-notes.yml   (ubuntu)
                changelogithub 根据 conventional commits 生成 Release Notes

客户端启动后：
  GET https://github.com/oceanopen/we-health-tick-app/releases/latest/download/latest.json
  比对版本 → 下载 *.tar.gz → 用内置 pubkey 校验 *.sig → 安装
```

关键点：**latest.json 必须由 tauri-action 在 release 阶段生成**，因为它要聚合当次产物的签名。手动上传会漏掉它，自动更新就会失效。

---

## 一、签名密钥

### 1. 生成密钥对（一次性）

```bash
pnpm tauri signer generate -w ~/.tauri/we-health-tick.key
```

输出示例：

```
私钥:  ~/.tauri/we-health-tick.key
公钥:  ~/.tauri/we-health-tick.key.pub
```

- **私钥文件**：本地妥善保存，绝不入库；CI 构建时通过 Secret 注入。
- **公钥**：写入 `tauri.conf.json`，随客户端一起分发，用于校验更新包。

> 若生成时设置了密码，CI 还需配置 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。本项目当前密钥未设密码。

### 2. 配置公钥到 tauri.conf.json

`src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`：

```jsonc
{
  // ...
  "updater": {
    "active": true,
    "endpoints": [
      "https://github.com/oceanopen/we-health-tick-app/releases/latest/download/latest.json"
    ],
    "pubkey": "公钥Base64",
    "windows": {
      "installMode": "passive"
    }
  }
  // ...
}
```

同时 `bundle.createUpdaterArtifacts: true` 让 bundler 额外产出 updater 产物（自动更新必需），与 `targets: ["app", "dmg", "nsis"]` 共存。其中 `app` 是 macOS 上唯一 updater-enabled 的 target（产出 `.app.tar.gz` + `.sig`），`dmg` 只是首次安装包、不会产 updater 产物；`nsis` 在 Windows 上产出 `.exe` + `.exe.sig`。

### 3. 私钥配置到 GitHub Secret

仓库 **Settings → Secrets and variables → Actions → New repository secret**：

| Name                                 | Value                                        |
| ------------------------------------ | -------------------------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | `cat ~/.tauri/we-health-tick.key` 的完整内容 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | （可选）密钥密码，未设密码则不需要           |

> `GITHUB_TOKEN` 由 Actions 自动注入，无需手动配置。

---

## 二、GitHub Actions 工作流

### 1. `release-assets.yml` — 构建 + 签名 + 发布

`.github/workflows/release-assets.yml`：

- **触发**：push 匹配 `v*` 的 tag，或 Actions 页面手动触发。
- **矩阵**：`macos-latest`（universal：x86_64 + aarch64）/ `windows-latest`。
- **关键步骤**：`tauri-apps/tauri-action@v0`，仅当 `github.ref_type == 'tag'` 时执行 release：
  - 注入 `TAURI_SIGNING_PRIVATE_KEY` → 给 macOS `.app.tar.gz` / Windows `.exe` 签名生成 `.sig`
  - 生成 `latest.json` manifest（含版本、下载 URL、签名）
  - 上传 dmg / exe / `.app.tar.gz` / `*.sig` / `latest.json` 到 GitHub Release
- `updaterJsonPreferNsis: true`：Windows 在 `latest.json` 里走 nsis 的 `.exe` 路径而非 msi。

### 2. `release-notes.yml` — Release Notes 生成

`.github/workflows/release-notes.yml`：

- **触发**：push 匹配 `v*` 的 tag。
- **关键步骤**：`pnpx changelogithub` 根据 conventional commits 自动生成更新日志并创建 Release。

---

## 三、发版流程

本项目用 [`bumpp`](https://github.com/antfu/bumpp)（`pnpm release`）统一改版本号：

```bash
pnpm release
```

`bump.config.ts` 会同步更新：

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.lock`（通过自定义 `execute` 钩子）

bumpp 交互式选择 patch/minor/major 后，会自动：

1. 提交版本号变更 commit
2. 打 `v<x.y.z>` tag
3. push 到远端

push tag 后，两个 workflow 并行触发，约 10–15 分钟完成构建、签名和发布。

---

## 四、验证发布结果

发版完成后，到 Release 页面确认以下产物齐全：

- `We Health Tick_<ver>_universal.dmg` / `.app.tar.gz` / `.app.tar.gz.sig`（macOS）
- `We Health Tick_<ver>_x64-setup.exe` / `.exe.sig`（Windows）
- `latest.json`

直接访问 endpoints URL 验证 manifest 可达：

```
https://github.com/oceanopen/we-health-tick-app/releases/latest/download/latest.json
```

返回的 JSON 应包含当次版本号、各平台下载 URL 和 `signature` 字段。

---

## 五、故障排查

| 现象                                       | 可能原因                                                             |
| ------------------------------------------ | -------------------------------------------------------------------- |
| CI 报 `TAURI_SIGNING_PRIVATE_KEY` 相关错误 | Secret 未配置 / 值不完整（含尾部换行）/ 设了密码但未配 `*_PASSWORD`  |
| Release 没有 `latest.json`                 | workflow 触发时不是 tag，或 tauri-action 步骤被跳过                  |
| 客户端提示签名校验失败                     | 公钥与私钥不匹配，或产物被手动重新打包覆盖了签名                     |
| 客户端找不到更新                           | endpoints URL 与实际 Release 仓库不一致；或 latest.json 中版本号未升 |
| Windows 更新走错包格式                     | `updaterJsonPreferNsis` 与 `bundle.targets` 不一致                   |
