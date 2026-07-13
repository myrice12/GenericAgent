# Desktop React + Tauri GUI 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 用 React + Vite + TypeScript 重做 GenericAgent 桌面 GUI（中文优先、冷色工作台），经 Tauri 启动并复用 `desktop_bridge.py`（+ Conductor `:8900`），四页能力对齐现有 `static/`。

**架构：** Tauri 拉起 Bridge（`:14168`）后展示**内嵌** React 构建产物（不再 `navigate` 到 Bridge 静态首页）。React 用 HTTP/WS 调 Bridge；协作页另连 Conductor `:8900`。旧 `static/` 一期保留对照；`launch.pyw` 作备用入口。

**技术栈：** React 18 · Vite · TypeScript · Vitest · CSS 变量主题 · Tauri 2 · 现有 `desktop_bridge.py` / `conductor.py`

**规格：** `docs/superpowers/specs/2026-07-14-desktop-react-tauri-design.md`

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `frontends/desktop/web/package.json` | Vite/React/Vitest 依赖与脚本 |
| `frontends/desktop/web/vite.config.ts` | 构建到 `dist/`；dev 代理可选 |
| `frontends/desktop/web/tsconfig.json` | TS 严格配置 |
| `frontends/desktop/web/index.html` | Vite 入口 HTML |
| `frontends/desktop/web/src/main.tsx` | React 挂载 |
| `frontends/desktop/web/src/styles/theme.css` | 冷色工作台 CSS 变量 |
| `frontends/desktop/web/src/styles/app.css` | 布局骨架 |
| `frontends/desktop/web/src/i18n/zh.ts` | 中文文案（一期默认） |
| `frontends/desktop/web/src/i18n/index.ts` | `t(key)` |
| `frontends/desktop/web/src/api/ports.ts` | `BRIDGE_PORT=14168`、`CONDUCTOR_PORT=8900` |
| `frontends/desktop/web/src/api/http.ts` | JSON fetch 封装 |
| `frontends/desktop/web/src/api/bridge.ts` | Bridge REST 客户端 |
| `frontends/desktop/web/src/api/bridgeWs.ts` | Bridge WS 状态通道 |
| `frontends/desktop/web/src/api/conductor.ts` | Conductor HTTP/WS（协作页） |
| `frontends/desktop/web/src/api/*.test.ts` | 客户端单测（mock fetch） |
| `frontends/desktop/web/src/App.tsx` | 路由级页面切换（chat/collab/services/token） |
| `frontends/desktop/web/src/layout/Shell.tsx` | 左导航 + 主区槽位 |
| `frontends/desktop/web/src/layout/SessionRail.tsx` | 右侧会话列表 |
| `frontends/desktop/web/src/pages/ChatPage.tsx` | 对话页 |
| `frontends/desktop/web/src/pages/CollabPage.tsx` | 协作/指挥家 |
| `frontends/desktop/web/src/pages/ServicesPage.tsx` | 服务页 |
| `frontends/desktop/web/src/pages/TokenPage.tsx` | Token/用量页 |
| `frontends/desktop/web/src/components/Composer.tsx` | 输入框 + 发送 |
| `frontends/desktop/web/src/components/MessageList.tsx` | 消息列表 + 轮询增量 |
| `frontends/desktop/web/src/hooks/useSessionMessages.ts` | poll `/session/{id}/messages` |
| `frontends/desktop/src-tauri/tauri.conf.json` | `frontendDist` → `../web/dist`；devUrl |
| `frontends/desktop/package.json` | 增加 web 脚本 / tauri beforeDevCommand |
| `frontends/desktop/src-tauri/src/lib.rs` | Bridge 就绪后**不要** navigate 到 `:14168/`；显示内嵌前端 |
| `frontends/desktop/static/` | 只读对照，本计划不删 |
| `README.md`（可选小改） | 标明默认桌面入口为 Tauri，`launch.pyw` 备用 |

**行为真源（只读对照，不要整文件复制进 React）：**

