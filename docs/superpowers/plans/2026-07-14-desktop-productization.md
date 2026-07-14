# GenericAgent 桌面端产品化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将当前 Tauri + React 桌面端升级为可跳过首启配置、支持 OpenAI/Anthropic 的素雅工作台，并生成无需预装 Python/Node/Rust 的 macOS `.dmg` 与 Windows NSIS `.exe` 安装包。

**架构：** React 负责工作台、首启向导和配置页；Bridge 负责模型配置持久化、连接测试和运行时状态；Tauri 负责窗口、内置 Python runtime、安装包资源和平台启动。生产包将项目代码放入 `runtime/app`，把平台对应的 CPython 3.11 与依赖放入 `runtime/python`，Bridge 只使用包内 runtime。

**技术栈：** React 18、TypeScript、Vite、Vitest、Tauri 2、Rust、Python 3.11、aiohttp、FastAPI、Uvicorn、NSIS、DMG。

---

## 文件结构

### 前端

- 修改 `frontends/desktop/web/src/styles/theme.css`：素雅工作台颜色、字体、间距和阴影变量。
- 修改 `frontends/desktop/web/src/styles/app.css`：侧栏、聊天、设置卡片、向导、状态条和响应式布局。
- 修改 `frontends/desktop/web/src/layout/Shell.tsx`：窄侧栏、设置入口、Bridge/模型状态入口。
- 修改 `frontends/desktop/web/src/App.tsx`：首启检查、配置向导、设置页和空工作台状态。
- 创建 `frontends/desktop/web/src/components/SetupWizard.tsx`：可跳过的首次配置流程。
- 修改 `frontends/desktop/web/src/components/SettingsModal.tsx`：统一模型、渠道组、服务和 mykey 操作入口。
- 修改 `frontends/desktop/web/src/settings/providerPresets.ts`：OpenAI 兼容预设和 Anthropic 原生预设。
- 修改 `frontends/desktop/web/src/api/bridge.ts`：连接测试、首启状态和运行时诊断 API。
- 创建 `frontends/desktop/web/src/components/EmptyWorkspace.tsx`：无模型时的工作台引导。
- 创建 `frontends/desktop/web/src/components/StatusBar.tsx`：Bridge、模型和服务状态。
- 创建 `frontends/desktop/web/src/**/*.test.tsx`：向导跳过、表单校验、预设和状态展示测试。

### Python Bridge

- 修改 `frontends/desktop_bridge.py`：新增 `/model-profiles/test`、`/runtime/diagnostics` 和首次配置状态接口。
- 修改 `frontends/desktop_bridge.py`：连接测试使用临时配置，不覆盖 `mykey.py`；成功返回模型名称，失败返回脱敏后的可读错误。
- 修改 `frontends/desktop_bridge.py`：保存模型后立即重载 live agents，继续保留历史。
- 修改 `config_utils.py`：抽取模型配置有效性和脱敏错误工具。
- 创建 `tests/test_model_config.py`：API/Anthropic 配置校验、空配置、错误脱敏和连接测试输入测试。

### Tauri 与运行时

- 修改 `frontends/desktop/src-tauri/src/lib.rs`：生产包只使用 `runtime/python`，开发模式才回退 `.venv`/系统解释器；启动前验证 `runtime/app/agentmain.py` 和 Python 可执行文件。
- 修改 `frontends/desktop/src-tauri/tauri.conf.json`：注册 `runtime/`、安装资源和 NSIS/DMG 配置。
- 修改 `frontends/desktop/src-tauri/Cargo.toml`：仅在需要时补充资源/窗口相关依赖，保持现有 Tauri 2 结构。
- 创建 `scripts/build_desktop_runtime.py`：复制应用运行文件、下载/准备 CPython 3.11、安装锁定依赖并生成 runtime manifest。
- 创建 `scripts/build_desktop_runtime.sh`：macOS/Linux 构建包装脚本。
- 创建 `scripts/build_desktop_runtime.ps1`：Windows 构建包装脚本。
- 修改 `frontends/desktop/package.json`：增加 `runtime:prepare`、`bundle:mac`、`bundle:windows` 和 `bundle` 命令。
- 修改 `frontends/desktop/README.md`：记录开发启动、打包前置条件、输出目录和签名变量。

