# AnyGenAgent: NestJS 后端架构与前后端交互方案

## 1. 系统架构概述
基于 NestJS 构建的高性能、可扩展的 Agent 后端，旨在通过插件化架构支持从 `PPTGen` 到多种生成场景的平滑扩展。

### 1.1 核心模块划分
- **AgentModule**: 核心逻辑编排，处理 CoT (过程思考) 和任务状态机。
- **RenderModule**: 插件化渲染中心，包含 `PPTRenderer`、`WebRenderer` 等适配器。
- **AssetModule**: 统一物料管理中心，处理图片、图标、模板的存储与检索。
- **SocketModule**: 基于 WebSocket 的实时通信，推送过程思考和中间结果。
- **ProjectModule**: 项目版本管理，支持基于 XML/JSON 的增量编辑和回溯。

---

## 2. 后端逻辑设计 (NestJS 实现思路)

### 2.1 任务编排状态机
使用 `XState` 或简单的状态机逻辑管理 Agent 生成阶段：
`IDLE` -> `CONSULTING` (表单) -> `PLANNING` (大纲) -> `ASSET_MATCHING` (物料) -> `GENERATING` (XML) -> `RENDERING` (PPT) -> `COMPLETED`。

### 2.2 插件化渲染器接口
```typescript
// src/render/interfaces/renderer.interface.ts
export interface IRenderer {
  type: string;
  render(dsl: any): Promise<Buffer | string>;
  update(slideId: string, delta: any): Promise<void>;
}
```

### 2.3 资产版本控制策略
每次修改不直接覆盖原 XML，而是通过 `ProjectService` 记录 `diff`：
```json
{
  "project_id": "p123",
  "history": [
    { "version": 1, "action": "CREATE", "data": "full_xml_v1" },
    { "version": 2, "action": "UPDATE_SLIDE", "slideId": "s3", "delta": { "bgColor": "#0000FF" } }
  ]
}
```

---

## 3. 前后端交互方案

### 3.1 协议选择
- **HTTP (REST)**: 用于项目创建、资产上传、最终结果下载等确定性操作。
- **WebSocket (Socket.io)**: 用于长耗时任务的进度推送、AI 过程思考 (CoT) 展示、实时预览。

### 3.2 关键交互流程

#### A. 需求对齐阶段 (Consulting)
1. **Client**: `POST /projects` (初始需求)
2. **Server**: 返回 `202 Accepted`，启动异步任务。
3. **Server (WS)**: `emit('agent_status', { state: 'CONSULTING', formSchema: {...} })`
4. **Client**: 弹出 AI 表单，用户填写并 `POST /projects/:id/form`。

#### B. 过程思考展示 (Streaming Thought)
1. **Server (WS)**: `emit('thought_stream', { content: '正在为您从资产库匹配京都风格的高清图片...' })`
2. **Client**: 侧边栏打字机效果实时显示。

#### C. 实时预览与同步 (Live Preview)
1. **Server (WS)**: `emit('slide_update', { slideId: 's1', xml: '...', previewUrl: '...' })`
2. **Client**: 更新左侧预览缩略图和中间主编辑器。

---

## 4. API 接口定义预览

### 4.1 项目管理
- `POST /api/projects`: 创建项目
- `GET /api/projects/:id`: 获取项目详情（含幻灯片列表及 `drive_token`）
- `PATCH /api/projects/:id/slides/:slideId`: 局部更新幻灯片（触发增量渲染）

### 4.2 物料库
- `GET /api/assets/search?q=...`: 语义搜索素材
- `POST /api/assets/upload`: 用户上传物料

### 4.3 渲染控制
- `POST /api/projects/:id/export`: 触发最终文件合成（PPTX/PDF/HTML）

---

## 5. 扩展 AnyGenAgent 的设计

### 5.1 动态模型注入
后端通过 `AgentFactory` 根据项目类型（PPT/Web/Doc）动态注入不同的 `SystemPrompt` 和 `SchemaValidator`。

### 5.2 统一的 `Artifact` 协议
无论后端产出的是 XML 还是 HTML，都统一封装在 `Artifact` 对象中，前端根据 `artifact.type` 路由到不同的展示组件（`PPTPreviewer` vs `WebViewer`）。

---

## 6. 总结
本方案通过 NestJS 的强类型约束和模块化能力，为 AnyGenAgent 提供了一个**稳定、可观测、支持增量更新**的工业级后端基石。WebSocket 的引入解决了 AI 生成长耗时的用户焦虑感，而基于 DSL 的增量更新协议则保证了交互修改的高效性。
