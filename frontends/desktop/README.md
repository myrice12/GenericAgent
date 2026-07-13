# Desktop（Tauri + React）

本机桌面端默认入口：嵌入式 React UI（`web/`）+ Tauri（`src-tauri/`）。Python Bridge 由 Tauri 在启动时拉起，监听 `127.0.0.1:14168`（**仅 API**，WebView 不再导航到该端口的静态页）。

## 前置条件

- Node.js / npm
- [Rust](https://www.rust-lang.org/tools/install) 与 Tauri 2 工具链（`npm run tauri:dev` 会通过 `@tauri-apps/cli` 调用）
- 仓库根目录已配置好 `mykey.py` 与 Python 依赖（`uv pip install -e ".[ui]"` 等）

## 默认启动

在仓库根目录下：

```bash
cd frontends/desktop
npm install
npm install --prefix web
npm run tauri:dev
```

## 备用入口

- Streamlit Web UI：在仓库根运行 `python launch.pyw`
- 旧静态资源仍保留在 `static/`（Bridge / 兼容用途）；日常开发以 `web/` React 为准

## 目录概要

| 路径 | 说明 |
| :--- | :--- |
| `web/` | React + Vite 前端（聊天 / 指挥家 / 服务 / 用量） |
| `src-tauri/` | Tauri 壳，负责拉起 Bridge 与嵌入前端 |
| `static/` | 既有静态页（保留，非默认开发入口） |
