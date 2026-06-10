# We Health Tick

健康打卡桌面应用。

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | [Tauri](https://v2.tauri.app/) | v2 |
| 前端框架 | [React](https://react.dev/) | 19 |
| 类型系统 | [TypeScript](https://www.typescriptlang.org/) | 6 |
| 构建工具 | [Vite](https://vite.dev/) | 8 |
| 运行时 | [Node.js](https://nodejs.org/) | 20+ |
| 后端语言 | [Rust](https://www.rust-lang.org/) | Edition 2021 (MSRV 1.77.2) |
| 包管理 | [pnpm](https://pnpm.io/) | 10 |

## 环境准备

### 1. 安装 Rust

```bash
# macOS / Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

安装完成后重启终端，验证：

```bash
rustc --version
cargo --version
rustup --version
```

> Windows 用户请前往 [https://rustup.rs](https://rustup.rs) 下载安装器。

### 2. 安装 Node.js 和 pnpm

```bash
# 安装 Node.js（推荐 20+）
# 使用 nvm:
nvm install --lts

# 安装 pnpm
npm install -g pnpm@10
```

### 3. macOS 系统依赖

macOS 需要安装 Xcode Command Line Tools：

```bash
xcode-select --install
```

### 4. 安装项目依赖

```bash
pnpm install
```

## 开发调试

启动开发模式（前端热更新 + Rust 自动重编译）：

```bash
pnpm tauri dev
```

首次启动会编译 Rust 依赖，耗时较长。后续增量编译会快很多。

## 构建打包

### macOS（本地构建）

构建 macOS Universal Binary（同时支持 Intel 和 Apple Silicon）：

```bash
# 确保已安装两个 target
rustup target add x86_64-apple-darwin aarch64-apple-darwin

# 构建
pnpm tauri build --target universal-apple-darwin
```

产物位于 `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`。

如果只需要当前架构的构建：

```bash
pnpm tauri build
```

### Windows

Windows 构建需要在 Windows 环境下执行，macOS 无法直接交叉编译。推荐通过 GitHub Actions CI 自动构建。

### CI 自动构建（macOS + Windows）

项目配置了 GitHub Actions 工作流（`.github/workflows/build.yml`），支持自动构建多平台产物：

- **触发方式**：推送 `v*` 格式的 tag，或手动触发 workflow
- **产物命名**：
  - macOS: `WeHealthTick-{version}-macos-universal.dmg`
  - Windows: `WeHealthTick-{version}-windows-x64-setup.exe`

```bash
# 触发自动构建
git tag v0.1.0
git push origin v0.1.0
```

## 项目结构

```
├── src/                  # React 前端源码
├── src-tauri/            # Rust 后端源码
│   ├── src/              #   Rust 业务代码
│   ├── capabilities/     #   Tauri 权限配置
│   └── tauri.conf.json   #   Tauri 应用配置
├── public/               # 静态资源
├── package.json          # 前端依赖与脚本
├── vite.config.ts        # Vite 配置
└── tsconfig.json         # TypeScript 配置
```
