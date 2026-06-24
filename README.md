# 🤖 AI 智能体工作台 (AI Agent Workbench)

> 从聊天框到智能体工作台 —— 具备思考过程可视化、RAG 知识库检索、MCP 工具调用能力的 AI Agent 前端平台。

![技术栈](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![语言](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript) ![样式](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss) ![状态管理](https://img.shields.io/badge/Zustand-5-433e38) ![构建](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)

---

## 🎯 核心理念

传统 AI Chat 是 **"黑盒式"** 的：用户输入 → 等待 → 获得答案。本项目的目标是**打开这个黑盒**，将大模型的**思考过程 (Thought)**、**知识库检索 (RAG Search)**、**外部工具调用 (MCP Tool Call)** 每一步实时可视化，让用户真正理解 AI 是如何工作的。

## ✨ 功能特性

### 🧠 Agent 执行引擎
- **思考链路追踪**：每个回复自动拆解为"思考 → 工具调用 → 工具结果 → 综合回答"完整链路
- **中文思考展示**：模型思考过程以中文在可折叠卡片中实时渲染
- **消息协议标准化**：定义了 `text | thought | tool_call | tool_result` 四种消息类型
- **状态管理**：每条消息具备 `pending → streaming → success → error` 生命周期

### 📚 RAG 知识库检索（模拟）
- **模拟向量检索**：内置技术文档知识库，支持语义匹配
- **检索结果可视化**：展示检索到的文档片段、来源和相关度评分
- **可控开关**：右侧面板可自由启停各知识库

### 🔧 MCP 工具调用（模拟）
- **文件系统访问**：支持 `mcp_read_file` / `mcp_list_directory` 等模拟工具
- **工具状态动画**：调用中（旋转图标）、成功（✅）、失败（❌）状态实时展示
- **结果折叠查看**：JSON 数据、文件内容、目录列表均支持展开/折叠
- **可扩展架构**：预留 GitHub API、数据库等 MCP Server 接口

### 🎨 三栏工作台布局
```
┌──────────────┬────────────────────────┬─────────────┐
│   📂 会话列表  │    🧠 主工作区           │  ⚙️ 控制面板  │
│              │                        │             │
│  · 新建对话   │  AI 智能体助手           │ 📚 知识库    │
│  · 历史会话   │  ┌─────────────────┐   │  ├ 技术文档  │
│  · 删除会话   │  │ 🧠 思考过程      │   │  └ 项目架构  │
│              │  │ 🔧 工具调用      │   │             │
│              │  │ ✅ 工具结果      │   │ 🔌 MCP服务  │
│              │  │ 💬 最终回答      │   │  ├ 文件系统  │
│              │  └─────────────────┘   │  └ GitHub   │
│              │                        │             │
│              │  [输入框] [发送]       │ 📊 Token用量 │
└──────────────┴────────────────────────┴─────────────┘
```

### 📝 其他特性
- **Markdown 渲染 + 代码高亮**：支持多种语言语法高亮（VSCode Dark+ 主题）
- **语音播报 (TTS)**：AI 回复支持一键朗读，自动匹配中文女声
- **语音输入**：支持浏览器语音识别输入
- **智能滚动**：AI 流式回复时，仅在用户处于底部时自动跟随，上拉查看历史不被打断
- **多会话管理**：新建/切换/删除会话，数据通过 Zustand persist 本地持久化
- **智能摘要**：长对话自动生成摘要，保持上下文窗口高效

## 🛠 技术栈

| 层面 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 19 + Vite 7 | 最新 React + 极速构建 |
| 开发语言 | TypeScript 5.9 | 全类型安全 |
| 样式方案 | TailwindCSS 4 | 原子化 CSS，零配置 |
| 状态管理 | Zustand 5 + persist | 轻量状态 + localStorage 持久化 |
| Markdown | react-markdown + react-syntax-highlighter | 富文本渲染 + Prism 代码高亮 |
| AI 接口 | 智谱 GLM-4-Flash | OpenAI 兼容 SSE 流式 API |

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 pnpm

### 安装与运行

```bash
# 1. 克隆项目
git clone https://github.com/vortexmayo/ai-agent-assistant.git
cd ai-agent-assistant

# 2. 安装依赖
npm install

# 3. 配置 API Key（创建 .env.local 文件）
echo VITE_AI_API_KEY=你的智谱API密钥 > .env.local

# 4. 启动开发服务器
npm run dev

# 5. 构建生产版本
npm run build
```

> 在 [open.bigmodel.cn](https://open.bigmodel.cn) 注册并获取智谱 AI 的 API Key。

## 📁 项目结构

```
src/
├── App.tsx                    # 主布局：三栏工作台
├── main.tsx                   # 应用入口
├── index.css                  # 全局样式 + 动画
├── types/
│   └── chat.ts                # Agent 消息协议类型定义
├── store/
│   └── useChatStore.ts        # Zustand 全局状态 + RAG/MCP 模拟逻辑
└── components/
    ├── MessageList.tsx         # 消息列表：按类型动态分发渲染
    ├── TextBubble.tsx          # 文本消息气泡（Markdown + 语音播报）
    ├── ThoughtNode.tsx         # 思考过程折叠卡片
    ├── ToolCallNode.tsx        # 工具调用状态节点
    ├── ToolResultNode.tsx      # 工具结果展示（RAG/文件/JSON）
    ├── ChatInput.tsx           # 输入框（文字 + 语音输入）
    └── ControlPanel.tsx        # 右侧控制面板
```

## 🏗️ Agent 消息协议

```typescript
interface AgentMessage {
  id: string;           // 消息唯一ID
  groupId: string;      // 同一轮对话的"思考链路"分组
  role: 'user' | 'assistant' | 'system' | 'tool';
  type: 'text' | 'thought' | 'tool_call' | 'tool_result';
  status: 'pending' | 'streaming' | 'success' | 'error';

  // 按类型携带不同载荷
  content?: string;     // text / thought 内容
  toolName?: string;    // 工具名，如 'rag_search'
  toolCallId?: string;  // 工具调用唯一ID
  args?: string | object;
  result?: unknown;
  error?: string;
}
```

## 🔄 Agent 执行流程

```
用户输入 "React 状态管理怎么用？"
  │
  ├─ [Thought] 🤔 分析意图：用户询问技术问题，需检索知识库
  ├─ [Tool Call] 📚 rag_search { query: "React 状态管理", knowledgeBases: [...] }
  ├─ [Tool Result] ✅ 检索到 2 条相关文档
  │   ├─ 📄 Zustand 用法 (相关度 92%)
  │   └─ 📄 项目架构 (相关度 78%)
  ├─ [Thought] 🧠 综合分析：工具返回了 Zustand 和项目架构相关文档...
  └─ [Text] 💬 根据知识库检索结果，推荐使用 Zustand...
```

## 🔮 路线图

- [ ] 接入真实 RAG 后端（向量数据库 + Embedding）
- [ ] 接入真实 MCP Server（文件读写、Git 操作）
- [ ] 支持模型原生 Function Calling（tool_choice）
- [ ] 会话导出（Markdown / PDF）
- [ ] 暗色模式
- [ ] 多模型切换（GLM / DeepSeek / Qwen）

## 📄 License

MIT
