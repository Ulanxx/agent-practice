# AnyGenAgent 通用架构方案：从 PPT 生成到全场景智能代理的进阶

## 1. 核心设计哲学：插件化与协议化
为了实现从 `PPTGenAgent` 到 `AnyGenAgent` 的平滑扩展，系统必须从“面向功能”转变为“面向协议”。PPT 只是其中一种**渲染协议 (Rendering Protocol)**。

---

## 2. 纵向分层架构 (Layered Architecture)

### 2.1 抽象基类层 (Base Agent)
*   **任务编排器 (Orchestrator)**：处理通用的 Agentic Loop（感知 -> 思考 -> 工具调用 -> 评估）。
*   **交互管理中心 (Interaction Hub)**：管理用户意图对齐、AI 表单引导、过程思考输出。
*   **物料中心 (Asset Hub)**：统一管理多模态资源（图片、数据、文档、代码片段）。

### 2.2 领域插件层 (Domain Plugins)
*   **PPTGenPlugin**：继承基类，实现专属的 XML-DSL 生成逻辑和 PptxGen 渲染器。
*   **WebGenPlugin**（扩展）：实现 HTML/React 代码生成逻辑。
*   **ReportGenPlugin**（扩展）：实现 PDF/Markdown 结构化文档生成逻辑。
*   **VideoGenPlugin**（扩展）：实现基于 FFmpeg 或渲染引擎的视频脚本生成。

---

## 3. 核心设计模式

### 3.1 统一领域描述语言 (Universal DSL)
不再仅限于 XML，而是采用一种**多模态中间件 (Omni-IR)**：
*   **Content**: 语义内容。
*   **Structure**: 层级关系。
*   **Metadata**: 渲染建议（如：风格、语气、布局权重）。

### 3.2 渲染适配器模式 (Adapter Pattern)
针对不同的输出目标，定义统一的 `Renderer` 接口：
```typescript
interface AnyRenderer {
  render(dsl: OmniIR): Promise<OutputArtifact>;
  update(changeSet: Delta): Promise<OutputArtifact>; // 增量更新协议
}
```

---

## 4. AnyGenAgent 的关键特性：物料共享与复用

*   **跨场景物料流转**：
    *   用户在 `PPTGenAgent` 中选定的京都图片，可以无缝流转到 `WebGenAgent` 生成的旅游网页中。
*   **知识库增强 (RAG)**：
    *   通过通用的物料中心挂载知识库，使 Agent 能够基于同一套业务逻辑，同时产出报告、演示文稿和推文。

---

## 5. 路线图：如何平滑迁移

1.  **解耦当前逻辑**：将 `gen-pptx-optimized.mjs` 中的 XML 解析和渲染逻辑抽离为 `PPTPlugin`。
2.  **标准化物料中心**：建立统一的资源 ID 系统，支持跨 Plugin 引用。
3.  **开发通用 Prompt 模板**：使 LLM 能够识别当前激活的领域插件并输出对应的 DSL。

---

## 6. 结论
`AnyGenAgent` 的设计目标是建立一个**通用的意图到产出 (Intention-to-Artifact) 的转化引擎**。通过将 PPT 视为一种特定的渲染格式，我们将整个工程重心上移至任务规划与物料管理，从而实现能力的无限扩展。
