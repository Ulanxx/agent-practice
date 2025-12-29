# Agent Practice - Mini Cursor

这是一个用于个人练习 AI Agent 开发的项目。它实现了一个类似 Cursor/Bolt.new 的迷你 Agent，能够根据用户指令自动执行文件操作和系统命令。

## 核心功能

- **智能任务规划**：利用 LangChain 和 OpenAI/DeepSeek 等模型进行任务拆解和执行。
- **工具调用 (Tool Calling)**：
  - `read_file`: 读取本地文件内容。
  - `write_file`: 自动创建目录并写入文件。
  - `list_directory`: 列出目录结构。
  - `execute_command`: 执行系统命令（支持指定工作目录，实时输出日志）。
- **自动化流**：支持多轮对话直到完成复杂任务（如从零构建一个完整的 React 项目）。

## 项目结构

```text
src/
├── all-tools.mjs      # 定义 Agent 可用的基础工具
├── mini-cursor.mjs    # Agent 核心逻辑，处理模型对话和工具调度
├── cursor-plan.mjs    # 测试用例：自动化构建 React TodoList 项目
├── node-exec.mjs      # 工具函数：执行系统命令
└── tool-file-read.mjs # 工具函数：文件读取封装
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

创建 `.env` 文件并配置以下内容：

```env
OPENAI_API_KEY=你的API密钥
OPENAI_BASE_URL=代理地址（如需要）
MODEL_NAME=模型名称（推荐 gpt-4o 或 deepseek-chat）
```

### 3. 运行示例

运行以下命令，Agent 将会自动创建一个带有动画效果和持久化功能的 React TodoList 应用：

```bash
node src/cursor-plan.mjs
```

## 技术栈

- **Runtime**: Node.js
- **Framework**: [LangChain.js](https://js.langchain.com/)
- **LLM**: OpenAI API 兼容模型
- **Styling**: Chalk (用于美化终端输出)
- **Validation**: Zod (用于工具参数校验)

---

*仅供个人练习使用*