### 文档

- 修改 `docs/installation_zh.md`：新增 DMG/EXE 用户安装说明和首次配置说明。
- 修改 `README.md`：将桌面端安装包作为普通用户默认入口，保留源码开发入口。

---

## 任务 1：建立打包与运行时验收基线

**文件：**

- 创建：`scripts/build_desktop_runtime.py`
- 创建：`tests/test_runtime_layout.py`
- 修改：`frontends/desktop/src-tauri/src/lib.rs`

- [ ] **步骤 1：编写失败测试**

```python
def test_runtime_layout_requires_python_and_agent(runtime_root):
    assert validate_runtime_layout(runtime_root) == []
```

- [ ] **步骤 2：运行测试确认失败**

运行：`python3 -m pytest -q tests/test_runtime_layout.py`

预期：FAIL，提示 `validate_runtime_layout` 尚未定义。

- [ ] **步骤 3：实现 runtime 布局校验**

校验以下路径存在且可执行：`runtime/app/agentmain.py`、`runtime/app/frontends/desktop_bridge.py`、macOS/Linux 的 `runtime/python/bin/python3` 或 Windows 的 `runtime/python/python.exe`。返回所有缺失项，不在首个错误处退出。

- [ ] **步骤 4：运行测试确认通过**

运行：`python3 -m pytest -q tests/test_runtime_layout.py`

预期：布局完整 fixture 通过，缺失文件 fixture 返回对应错误。

- [ ] **步骤 5：让 Tauri 使用同一校验规则**

在 `lib.rs` 中让 `bundle_python()` 和 `find_project_dir()` 优先识别 `runtime/python`、`runtime/app`，缺失时显示资源诊断，而不是回退到用户机器的 Python。

## 任务 2：实现跨平台 runtime 构建器

**文件：**

- 修改：`scripts/build_desktop_runtime.py`
- 创建：`scripts/runtime_requirements.txt`
- 创建：`scripts/build_desktop_runtime.sh`
- 创建：`scripts/build_desktop_runtime.ps1`

- [ ] **步骤 1：锁定生产依赖**

将项目核心依赖、`aiohttp`、`fastapi`、`uvicorn`、`websockets` 和 Bridge 实际导入依赖写入 `scripts/runtime_requirements.txt`，版本使用当前项目兼容范围。

- [ ] **步骤 2：实现应用文件复制**

构建器将根目录 Python 源码、`assets/`、`frontends/`、`reflect/`、`memory/`、`plugins/`、`ga_cli/` 和 `mykey_template.py` 复制到 `runtime/app`；排除 `.git`、`.venv`、`node_modules`、`target`、测试缓存和用户 session 数据。

- [ ] **步骤 3：实现 Python 3.11 runtime 准备**

构建器调用 `uv python install 3.11`，将解释器复制到平台 runtime 目录，再使用该解释器安装锁定依赖；构建结束写入 `runtime/manifest.json`，包含 Python 版本、平台、构建 commit 和依赖哈希。

- [ ] **步骤 4：实现两个平台包装脚本**

macOS/Linux 使用 `python3 scripts/build_desktop_runtime.py --platform current`；Windows PowerShell 使用 `py -3.11 scripts/build_desktop_runtime.py --platform windows`。两个脚本都在 runtime 构建失败时返回非零退出码。

- [ ] **步骤 5：用临时目录执行构建器**

运行：`python3 scripts/build_desktop_runtime.py --output /tmp/genericagent-runtime-test`

预期：生成完整 runtime 目录和 manifest，且源码目录不被写入用户配置或运行 session。

## 任务 3：完善 Bridge 配置测试与运行时诊断

**文件：**