- `frontends/desktop/static/app.js` — i18n 中文、会话/服务/Token/协作交互
- `frontends/desktop/static/ga-web.js` — Bridge HTTP/WS 适配
- `frontends/desktop/static/styles.css` — 布局密度参考（颜色按新主题重做）

---

### 任务 1：脚手架 React + Vite + Vitest

**文件：**
- 创建：`frontends/desktop/web/package.json`
- 创建：`frontends/desktop/web/vite.config.ts`
- 创建：`frontends/desktop/web/tsconfig.json`
- 创建：`frontends/desktop/web/tsconfig.node.json`
- 创建：`frontends/desktop/web/index.html`
- 创建：`frontends/desktop/web/src/main.tsx`
- 创建：`frontends/desktop/web/src/App.tsx`
- 创建：`frontends/desktop/web/src/vite-env.d.ts`

- [ ] **步骤 1：创建 `package.json`**

```json
{
  "name": "genericagent-desktop-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **步骤 2：创建 `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
  test: { environment: 'jsdom', globals: true },
});
```

- [ ] **步骤 3：创建 `tsconfig.json` + `tsconfig.node.json` + `src/vite-env.d.ts`**

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

`src/vite-env.d.ts`：

```ts
/// <reference types="vite/client" />
```

- [ ] **步骤 4：创建入口文件**

`index.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generic Agent</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`：

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/theme.css';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

临时 `src/App.tsx`：

```tsx
export default function App() {
  return <div data-testid="app-root">Generic Agent</div>;
}
```

先建空的 `src/styles/theme.css` 与 `src/styles/app.css`（下一步填内容）。

- [ ] **步骤 5：安装并验证**

```bash
cd /Users/myrice/Desktop/github-code/GenericAgent/frontends/desktop/web
npm install
npm run build
npm test || true
```

预期：`npm install` 成功；`npm run build` 产出 `dist/index.html`。若尚无测试文件，`vitest run` 可能提示 no tests——下一步会加。

- [ ] **步骤 6：Commit**

```bash
cd /Users/myrice/Desktop/github-code/GenericAgent
git add frontends/desktop/web
git commit -m "$(cat <<'EOF'
chore(desktop): scaffold React+Vite web app

EOF
)"
```

---

### 任务 2：冷色主题 + 中文 i18n + Shell 布局

**文件：**
- 创建：`frontends/desktop/web/src/styles/theme.css`
- 创建：`frontends/desktop/web/src/styles/app.css`
- 创建：`frontends/desktop/web/src/i18n/zh.ts`
- 创建：`frontends/desktop/web/src/i18n/index.ts`
- 创建：`frontends/desktop/web/src/layout/Shell.tsx`
- 修改：`frontends/desktop/web/src/App.tsx`

- [ ] **步骤 1：写入主题变量（规格色值）**

`theme.css`：

```css
:root {
  --bg: #0f1419;
  --panel: #12181f;
  --line: #2a3340;
  --txt: #e8eef5;
  --muted: #7a8a9a;
  --accent: #3d9cf0;
  --accent-soft: #1a2430;
  --font-sans: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; }
body {
  background: var(--bg);
  color: var(--txt);
  font-family: var(--font-sans);
  font-size: 14px;
}
```

- [ ] **步骤 2：中文文案（对齐现有 app.js 用词）**

`zh.ts` 至少包含：

```ts
export const zh = {
  'brand.name': 'Generic Agent',
  'brand.sub': '本机智能体工作台',
  'nav.chat': '聊天',
  'nav.collab': '指挥家',
  'nav.services': '服务',
  'nav.token': '用量',
  'chat.placeholder': '输入消息…',
  'chat.send': '发送',
  'chat.stop': '强行停止',
  'chat.newSession': '新会话',
  'chat.sessions': '会话',
  'collab.placeholder': '请对指挥家描述你想完成的目标',
  'page.services.title': '服务',
  'page.token.title': '用量',
} as const;

export type ZhKey = keyof typeof zh;
```

`index.ts`：

```ts
import { zh, type ZhKey } from './zh';

