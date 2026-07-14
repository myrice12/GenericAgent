<div align="center">

<img src="assets/images/bar.jpg" width="760" alt="GenericAgent Banner" />

# GenericAgent

**一个轻量、可自我进化的本地 AI Agent 框架**

让模型能够理解任务、操作电脑，并把成功经验沉淀为可复用的 Skill。

[![License](https://img.shields.io/badge/license-MIT-6f7d68?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-8b9a8d?style=flat-square)](#桌面端)
[![Desktop](https://img.shields.io/badge/desktop-Tauri%20%2B%20React-b4a58c?style=flat-square)](#桌面端)

</div>

## 项目简介

GenericAgent 是一个本地优先的 AI Agent 框架。它用简洁的 Agent Loop 连接模型、浏览器、终端、文件系统和桌面操作能力，并支持通过 Skill 持续扩展自身。

项目适合：

- 构建个人 AI 助手；
- 自动化浏览器、文件和桌面任务；
- 编排多个 Agent 协作；
- 研究本地 Agent、记忆和自我进化机制。

## 核心能力

| 能力 | 说明 |
| --- | --- |
| Agent Loop | 让模型持续观察、思考、调用工具并完成任务 |
| 本地操作 | 支持浏览器、终端、文件、键鼠、屏幕和 ADB |
| Skill 系统 | 将成功任务沉淀为可复用的操作技能 |
| 多模型 | 支持 OpenAI 兼容接口和 Anthropic 原生 API |
| 多前端 | 支持桌面端、终端、Streamlit 和机器人接入 |
| 本地优先 | 配置、会话和记忆保存在本机 |

## 桌面端

桌面端采用 **Tauri 2 + React + Python Bridge**，目标是让普通用户安装后即可使用：

- macOS：一键安装 `.dmg`；
- Windows：标准安装程序 `.exe`；
- 无需预装 Python、Node.js 或 Rust；
- 首次启动可跳过配置；
- 在 App 内配置 OpenAI 兼容模型或 Anthropic；
- 支持连接测试、模型切换和故障转移组；
- 使用素雅、低干扰、宽留白的工作台界面。

### 桌面端进度

| 项目 | 状态 |
| --- | --- |
| Tauri + React 工作台 | ✅ 已完成基础版本 |
| Python Bridge 自动启动 | ✅ 已完成 |
| OpenAI / Anthropic 配置模型 | ✅ 基础能力已完成 |
| 首启配置向导 | 🚧 开发中 |
| 素雅工作台 UI | 🚧 开发中 |
| 内置 Python 运行时 | 🚧 开发中 |
| macOS `.dmg` | ⏳ 待构建验证 |
| Windows `.exe` | ⏳ 待 Windows 环境验证 |

设计方向参考 [OpenHanako](https://github.com/liliMozi/openhanako) 的素雅排版和面向普通用户的配置路径。

## 快速开始

### 开发环境

建议使用 Python 3.11 或 3.12，以及 Node.js、Rust 和 `uv`。

```bash
git clone https://github.com/myrice12/GenericAgent.git
cd GenericAgent

uv venv
uv pip install -e ".[ui]"

cd frontends/desktop
npm install
npm install --prefix web
npm run tauri:dev
```

### 配置模型

开发环境可以复制模板：

```bash
cp mykey_template.py mykey.py
```

桌面端产品化版本将支持直接在 App 内配置模型，不需要手动编辑 `mykey.py`。

## 项目结构

```text
GenericAgent/
├── agentmain.py              # Agent 主循环与会话运行时
├── llmcore.py                # 模型客户端与协议适配
├── frontends/desktop/        # Tauri + React 桌面端
├── frontends/desktop_bridge.py # 桌面端 Python Bridge
├── reflect/                  # 调度、自主运行和目标模式
├── memory/                   # 记忆系统与相关 SOP
├── plugins/                  # 插件与 Hook
├── assets/                   # 内置资源、提示词和工具 Schema
└── docs/                     # 安装、设计和开发文档
```

## 文档

- [桌面端产品化设计](docs/superpowers/specs/2026-07-14-desktop-productization-design.md)
- [桌面端产品化实现计划](docs/superpowers/plans/2026-07-14-desktop-productization.md)
- [安装指南（中文）](docs/installation_zh.md)
- [安装指南（English）](docs/installation.md)
- [快速上手](docs/GETTING_STARTED.md)
- [桌面端说明](frontends/desktop/README.md)

## 当前状态

当前主线正在推进桌面端产品化：优先完成素雅工作台、应用内模型配置和内置运行时，然后分别生成 macOS DMG 与 Windows EXE 安装包。

如果你希望参与开发，欢迎提交 Issue、改进 UI 或补充新的模型和前端适配。

## 许可证

本项目基于 [MIT License](LICENSE) 开源。
