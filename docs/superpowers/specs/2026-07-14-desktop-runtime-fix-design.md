# Desktop Runtime 修复设计

## 目标

让当前 Tauri + React 桌面端在空模型配置的首次启动场景下完成前端构建，并让 Python Bridge 使用项目声明的运行依赖启动；未配置模型时，后台扩展服务不应因空 Mixin 配置导致启动异常。

## 方案

- 在 React 中文 i18n 中补齐模型添加向导使用的五个键，保持 `ZhKey` 的类型安全。
- 将 Conductor 实际导入的 `fastapi`、`uvicorn` 加入 `ui` 可选依赖；Bridge 已使用项目核心依赖中的 `aiohttp`。
- 将空 `mixin_config.llm_nos` 视为“尚未配置渠道组”，不构造 `MixinSession`；GenericAgent 在没有任何模型时保留空模型状态，并在真正调用模型时返回明确错误。
- Bridge 的 Conductor/Scheduler 继续由现有机制启动；空模型时它们保持可启动，实际执行任务时给出“未配置模型”的明确错误。

## 错误处理与兼容性

- 不修改用户已有的 `mykey.py` API 密钥和渠道配置。
- 非空但引用不存在的 `llm_nos` 仍视为配置错误并记录清晰错误，不静默选择错误模型。
- Python 版本继续遵守项目的 `>=3.10,<3.14` 要求。

## 验证

- React i18n 回归测试覆盖五个向导键，随后执行 TypeScript 构建。
- Python 配置测试覆盖空 Mixin 被忽略、有效 Mixin 仍保留。
- 执行前端单测、前端构建、Rust `cargo check`，并运行 `npm run tauri:dev` 验证 Vite/Tauri/Bridge 启动链。