export function t(key: ZhKey, vars?: Record<string, string | number>): string {
  let s: string = zh[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  return s;
}
```

对照 `static/app.js` 中文表，后续页面实现时按需把缺的 key 补进 `zh.ts`（不要留英文硬编码在 JSX）。

- [ ] **步骤 3：实现 `Shell.tsx`**

三栏骨架：左导航四项、`children` 主区、可选右侧 `rail`。`activePage` / `onNavigate` 由 App 控制。导航文案用 `t('nav.*')`。选中项用 `--accent` / `--accent-soft`。

- [ ] **步骤 4：`App.tsx` 挂上 Shell，四页占位**

```tsx
type Page = 'chat' | 'collab' | 'services' | 'token';

export default function App() {
  const [page, setPage] = useState<Page>('chat');
  return (
    <Shell page={page} onNavigate={setPage}>
      {page === 'chat' && <div>聊天页占位</div>}
      {page === 'collab' && <div>指挥家占位</div>}
      {page === 'services' && <div>服务占位</div>}
      {page === 'token' && <div>用量占位</div>}
    </Shell>
  );
}
```

- [ ] **步骤 5：本地预览确认布局**

```bash
cd frontends/desktop/web && npm run dev
```

预期：深色背景、左侧四导航中文、可切换占位页。

- [ ] **步骤 6：Commit**

```bash
git add frontends/desktop/web/src
git commit -m "$(cat <<'EOF'
feat(desktop-web): add cool-workbench shell and zh i18n

EOF
)"
```

---

### 任务 3：Bridge / Conductor API 客户端（TDD）

**文件：**
- 创建：`frontends/desktop/web/src/api/ports.ts`
- 创建：`frontends/desktop/web/src/api/http.ts`
- 创建：`frontends/desktop/web/src/api/bridge.ts`
- 创建：`frontends/desktop/web/src/api/bridgeWs.ts`
- 创建：`frontends/desktop/web/src/api/conductor.ts`
- 测试：`frontends/desktop/web/src/api/http.test.ts`
- 测试：`frontends/desktop/web/src/api/bridge.test.ts`

- [ ] **步骤 1：写失败测试 `http.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { httpJson } from './http';

describe('httpJson', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GETs JSON and returns parsed body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ));
    const data = await httpJson<{ ok: boolean }>('http://127.0.0.1:14168/status');
    expect(data.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:14168/status',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws with status on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ error: 'nope' }), { status: 500 }),
    ));
    await expect(httpJson('http://127.0.0.1:14168/x')).rejects.toThrow(/nope|500/);
  });
});
```

- [ ] **步骤 2：运行确认失败**

```bash
cd frontends/desktop/web && npm test -- src/api/http.test.ts
```

预期：FAIL（模块/函数不存在）。

- [ ] **步骤 3：实现 `ports.ts` + `http.ts`**

```ts
// ports.ts
export const BRIDGE_PORT = 14168;
export const CONDUCTOR_PORT = 8900;
export const bridgeOrigin = () =>
  `${location.protocol}//${location.hostname}:${BRIDGE_PORT}`;
export const conductorOrigin = () =>
  `${location.protocol}//${location.hostname}:${CONDUCTOR_PORT}`;
```

```ts
// http.ts
export async function httpJson<T = unknown>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (body && typeof body !== 'string') {
    headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
    body = JSON.stringify(body);
  }
  const res = await fetch(url, { ...init, headers, body, method: init.method || 'GET' });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error((data && (data.error || data.message)) || `${res.status} ${res.statusText}`);
  }
  return data as T;
}
```

- [ ] **步骤 4：再跑 `http.test.ts` 预期 PASS**

- [ ] **步骤 5：写 `bridge.test.ts`（listSessions / newSession / prompt 路径）**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as bridge from './bridge';

describe('bridge client', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lists sessions via GET /sessions', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(String(url)).toContain('/sessions');
      return new Response(JSON.stringify({ sessions: [] }), { status: 200 });
    }));
    const data = await bridge.listSessions();
    expect(data).toEqual({ sessions: [] });
  });
});
```

- [ ] **步骤 6：实现 `bridge.ts` 最小 API**

至少导出（路径与 `desktop_bridge.py` 路由一致）：