- 修改：`frontends/desktop_bridge.py`
- 修改：`config_utils.py`
- 修改：`frontends/desktop/web/src/api/bridge.ts`
- 创建：`tests/test_model_config.py`
- 创建：`frontends/desktop/web/src/api/bridgeConfig.test.ts`

- [ ] **步骤 1：编写失败测试**

```python
def test_test_profile_does_not_write_mykey(tmp_path):
    before = (tmp_path / "mykey.py").read_text()
    result = test_model_profile({"protocol": "claude", "model": "claude-sonnet", "apikey": "secret", "apibase": "https://example.test"})
    assert result["ok"] is True
    assert (tmp_path / "mykey.py").read_text() == before
```

- [ ] **步骤 2：运行测试确认失败**

运行：`python3 -m pytest -q tests/test_model_config.py`

预期：FAIL，Bridge 尚无临时连接测试函数。

- [ ] **步骤 3：实现临时配置连接测试**

新增 `AgentManager.test_model_profile(data)`：复用 `_build_cfg` 的必填校验；按 `protocol` 创建一次性 client；只执行最小请求/握手；无论成功失败都不调用 `_save_mykey_text`；异常消息移除 API Key、Authorization header 和完整 URL query。

- [ ] **步骤 4：增加 API 路由**

注册 `POST /model-profiles/test`，返回 `{ok, model, provider, error?}`；路由必须放在 `/model-profiles/{id}` 之前，避免被路径参数捕获。

- [ ] **步骤 5：实现前端 API 和单测**

新增 `testModelProfile(body)`，测试它使用 `POST /model-profiles/test` 且不触发保存接口。

- [ ] **步骤 6：运行测试确认通过**

运行：`python3 -m pytest -q tests/test_model_config.py && npm test --prefix frontends/desktop/web -- --run src/api/bridgeConfig.test.ts`

预期：Python 和 Vitest 测试全部通过。

## 任务 4：重做素雅工作台视觉系统

**文件：**

- 修改：`frontends/desktop/web/src/styles/theme.css`
- 修改：`frontends/desktop/web/src/styles/app.css`
- 修改：`frontends/desktop/web/src/layout/Shell.tsx`
- 修改：`frontends/desktop/web/src/pages/ChatPage.tsx`
- 创建：`frontends/desktop/web/src/components/EmptyWorkspace.tsx`
- 创建：`frontends/desktop/web/src/components/StatusBar.tsx`

- [ ] **步骤 1：编写视觉行为测试**

测试 `EmptyWorkspace` 在没有模型时显示配置入口，在存在模型时不显示阻塞提示；测试 `Shell` 显示设置入口并能切换页面。

- [ ] **步骤 2：运行测试确认失败**

运行：`npm test --prefix frontends/desktop/web -- --run src/components/workspace.test.tsx`

预期：FAIL，组件和设置入口尚不存在。

- [ ] **步骤 3：定义 A 方案设计 token**

使用米白 `#f7f5ef`、暖白卡片、浅灰 beige 边框、橄榄绿强调色和深灰文字；统一圆角、阴影、间距和 15–16px 正文排版；保留高对比度 focus ring。

- [ ] **步骤 4：实现工作台空状态和状态条**

当 Bridge ready 但模型列表为空时，显示“添加模型 / 稍后配置”两个动作；状态条显示 Bridge、当前模型和后台服务状态，错误只在局部显示。

- [ ] **步骤 5：重排聊天页和侧栏**

把导航收窄，使用图标/文字组合；聊天区增加页面眉题、会话标题、柔和消息卡片和圆角输入框；设置入口固定在侧栏底部。

- [ ] **步骤 6：运行组件测试和构建**

运行：`npm test --prefix frontends/desktop/web -- --run src/components/workspace.test.tsx && npm run build:web --prefix frontends/desktop`

预期：测试通过，Vite 输出 `dist/`。

## 任务 5：实现可跳过的首启配置向导

**文件：**

