# Desktop Runtime 修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 React 构建错误、补齐桌面端 Python 依赖，并让空 Mixin 配置下的桌面后台服务可启动。

**架构：** 保持 Tauri + React + `desktop_bridge.py` 现有边界。前端只补齐类型安全的文案；Python 侧在模型配置解析边界过滤空 Mixin，并让无模型状态显式可诊断。

**技术栈：** React 18、TypeScript、Vitest、Python 3.10+、pytest、Tauri 2、Rust。

---

## 文件结构

- 修改 `frontends/desktop/web/src/i18n/zh.ts`：补齐模型向导文案。
- 创建 `frontends/desktop/web/src/i18n/zh.test.ts`：锁定向导键存在。
- 修改 `pyproject.toml`：声明 Conductor 的 FastAPI/Uvicorn 依赖。
- 修改 `agentmain.py`：过滤空 Mixin、维护空模型状态并提供明确错误。
- 创建 `tests/test_agent_config.py`：覆盖空 Mixin 和有效 Mixin 的解析行为。

### 任务 1：补齐 React i18n 键

- [ ] 在 `frontends/desktop/web/src/i18n/zh.test.ts` 中断言五个 `guide.*` 键存在。
- [ ] 运行 `npm test --prefix frontends/desktop/web -- --run`，确认测试因缺少键失败。
- [ ] 在 `frontends/desktop/web/src/i18n/zh.ts` 增加五条中文文案。
- [ ] 重新运行该测试和 `npm run build:web --prefix frontends/desktop`，确认通过。

### 任务 2：声明桌面端 Python 依赖

- [ ] 在 `pyproject.toml` 的 `ui` extra 增加 `fastapi>=0.100` 和 `uvicorn>=0.23`。
- [ ] 用 TOML 解析检查 `ui` extra 包含两项依赖，避免只改注释或错误区段。

### 任务 3：修复空 Mixin 的运行时处理

- [ ] 在 `tests/test_agent_config.py` 先覆盖空 `llm_nos` 被跳过、有效引用仍保留。
- [ ] 运行测试确认当前实现会把空 Mixin 当作模型并失败。
- [ ] 修改 `agentmain.py`：只把 `llm_nos` 非空的 Mixin 加入待构造列表；无模型时设置 `llmclients=[]`、`llmclient=None`，模型操作抛出明确的配置错误。
- [ ] 运行 Python 回归测试并检查现有 Agent 相关测试/导入。

### 任务 4：端到端验证

- [ ] 运行前端完整单测。
- [ ] 运行 React 构建和 `cargo check`。
- [ ] 执行 `npm run tauri:dev`，确认 Vite、Tauri 和 Bridge 启动，并检查不再出现 `BAD Mixin config`；无模型时只保留明确的未配置提示。
- [ ] 检查 `git diff`，确保不覆盖用户原有桌面端改动。