- `getStatus()` → `GET /status`
- `listSessions()` → `GET /sessions`
- `newSession(body?)` → `POST /session/new`
- `deleteSession(sid)` → `DELETE /session/{sid}`
- `getMessages(sid, after, limit)` → `GET /session/{sid}/messages?after=&limit=`
- `prompt(sid, body)` → `POST /session/{sid}/prompt`
- `cancel(sid)` → `POST /session/{sid}/cancel`
- `listModelProfiles()` → `GET /model-profiles`
- `servicesPanel()` → `GET /services/panel`
- `serviceStart(id)` / `serviceStop(id)`
- `tokenStats(query?)` → `GET /token-stats`
- `tokenHistory(query?)` → `GET /token-history`

全部基于 `bridgeOrigin()` + `httpJson`。

- [ ] **步骤 7：实现 `bridgeWs.ts`**

连接 `ws(s)://{host}:14168/ws`，解析 JSON，按 `type` 分发（至少处理 `services.snapshot` / `service.changed` / `session-state` / `bridge-ready`）。提供 `subscribe(handler)` / `connect()` / `disconnect()`。对照 `ga-web.js`。

- [ ] **步骤 8：实现 `conductor.ts` 最小面**

- `conductorOrigin()` 下的 `token-stats`、协作消息/进度所需端点：实现时打开 `static/app.js` 中 `CONDUCTOR_ORIGIN` 的 `fetch`/`WebSocket` 调用，把协作页实际用到的路径迁到本模块（不要臆造路径）。

- [ ] **步骤 9：跑全量 api 测试**

```bash
cd frontends/desktop/web && npm test
```

预期：PASS。

- [ ] **步骤 10：Commit**

```bash
git add frontends/desktop/web/src/api
git commit -m "$(cat <<'EOF'
feat(desktop-web): add bridge/conductor API clients with tests

EOF
)"
```

---

### 任务 4：对话页（会话 + 流式轮询）

**文件：**
- 创建：`frontends/desktop/web/src/hooks/useSessionMessages.ts`
- 创建：`frontends/desktop/web/src/components/Composer.tsx`
- 创建：`frontends/desktop/web/src/components/MessageList.tsx`
- 创建：`frontends/desktop/web/src/layout/SessionRail.tsx`
- 创建：`frontends/desktop/web/src/pages/ChatPage.tsx`
- 修改：`frontends/desktop/web/src/App.tsx`
- 测试：`frontends/desktop/web/src/hooks/useSessionMessages.test.ts`（可选纯函数抽离：合并消息增量）

- [ ] **步骤 1：对照 `app.js` 确认会话消息形状**

阅读 `static/app.js` / Bridge `messages_handler` 返回字段（`id`、`role`、`content`/`text`、是否增量）。在 `useSessionMessages.ts` 顶部用注释记录字段映射，实现按真实字段解析。

- [ ] **步骤 2：实现 `useSessionMessages(sid)`**

- 挂载后 `getMessages(sid, after=0)`，之后每 500–1000ms（或 WS `session-state` 触发）用 `after=lastId` 拉取增量  
- 暴露：`messages`、`partial`、`isRunning`、`send(text)`（内部 `prompt`）、`stop()`（`cancel`）  
- 卸载时清理 timer

- [ ] **步骤 3：`SessionRail` + `Composer` + `MessageList`**

- Rail：调用 `listSessions` / `newSession` / 切换高亮；删除若 Bridge 支持则接 `deleteSession`  
- Composer：中文占位 `t('chat.placeholder')`，Enter 发送（Shift+Enter 换行）  
- MessageList：用户右对齐、助手左对齐；流式时末尾可显示光标

- [ ] **步骤 4：`ChatPage` 组装**

顶栏：会话标题 + `强行停止`；中间消息；底部 Composer；右侧 Rail 由 Shell 传入或页内布局。模型下拉：`listModelProfiles` + 现有 config 写入方式（对照 `app.js` 模型 chip；若一期只读展示当前模型也可，但发送前必须能选到可用 profile——以 Bridge 已有 API 为准）。

- [ ] **步骤 5：手动联调**

