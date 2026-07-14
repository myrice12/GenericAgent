# GenericAgent 项目进度

更新时间：2026-07-14

## 当前目标

将 GenericAgent 桌面端产品化，交付：

- macOS 一键安装 `.dmg`
- Windows 标准安装程序 `.exe`
- 用户无需预装 Python、Node.js 或 Rust
- App 内完成模型配置、连接测试和运行
- 采用素雅、低干扰、宽留白的工作台 UI

## 已完成

### 桌面端基础架构

- Tauri 2 + React + Vite 桌面端已建立。
- Tauri 启动时自动拉起 Python Bridge。
- Bridge 使用 `127.0.0.1:14168` 提供 HTTP/WS API。
- 开发环境优先使用项目 `.venv`，避免误用系统 Python 3.9。
- Bridge、Conductor、Scheduler 的启动链已验证。

### 模型配置

- 已支持模型配置列表和 `mykey.py` 持久化。
- 已支持 OpenAI 兼容协议和 Anthropic 原生协议字段。
- 已支持模型新增、编辑、删除和渠道组成员管理。
- 空 Mixin 配置不再触发 `BAD Mixin config`。
- 没有模型时 Scheduler 会跳过自动启动，不再产生误导性失败。

### 当前 UI 基础

- React 页面已包含聊天、协作、服务和用量页面。
- 已加入模型配置组件和提供商预设结构。
- 已完成“素雅工作台”视觉原型，当前选定方向为 A：
  - 米白背景
  - 柔和 beige 边框
  - 橄榄绿强调色
  - 窄侧栏
  - 宽松留白
  - 清晰的标题与正文层级
- 首启配置采用可跳过模式：可以先进入空工作台，之后再配置模型。

### 验证结果

- React 测试：16 个测试通过。
- Python 配置测试：3 个测试通过。
- React TypeScript 生产构建通过。
- Rust `cargo check` 通过。
- Tauri 开发启动通过。
- Bridge `/status` 返回 `ready: true`。

## 正在进行

### 1. 素雅工作台 UI

- 重做主布局、侧栏、聊天区、空状态和状态条。
- 将设置、模型、服务、用量统一为一致的卡片式界面。
- 增加更完整的首启配置向导。
- 优化 OpenAI/Anthropic 模型配置表单和连接测试反馈。

### 2. 应用内配置闭环

- 增加“测试连接”接口，不写入配置文件即可验证模型。
- 增加模型连接错误脱敏和可读提示。
- 保存模型后立即刷新运行中的 Agent，无需重启 App。
- 增加运行时诊断页，显示 Bridge、Python runtime 和服务状态。

### 3. 一键安装包

- 打包内置 CPython 3.11 和 Python 依赖。
- 配置 Tauri DMG 输出。
- 配置 Windows NSIS EXE 安装程序。
- 配置快捷方式、卸载和用户配置保留。
- 在干净机器上验证安装包不依赖系统 Python/Node/Rust。

## 下一步计划

1. 完成 A 方案素雅 UI 实现。
2. 完成首启向导和 OpenAI/Anthropic 连接测试。
3. 完成生产 runtime 构建器。
4. 生成并验证 macOS `.dmg`。
5. 在 Windows x64 环境生成并验证 `.exe`。
6. 补充安装文档和发布流程。

## 关键入口

| 路径 | 用途 |
| --- | --- |
| `frontends/desktop/` | Tauri 桌面端 |
| `frontends/desktop/web/` | React 前端 |
| `frontends/desktop/src-tauri/` | Tauri/Rust 壳 |
| `frontends/desktop_bridge.py` | Python Bridge |
| `docs/superpowers/specs/2026-07-14-desktop-productization-design.md` | 产品化设计规格 |
| `docs/superpowers/plans/2026-07-14-desktop-productization.md` | 产品化实现计划 |

## 开发启动

```bash
cd frontends/desktop
npm install
npm install --prefix web
npm run tauri:dev
```

## 当前限制

- 当前工作区尚未生成最终 DMG/EXE 安装包。
- macOS 签名、公证和 Windows 代码签名需要发布环境证书。
- 当前 `mykey.py` 没有真实模型时，聊天功能需要先在 App 内添加模型。