- 创建：`frontends/desktop/web/src/components/SetupWizard.tsx`
- 修改：`frontends/desktop/web/src/App.tsx`
- 修改：`frontends/desktop/web/src/components/SettingsModal.tsx`
- 修改：`frontends/desktop/web/src/settings/providerPresets.ts`
- 修改：`frontends/desktop/web/src/i18n/zh.ts`
- 创建：`frontends/desktop/web/src/components/SetupWizard.test.tsx`

- [ ] **步骤 1：编写失败测试**

覆盖三条行为：首次启动显示向导；点击“稍后配置”进入工作台；选择 OpenAI/Anthropic 预设会填充协议、Base URL 和模型。

- [ ] **步骤 2：运行测试确认失败**

运行：`npm test --prefix frontends/desktop/web -- --run src/components/SetupWizard.test.tsx`

预期：FAIL，`SetupWizard` 尚不存在。

- [ ] **步骤 3：持久化首启状态**

使用 `localStorage` key `ga.setup.dismissed.v1` 记录跳过；模型保存成功后也写入该 key。不要把 API Key 放进 localStorage。

- [ ] **步骤 4：实现 Provider 预设**

至少提供 OpenAI、DeepSeek、通义千问、Moonshot、Anthropic；OpenAI 类预设使用 `protocol: 'oai'`，Anthropic 使用 `protocol: 'claude'` 和 `https://api.anthropic.com`。

- [ ] **步骤 5：实现向导动作**

“测试连接”调用 `testModelProfile`；成功后可保存并进入工作台；失败保留输入并在字段下方显示错误；“稍后配置”不清空已输入内容以外的用户设置。

- [ ] **步骤 6：运行测试确认通过**

运行：`npm test --prefix frontends/desktop/web -- --run src/components/SetupWizard.test.tsx && npm run build:web --prefix frontends/desktop`

预期：向导测试通过，生产构建通过。

## 任务 6：补齐 Anthropic 与模型配置体验

**文件：**

- 修改：`frontends/desktop/web/src/settings/ModelFormModal.tsx`
- 修改：`frontends/desktop/web/src/components/SettingsModal.tsx`
- 修改：`frontends/desktop/web/src/settings/providerPresets.ts`
- 修改：`frontends/desktop/web/src/styles/app.css`
- 创建：`frontends/desktop/web/src/settings/ModelFormModal.test.tsx`

- [ ] **步骤 1：编写失败测试**

覆盖 Claude 协议显示 Anthropic 专属提示、留空 API Key 编辑时保留原 Key、必填校验阻止保存、连接测试使用当前未保存表单。

- [ ] **步骤 2：运行测试确认失败**

运行：`npm test --prefix frontends/desktop/web -- --run src/settings/ModelFormModal.test.tsx`

预期：FAIL，当前组件没有统一测试入口或测试按钮行为不完整。

- [ ] **步骤 3：实现表单**

保留现有高级字段；新增“测试连接”按钮和 loading 状态；新增/编辑使用相同的协议字段；API Key 输入始终为 password；显示 Anthropic 原生协议说明。

- [ ] **步骤 4：实现设置页分区**

以卡片分组模型、渠道组、mykey 导入/导出和服务管理；删除最后一个模型时提示不能删除；渠道组成员显示显示名而非密钥。

- [ ] **步骤 5：运行测试确认通过**

运行：`npm test --prefix frontends/desktop/web -- --run src/settings/ModelFormModal.test.tsx && npm run build:web --prefix frontends/desktop`

预期：表单测试和构建通过。

## 任务 7：实现 Tauri 首启窗口与生产 runtime 诊断

**文件：**

- 修改：`frontends/desktop/src-tauri/src/lib.rs`
- 修改：`frontends/desktop/src-tauri/tauri.conf.json`
- 修改：`frontends/desktop/web/src/api/bridge.ts`
- 创建：`frontends/desktop/web/src/components/RuntimeDiagnostics.tsx`

- [ ] **步骤 1：编写失败测试**

测试 bundle 缺少 `runtime/python` 时返回明确诊断；开发环境仍使用 `.venv`；生产环境不读取过期的 `~/.ga_desktop_settings.json` runtime 路径。