```bash
# 终端 1：从仓库根用 venv 启动 bridge
cd /Users/myrice/Desktop/github-code/GenericAgent
source .venv/bin/activate
python frontends/desktop_bridge.py
# 终端 2
cd frontends/desktop/web && npm run dev
```

浏览器打开 Vite URL，确认：新建会话 → 发中文消息 → 出现回复增量 → 停止可用。

- [ ] **步骤 6：Commit**

```bash
git add frontends/desktop/web/src
git commit -m "$(cat <<'EOF'
feat(desktop-web): implement chat page with session polling

EOF
)"
```

---

### 任务 5：协作页（指挥家）

**文件：**
- 创建：`frontends/desktop/web/src/pages/CollabPage.tsx`
- 按需扩展：`frontends/desktop/web/src/api/conductor.ts`、`zh.ts`

- [ ] **步骤 1：从 `app.js` 提取协作关键交互清单**

至少覆盖规格：引导四步、运行状态开关、重试、进度侧栏、快捷芯片（进展/暂停/摘要）、Composer 发往 Conductor。在 `CollabPage.tsx` 文件头注释列出对应函数/端点来源行号（实现时填真实行号）。

- [ ] **步骤 2：实现 UI + 接线**

- 空态引导用 `t('collab.*')`（从 `app.js` 中文表迁入 `zh.ts`）  
- WS：`CONDUCTOR_WS_ORIGIN/ws`（对照现逻辑）  
- 进度面板：workers 列表与统计徽章  
- 离线态显示「无法连接指挥家服务…」

- [ ] **步骤 3：联调**

Bridge 启动会拉起 conductor；确认指挥家页能发目标并看到进度或至少明确连接状态。

- [ ] **步骤 4：Commit**

```bash
git commit -am "$(cat <<'EOF'
feat(desktop-web): implement conductor collab page

EOF
)"
```

---

### 任务 6：服务页

**文件：**
- 创建：`frontends/desktop/web/src/pages/ServicesPage.tsx`
- 扩展：`zh.ts`

- [ ] **步骤 1：实现双 Tab（消息通道 / 状态）**

- `GET /services/panel` 渲染列表  
- 启停：`POST /services/start|stop` body `{ id }`  
- 订阅 `bridgeWs` 的 `services.snapshot` / `service.changed` 刷新  
- 对照 `app.js` 通道展示字段（名称、端口、运行态）

- [ ] **步骤 2：联调启停一个非关键服务（若环境允许）或至少列表可加载**

- [ ] **步骤 3：Commit**

```bash
git commit -am "$(cat <<'EOF'
feat(desktop-web): implement services page wired to bridge

EOF
)"
```

---

### 任务 7：用量（Token）页

**文件：**
- 创建：`frontends/desktop/web/src/pages/TokenPage.tsx`
- 扩展：`zh.ts`

- [ ] **步骤 1：实现 Tab（全部 / 指挥家）、日期筛选、汇总、表格**

- Bridge：`/token-stats`、`/token-history`  
- 指挥家 Tab：对照 `app.js` 对 `CONDUCTOR_ORIGIN/token-stats` 的用法  
- 重置筛选恢复默认区间

- [ ] **步骤 2：联调有数字或空表不报错**

- [ ] **步骤 3：Commit**

```bash
git commit -am "$(cat <<'EOF'
feat(desktop-web): implement token usage page

EOF
)"
```

---

### 任务 8：Tauri 改为内嵌 React（不再导航到 Bridge 静态页）

**文件：**
- 修改：`frontends/desktop/src-tauri/tauri.conf.json`
- 修改：`frontends/desktop/package.json`
- 修改：`frontends/desktop/src-tauri/src/lib.rs`（navigate 段）
- 保留：`static/loading.html` / `fallback.html` 若仍被 setup 窗引用；或改为 web 内 loading 态

- [ ] **步骤 1：更新 `tauri.conf.json`**

```json
"build": {
  "frontendDist": "../web/dist",
  "devUrl": "http://localhost:5173",
  "beforeDevCommand": "npm run dev --prefix web",
  "beforeBuildCommand": "npm run build --prefix web"
}
```

