# GenericAgent 桌面 GUI 重做设计

**日期：** 2026-07-14  
**状态：** 已确认设计方向，待实现  
**范围：** 用 React + Vite + Tauri 重做桌面 GUI（中文优先、冷色工作台），复用 `desktop_bridge.py`，四页能力对齐现有 `frontends/desktop/static`。

---

## 目标

把当前以 Streamlit（`launch.pyw`）和静态前端为主的桌面体验，升级为常见前端架构下的本机工作台：默认中文、深色冷色视觉、四页功能对齐，长期更易扩展。

## 已确认决策

| 项 | 选择 |
|----|------|
| 改造路径 | 复用 Bridge，新建 React 前端（不重写 Agent / 不新写第二套 Bridge） |
| 前端 | React + Vite + TypeScript |
| 桌面壳 | Tauri（仓库已有 `frontends/desktop/src-tauri`） |
| 视觉 | 冷色工作台：深色默认 + 蓝色强调 |
| 语言 | 中文优先；英文切换可保留但不作为一期重点 |
| 一期范围 | 四页对齐：对话 / 协作 / 服务 / Token |
| 旧入口 | 保留 `python launch.pyw`（Streamlit）作备用，文档标明非默认 |

## 非目标（一期）

- 不重写 Agent 核心或 LLM 调用链
- 不新写第二套 Bridge API
- 不把桌面宠物、IM Bot 并入 React（继续由 Bridge / 现有脚本管理）
- 不做浅色主题打磨（可二期）
- 不追求与现有 static 像素级一致，但交互与能力要对齐

---

## 架构

```
Tauri App（窗口 · 生命周期）
  └─ React + Vite（中文 UI · 冷色工作台）
       └─ HTTP / WS → desktop_bridge.py
            └─ GeneraticAgent / 会话 / 服务启停 / 配置 / Token
```

- **命令与查询：** React → HTTP → Bridge  
- **状态推送：** Bridge WebSocket → React（服务快照/变更等；流式消息按现有 Bridge 约定）  
- **Tauri 职责：** 窗口、拉起/停止 Bridge、加载前端构建产物；业务逻辑不进入 Rust  

### 目录规划

| 路径 | 职责 |
|------|------|
| `frontends/desktop/web/` | 新建 React + Vite + TS 应用 |
| `frontends/desktop/src-tauri/` | 更新 `frontendDist` 指向 web 构建输出；按需补 Bridge 拉起逻辑 |
| `frontends/desktop/static/` | 一期保留作行为对照，稳定后再归档/删除 |
| `frontends/desktop_bridge.py` | 复用；仅在对接缺口时小改 |
| `launch.pyw` / `frontends/stapp.py` | 备用入口，非默认 |

---

## 界面与视觉

### 布局

三栏（对话页）：

1. **左侧导航：** 品牌「Generic Agent」+ 副标题「本机智能体工作台」；导航项「对话 / 协作 / 服务 / Token」；底部模型切换  
2. **中间主区：** 顶栏（会话标题、强行停止、设置）+ 消息流 + 底部输入（占位「输入消息…」）+ 发送  
3. **右侧会话列表：** 新建/切换会话；当前会话高亮  

协作 / 服务 / Token 页复用左侧导航骨架，主区按各页内容切换。

### 视觉 Token（冷色工作台）

- 背景 `#0f1419`  
- 面板 `#12181f`  
- 强调 `#3d9cf0`  
- 扁平、信息优先；无紫色渐变、无大面积发光  

---

## 四页功能规格

行为真源：现有 `frontends/desktop/static/` + Bridge API。React 逐页复刻交互；若接口缺失，优先小补 Bridge，前端不做假数据。

### 1. 对话

- 会话列表：新建 / 切换 / 删除（以 Bridge 已支持能力为准）  
- 发消息、流式回复、强行停止  
- 模型选择、附件上传（对齐现有 composer）  
- 中文空态引导（对应现 `chat.startTitle` / `chat.startSub`）  

### 2. 协作（Conductor）

- 独立协作聊天区 + 引导步骤  
- 运行状态开关、重试、进度侧栏（workers / 统计）  
- 快捷芯片：进度 / 暂停 / 摘要  

### 3. 服务

- Tab：消息通道 · 状态面板  
- 通道列表启停（对接 `/services/*`）  
- 状态列表展示运行信息  

### 4. Token

- Tab：全部 / Conductor  
- 日期筛选、重置、汇总数字、明细表  

---

## 启动与发布

### 开发

1. 启动 `desktop_bridge.py`  
2. `vite dev`（可浏览器调试）  
3. `tauri dev` 打开桌面窗口  

### 发布

Vite build → Tauri bundle（dmg / nsis）；应用启动时拉起 Bridge。

### 备用

`python launch.pyw` 仍可启动 Streamlit 壳；README / 文档标注为旧入口。

---

## 成功标准

1. Tauri 打开后默认中文、深色冷色 UI  
2. 四页可进入；核心路径可用（发消息有回复、服务能看状态、Token 有数字）  
3. 不破坏现有 Agent / Bridge 主路径  
4. Streamlit 入口仍能启动（即使非默认）  

### 建议实现节奏

脚手架 + 主题壳 → 对话页接通 Bridge → 协作 → 服务 → Token → Tauri 打包冒烟  

---

## 规格自检记录

- 无 TODO / 待定占位  
- 架构与四页范围一致（复用 Bridge + 全量对齐）  
- 一期边界明确（不重写 Agent、不并宠物/IM）  
- 「对齐」指能力与交互，非像素级复刻——已写明  