- [ ] **步骤 2：实现生产路径优先级**

生产：`bundle_python()` → 校验 runtime manifest → 启动；开发：项目 `.venv` → portable Python → 系统 Python。所有失败消息包含缺失路径和修复动作。

- [ ] **步骤 3：实现设置窗口回退**

Bridge 未就绪时显示 runtime 路径、manifest 版本和“重试/打开日志”动作；不要弹出系统 Python 安装教程作为唯一选项。

- [ ] **步骤 4：运行 Rust 检查**

运行：`cargo check --manifest-path frontends/desktop/src-tauri/Cargo.toml`

预期：检查通过。

## 任务 8：配置 DMG/EXE 打包和文档

**文件：**

- 修改：`frontends/desktop/src-tauri/tauri.conf.json`
- 修改：`frontends/desktop/package.json`
- 修改：`frontends/desktop/README.md`
- 修改：`docs/installation_zh.md`
- 修改：`README.md`

- [ ] **步骤 1：配置资源和 target**

设置 `bundle.targets` 为 `dmg`、`nsis`，将 `runtime/`、manifest 和图标加入 bundle resources；NSIS 配置安装目录、开始菜单快捷方式、桌面快捷方式和卸载；DMG 设置 Applications 拖拽布局。

- [ ] **步骤 2：增加 npm 命令**

```json
{
  "runtime:prepare": "python3 ../../scripts/build_desktop_runtime.py --output runtime",
  "bundle:mac": "npm run runtime:prepare && tauri build --bundles dmg",
  "bundle:windows": "powershell -ExecutionPolicy Bypass -File ../../scripts/build_desktop_runtime.ps1 && tauri build --bundles nsis",
  "bundle": "npm run bundle:mac"
}
```

Windows 命令使用 PowerShell 版本，不能假设 Windows 有 `python3` 命令；macOS 命令在 Python runtime 构建失败时停止。

- [ ] **步骤 3：更新用户文档**

说明普通用户只需下载安装包并在 App 内配置模型；开发者仍使用 `npm run tauri:dev`；发布签名变量仅在 CI 设置。

- [ ] **步骤 4：本机验证 macOS 包**

运行：`npm run bundle:mac --prefix frontends/desktop`

预期：`frontends/desktop/src-tauri/target/release/bundle/dmg/GenericAgent_*.dmg` 生成并可打开。

- [ ] **步骤 5：Windows CI 验证**

在 Windows x64 runner 运行：`npm run bundle:windows --prefix frontends/desktop`

预期：生成 `target/release/bundle/nsis/GenericAgent_*.exe`，安装后快捷方式、启动和卸载均成功。

## 任务 9：完整回归和发布验收

**文件：**

- 修改：`docs/superpowers/plans/2026-07-14-desktop-productization.md`
- 测试：所有前端/Python/Rust/打包检查

- [ ] **步骤 1：运行全量前端测试**

运行：`npm test --prefix frontends/desktop/web -- --run`

预期：所有测试通过，包含向导、模型表单和 Bridge API 测试。

- [ ] **步骤 2：运行 Python 测试和语法检查**

运行：`python3 -m pytest -q && python3 -m compileall -q agentmain.py frontends/desktop_bridge.py frontends/conductor.py reflect`

预期：无失败、无语法错误。

- [ ] **步骤 3：运行 Tauri 开发启动验收**

运行：`npm run tauri:dev --prefix frontends/desktop`

验收：Vite ready、Bridge `/status` ready、空配置可进入工作台、Conductor/Scheduler 不出现误导性错误。

- [ ] **步骤 4：检查产物和工作区**

运行：`git diff --check && git status --short && find frontends/desktop/src-tauri/target/release/bundle -maxdepth 3 -type f`

验收：DMG/NSIS 产物存在，运行时资源完整，未覆盖用户配置，未把 API Key 写入日志或前端存储。

- [ ] **步骤 5：更新计划状态并交付**

将本计划完成项勾选，记录实际命令输出和平台限制；只有在最新构建/测试证据齐全后才报告完成。