（若当前 Tauri 2 schema 字段名不同，以 `@tauri-apps/cli` 文档/`tauri.conf` 校验为准，语义不变：dev 连 Vite，prod 用 `web/dist`。）

主窗口初始 `url`：生产用 `/`（dist）；开发用 `devUrl`。可去掉依赖 Bridge 静态的 `loading.html` 导航，或保留极短本地 loading 再进 React。

- [ ] **步骤 2：改 `lib.rs` —— Bridge 就绪后不要 `navigate("http://127.0.0.1:14168/")`**

在约 847–851 行逻辑改为：

- Bridge 端口就绪后：`main` 窗口 `show()`  
- **删除或注释** `w.navigate(bridge_http)`  
- 若窗口仍停在旧 loading 页：改为加载前端根路径（dev 下 Tauri 已用 `devUrl`；prod 用 asset）

保留：拉起 Bridge、端口等待、setup/fallback 配置窗、devtools 开关。

- [ ] **步骤 3：根 `frontends/desktop/package.json` 脚本**

确保存在：

```json
{
  "scripts": {
    "dev": "npm run dev --prefix web",
    "build:web": "npm run build --prefix web",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  }
}
```

- [ ] **步骤 4：冒烟**

```bash
cd frontends/desktop
npm run build:web
# 需要本机 Rust/tauri 工具链：
npm run tauri:dev
```

预期：窗口显示 React 冷色中文 UI；Network 中 API 打到 `:14168`；**地址栏/页面不是**仅 Bridge 旧 static（可通过 UI 结构或 `data-testid` 区分）。

- [ ] **步骤 5：Commit**

```bash
git add frontends/desktop/package.json frontends/desktop/src-tauri frontends/desktop/web
git commit -m "$(cat <<'EOF'
feat(desktop): serve React via Tauri; keep bridge as API only

EOF
)"
```

---

### 任务 9：文档入口 + 规格验收清单

**文件：**
- 修改：`README.md`（中文「桌面端」小节，指向 Tauri；注明 `python launch.pyw` 备用）
- 可选：`frontends/desktop/README.md`（若无则新建短文：dev/build 命令）

- [ ] **步骤 1：更新启动说明（中文）**

写明：

```bash
cd frontends/desktop
npm install
npm install --prefix web
npm run tauri:dev
```

备用：`python launch.pyw`（Streamlit）。

- [ ] **步骤 2：按规格成功标准自检**

勾选：

1. Tauri 打开默认中文 + 深色冷色  
2. 四页可进入；聊天能收发；服务列表可加载；用量页不崩  
3. Bridge / Agent 主路径未改坏（`python frontends/desktop_bridge.py` 仍可起）  
4. `python launch.pyw` 仍可启动（备用）

- [ ] **步骤 3：Commit**

```bash
git add README.md frontends/desktop/README.md
git commit -m "$(cat <<'EOF'
docs: point desktop default launch to Tauri React UI

EOF
)"
```

---

## 规格覆盖自检

| 规格项 | 任务 |
|--------|------|
| React + Vite + TS | 1 |
| 冷色主题 / 中文 | 2 |
| 复用 Bridge HTTP/WS | 3、4、6、7 |
| Conductor 协作 | 3、5 |
| 对话 / 协作 / 服务 / Token 四页 | 4–7 |
| Tauri 壳、内嵌前端、Bridge 仅 API | 8 |
| 保留 static 对照、launch.pyw 备用 | 8（不删 static）、9 |
| 成功标准验收 | 9 |

**占位符扫描：** 无 TODO/待定；Conductor 具体路径要求实现时从 `app.js` 核对，禁止臆造。  
**一致性：** 端口恒为 14168 / 8900；导航中文与现网「聊天/指挥家/服务/用量」对齐（规格「对话/协作」为产品语义，UI 用词跟现 i18n）。

---

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-07-14-desktop-react-tauri.md`。两种执行方式：

**1. 子代理驱动（推荐）** — 每个任务调度一个新的子代理，任务间审查，快速迭代  

**2. 内联执行** — 在当前会话用 executing-plans 执行，批量推进并设检查点  

选哪种方式？
