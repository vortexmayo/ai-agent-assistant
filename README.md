# 🤖 AI 智能体工作台 (AI Agent Workbench)

> 从聊天框到智能体工作台 —— 具备思考过程可视化、真实 SQLite MCP 工具调用、Agent 消息协议追踪能力的 AI 前端平台。

![技术栈](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![语言](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript) ![样式](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss) ![状态管理](https://img.shields.io/badge/Zustand-5-433e38) ![构建](https://img.shields.io/badge/Vite-7-646CFF?logo=vite) ![MCP](https://img.shields.io/badge/MCP-SQLite-FF6B35)

---

## 🎯 核心理念

传统 AI Chat 是 **"黑盒式"** 的：用户输入 → 等待 → 获得答案。本项目的目标是**打开这个黑盒**，将大模型的**思考过程 (Thought)**、**工具调用决策 (Tool Call)**、**真实执行结果 (Tool Result)** 每一步实时可视化，让用户真正理解 AI 是如何工作的。

## ✨ 功能特性

### 🧠 Agent 执行引擎
- **思考链路追踪**：每个回复拆解为"思考 → 工具调用 → 真实执行 → 综合回答"完整链路
- **中文思考展示**：Agent 思考过程以中文在可折叠卡片中实时渲染
- **消息协议标准化**：定义了 `text | thought | tool_call | tool_result` 四种消息类型
- **状态管理**：每条消息具备 `pending → streaming → success → error` 生命周期
- **多轮工具调用**：大模型自主决策调用哪些工具，支持最多 5 轮循环调用

### 🗄️ SQLite MCP 工具调用（真实）
- **真实数据库查询**：通过 Node.js BFF 代理服务连接本地 SQLite，执行真实的 SQL 操作
- **5 个标准工具**：`list_tables`、`describe_table`、`read_query`、`write_query`、`create_table`
- **Function Calling**：利用智谱 API 原生 tools/function calling，大模型自主决策调用时机和参数
- **结果可视化**：查询结果以表格/JSON 格式展示，支持展开查看详情
- **预置测试数据**：包含 users、products、sales、tasks 四张表共 22 条记录

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
│              │  │ 💬 最终回答      │   │  ├ 📁 文件  │
│              │  └─────────────────┘   │  └ 🗄️ SQLite │
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

## 🏗️ 系统架构

```
┌──────────────────────┐     HTTP      ┌──────────────────┐     sql.js    ┌──────────┐
│   浏览器 (React)      │ ◄──────────▶ │   BFF 代理服务     │ ◄──────────▶ │  test.db │
│                      │              │   server.js:3001  │              │  SQLite  │
│  ┌────────────────┐  │              │                    │              │          │
│  │ useChatStore   │  │  GET /api/   │  /mcp/tools       │   list_tables│  users   │
│  │ · sendMessage  │──┼─────────────▶│  /mcp/call        │──read_query─▶│ products │
│  │ · fetchMCPTools│  │  POST /api/  │  /mcp/health      │  write_query │  sales   │
│  │ · executeMCPCall│◀┼──────────────│                    │◀─────────────│  tasks   │
│  └────────────────┘  │              └──────────────────┘              └──────────┘
│                      │
│  ┌────────────────┐  │    SSE 流式
│  │ 智谱 GLM-4 API │◀─┼────────────  tools/function calling
│  │ open.bigmodel  │──┼────────────▶  text / tool_calls
│  └────────────────┘  │
└──────────────────────┘
```

## 🛠 技术栈

| 层面 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 19 + Vite 7 | 最新 React + 极速构建 |
| 开发语言 | TypeScript 5.9 | 全类型安全 |
| 样式方案 | TailwindCSS 4 | 原子化 CSS，零配置 |
| 状态管理 | Zustand 5 + persist | 轻量状态 + localStorage 持久化 |
| Markdown | react-markdown + react-syntax-highlighter | 富文本渲染 + Prism 代码高亮 |
| AI 接口 | 智谱 GLM-4-Flash | OpenAI 兼容 SSE 流式 API + Function Calling |
| BFF 代理 | Express 5 + sql.js | Node.js 中间层，纯 JS SQLite（零原生编译） |
| MCP 协议 | MCP SDK 1.x | 工具定义格式兼容 Model Context Protocol |

## 🚀 快速开始

### 环境要求
- Node.js 18+

### 安装与运行

```bash
# 1. 克隆项目
git clone https://github.com/vortexmayo/ai-agent-assistant.git
cd ai-agent-assistant

# 2. 安装依赖
npm install

# 3. 初始化测试数据库（创建 test.db 并写入 22 条测试数据）
npm run setup-db

# 4. 配置 API Key
# 创建 .env.local 文件，写入你的智谱 API 密钥：
# VITE_AI_API_KEY=你的密钥

# 5. 一键启动（MCP 代理 + 前端）
npm run dev:all

# 或者分开启动：
# 终端 1：npm run mcp-server   （MCP 代理，端口 3001）
# 终端 2：npm run dev           （Vite 前端，端口 5173）
```

> 在 [open.bigmodel.cn](https://open.bigmodel.cn) 注册并获取智谱 AI 的 API Key。

### 启动后验证

```bash
# 检查 MCP 代理是否正常
curl http://localhost:3001/api/mcp/health

# 预期输出：
# {"status":"ok","tables":["users","products","sales","tasks"],"tools":["list_tables","describe_table","read_query","write_query","create_table"]}
```

## 📁 项目结构

```
ai-agent-assistant/
├── server.js                  # MCP BFF 代理服务（Express + sql.js）
├── test.db                    # SQLite 测试数据库（自动生成）
├── vite.config.ts             # Vite 配置
├── package.json
├── scripts/
│   └── init-db.js             # 数据库初始化脚本
├── src/
│   ├── App.tsx                # 主布局：三栏工作台
│   ├── main.tsx               # 应用入口
│   ├── index.css              # 全局样式 + 动画
│   ├── types/
│   │   └── chat.ts            # Agent 消息协议类型定义
│   ├── store/
│   │   └── useChatStore.ts    # Zustand 全局状态 + MCP 通信逻辑
│   └── components/
│       ├── MessageList.tsx     # 消息列表：按类型动态分发渲染
│       ├── TextBubble.tsx      # 文本消息气泡（Markdown + 语音播报）
│       ├── ThoughtNode.tsx     # 思考过程折叠卡片
│       ├── ToolCallNode.tsx    # 工具调用状态节点
│       ├── ToolResultNode.tsx  # 工具结果展示（表格/JSON/文本）
│       ├── ChatInput.tsx       # 输入框（文字 + 语音输入）
│       └── ControlPanel.tsx    # 右侧控制面板
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
  toolName?: string;    // 工具名，如 'read_query'
  toolCallId?: string;  // 工具调用唯一ID
  args?: string | object;
  result?: unknown;
  error?: string;
}
```

## 🔄 Agent 执行流程

```
用户输入 "帮我查一下销量最高的三个产品是什么？"
  │
  ├─ [Thought] 🤔 分析意图 + MCP 已就绪
  │   可用工具：list_tables, describe_table, read_query...
  │
  ├─ [API Call] 向智谱 API 发送请求（含 tools 定义）
  │   大模型自主决策：需要先了解表结构
  │
  ├─ [Tool Call] 🔧 describe_table { table_name: "sales" }
  ├─ [Tool Call] 🔧 describe_table { table_name: "products" }
  │
  ├─ [Tool Result] ✅ sales 表结构：id, product_id, quantity, total_amount...
  ├─ [Tool Result] ✅ products 表结构：id, name, category, price, stock...
  │
  ├─ [API Call] 将结果发回大模型，继续推理
  │   大模型：已了解表结构，现在写 JOIN 查询
  │
  ├─ [Tool Call] 🔧 read_query {
  │     query: "SELECT p.name, SUM(s.total_amount) as total
  │              FROM sales s JOIN products p ON s.product_id = p.id
  │              GROUP BY p.name ORDER BY total DESC LIMIT 3"
  │   }
  │
  ├─ [Tool Result] ✅ [
  │     {"name": "4K 显示器", "total": 7497},
  │     {"name": "机械键盘 Pro", "total": 2495},
  │     {"name": "人体工学鼠标", "total": 995}
  │   ]
  │
  └─ [Text] 💬 "根据销售数据分析，销量最高的三个产品是：
            1. 4K 显示器 — 总销售额 ¥7,497
            2. 机械键盘 Pro — 总销售额 ¥2,495
            3. 人体工学鼠标 — 总销售额 ¥995"
```

## 📦 NPM Scripts

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 前端开发服务器 |
| `npm run mcp-server` | 启动 MCP SQLite 代理服务（端口 3001） |
| `npm run dev:all` | 一键启动前端 + MCP 代理 |
| `npm run setup-db` | 初始化/重置测试数据库 |
| `npm run build` | TypeScript 检查 + 生产构建 |
| `npm run preview` | 预览生产构建 |

## 🔮 路线图

- [x] 真实 SQLite MCP 工具调用（Function Calling）
- [x] Agent 多轮工具调用循环
- [x] 三栏工作台布局
- [ ] 接入更多 MCP Server（文件系统、GitHub API）
- [ ] 接入真实 RAG 后端（向量数据库 + Embedding）
- [ ] 会话导出（Markdown / PDF）
- [ ] 暗色模式
- [ ] 多模型切换（GLM / DeepSeek / Qwen）
- [ ] MCP Server 热插拔与动态发现

## 📄 License

MIT
