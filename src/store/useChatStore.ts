import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type AgentMessage,
  type Session,
  type APIResponse,
  type KnowledgeBase,
  type MCPServer,
  type TokenUsage,
  type RAGSearchResult,
} from '../types/chat';

// ========== 常量配置 ==========
const SYSTEM_PROMPT: string =
  '你是一个智能 Agent 助手，具备思考能力、知识库检索（RAG）和工具调用（MCP）能力。' +
  '在回答用户问题时，请先进行思考（用中文），然后根据需要调用工具获取信息，最后给出完整回答。' +
  '当用户询问需要外部信息的问题时，主动使用工具。';

const SUMMARY_THRESHOLD = 15;
const SUMMARY_COUNT = 8;
const SUMMARY_DEBOUNCE_MS = 3000;

// ========== 模拟知识库数据 ==========
const MOCK_KNOWLEDGE_BASE: Record<string, string> = {
  '项目架构': '本项目采用 React 19 + TypeScript + Zustand + TailwindCSS 4 技术栈，使用 Vite 7 作为构建工具。项目分为三层：类型定义层(types/)、状态管理层(store/)、UI组件层(components/)。',
  'Agent 协议': 'Agent 消息协议定义了四种消息类型：text(文本回复)、thought(思考过程)、tool_call(工具调用)、tool_result(工具结果)。每条消息包含 id、groupId、role、type、status 等字段，支持完整的对话链路追踪。',
  'MCP 介绍': 'MCP(Model Context Protocol) 是一种标准化的工具调用协议，允许 AI 模型与外部工具和服务交互。常见的 MCP Server 包括：文件系统操作、GitHub API、数据库查询等。',
  'RAG 原理': 'RAG(检索增强生成) 是一种将外部知识库与 AI 模型结合的技术。当用户提问时，系统先从知识库中检索相关文档片段，然后将检索结果作为上下文提供给模型，从而生成更准确、更专业的回答。',
  'Zustand 用法': 'Zustand 是一个轻量级的 React 状态管理库。使用 create() 函数创建 store，支持 persist 中间件实现本地持久化。通过 selector 模式可以精确订阅需要的状态，避免不必要的重渲染。',
  'TailwindCSS': 'TailwindCSS 是一个实用优先的 CSS 框架，通过组合原子化类名来快速构建界面。v4 版本引入了 @import "tailwindcss" 的零配置方式，支持 JIT 编译和任意值语法。',
};

// ========== 模拟文件系统 ==========
const MOCK_FILE_SYSTEM: Record<string, string> = {
  '/src/App.tsx': 'import { ChatInput } from \'./components/ChatInput\';\nimport { useChatStore } from \'./store/useChatStore\';\nimport MessageList from \'./components/MessageList\';\n\nexport default function App() {\n  // 主应用组件，负责三栏布局和状态管理\n  return <div>...</div>;\n}',
  '/src/types/chat.ts': 'export type MessageStatus = \'pending\' | \'streaming\' | \'success\' | \'error\';\nexport type MessageType = \'text\' | \'thought\' | \'tool_call\' | \'tool_result\';\nexport interface AgentMessage { id: string; groupId: string; ... }',
  '/package.json': '{ "name": "ai-agent-assistant", "version": "0.0.0", "dependencies": { "react": "^19.2.0", "zustand": "^5.0.11" } }',
};

// ========== 模拟 MCP Server 列表 ==========
const DEFAULT_MCP_SERVERS: MCPServer[] = [
  { id: 'mcp-fs', name: '📁 本地文件系统', type: 'filesystem', status: 'connected', description: '读写项目文件' },
  { id: 'mcp-gh', name: '🐙 GitHub API', type: 'github', status: 'disconnected', description: '仓库操作与 PR 管理' },
  { id: 'mcp-db', name: '🗄️ 知识库', type: 'database', status: 'connected', description: '向量检索与文档查询' },
];

// ========== 默认知识库列表 ==========
const DEFAULT_KNOWLEDGE_BASES: KnowledgeBase[] = [
  { id: 'kb-tech', name: '📚 技术文档', description: 'React、TypeScript、Zustand 等', enabled: true },
  { id: 'kb-arch', name: '🏗️ 项目架构', description: '本项目的设计文档与架构说明', enabled: true },
  { id: 'kb-api', name: '🔌 API 参考', description: '接口文档与调用示例', enabled: false },
];

// ========== Store 状态定义 ==========
interface ChatState {
  sessions: Session[];
  currentSessionId: string;
  isGenerating: boolean;

  // Agent 控制面板状态
  knowledgeBases: KnowledgeBase[];
  mcpServers: MCPServer[];
  tokenUsage: TokenUsage | null;
  showThoughtProcess: boolean; // 是否显示思考过程

  // 会话管理
  createNewSession: () => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;

  // 消息管理
  clearMessages: () => void;
  sendMessage: (text: string) => Promise<void>;
  stopGeneration: () => void;

  // Agent 消息操作
  addMessage: (msg: AgentMessage) => void;
  updateMessage: (id: string, updates: Partial<AgentMessage>) => void;

  // 控制面板操作
  toggleKnowledgeBase: (id: string) => void;
  toggleMCPServer: (id: string) => void;
  toggleThoughtProcess: () => void;

  // 辅助方法
  getCurrentMessages: () => AgentMessage[];

  // 摘要生成
  generateSummaryForCurrentSession: () => Promise<void>;
}

// ========== 工具函数 ==========

/** 生成唯一 ID */
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 获取当前时间戳 */
function now(): number {
  return Date.now();
}

/** 构建发送给大模型的 Payload */
function buildPayloadMessages(
  messages: AgentMessage[],
  summary: string,
  systemPrompt: string = SYSTEM_PROMPT,
) {
  const payload: Array<{ role: string; content: string }> = [];

  payload.push({ role: 'system', content: systemPrompt });

  if (summary) {
    payload.push({ role: 'system', content: `【对话历史摘要】${summary}` });
  }

  for (const msg of messages) {
    if (msg.type === 'text' && (msg.role === 'user' || msg.role === 'assistant')) {
      payload.push({ role: msg.role, content: msg.content || '' });
    }
    // 将 tool_call 和 tool_result 也放入上下文
    if (msg.type === 'tool_call' && msg.role === 'assistant') {
      payload.push({
        role: 'assistant',
        content: `[调用工具: ${msg.toolName}，参数: ${JSON.stringify(msg.args)}]`,
      });
    }
    if (msg.type === 'tool_result' && msg.role === 'tool') {
      payload.push({
        role: 'user',
        content: `[工具 ${msg.toolName} 返回结果: ${JSON.stringify(msg.result)}]`,
      });
    }
  }

  return payload;
}

/** 调用大模型生成摘要 */
async function requestSummary(messagesToSummarize: Array<{ role: string; content: string }>): Promise<string> {
  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [
        {
          role: 'system',
          content: '你是一个对话摘要生成器。请用简洁的一段中文总结以下对话核心内容，重点关注用户提到的个人信息、情感状态、重要事件和需求。使用第三人称。',
        },
        ...messagesToSummarize,
      ],
      stream: false,
    }),
  });

  if (!response.ok) throw new Error(`摘要请求失败: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ========== 模拟 RAG 检索 ==========
function simulateRAGSearch(query: string): RAGSearchResult[] {
  const results: RAGSearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  for (const [title, content] of Object.entries(MOCK_KNOWLEDGE_BASE)) {
    if (content.toLowerCase().includes(lowerQuery.slice(0, 4)) || title.includes(query.slice(0, 4))) {
      results.push({
        chunkId: uid(),
        content: `【${title}】${content}`,
        score: 0.85 + Math.random() * 0.14,
        source: title,
      });
    }
  }

  // 如果没有精确匹配，返回最相关的两条
  if (results.length === 0) {
    const entries = Object.entries(MOCK_KNOWLEDGE_BASE);
    const shuffled = entries.sort(() => Math.random() - 0.5).slice(0, 2);
    for (const [title, content] of shuffled) {
      results.push({
        chunkId: uid(),
        content: `【${title}】${content}`,
        score: 0.6 + Math.random() * 0.2,
        source: title,
      });
    }
  }

  return results.slice(0, 3);
}

// ========== 模拟 MCP 文件操作 ==========
function simulateMCPFileRead(path: string): { success: boolean; content?: string; error?: string } {
  const normalizedPath = path.startsWith('/') ? path : '/' + path;
  if (MOCK_FILE_SYSTEM[normalizedPath]) {
    return { success: true, content: MOCK_FILE_SYSTEM[normalizedPath] };
  }
  return { success: false, error: `文件不存在: ${normalizedPath}` };
}

function simulateMCPListDirectory(_path: string): { success: boolean; files?: string[] } {
  const allFiles = Object.keys(MOCK_FILE_SYSTEM);
  return { success: true, files: allFiles };
}

// ========== 默认会话工厂 ==========
const createDefaultSession = (): Session => ({
  id: uid(),
  title: '新对话',
  messages: [
    {
      id: uid(),
      groupId: 'init',
      role: 'assistant',
      type: 'text',
      status: 'success',
      content: '你好！我是具备 **思考能力**、**知识库检索（RAG）** 和 **工具调用（MCP）** 的智能 Agent 助手。\n\n你可以问我关于项目的问题，或者让我执行工具操作。每一次对话你都能看到我的完整思考链路。',
    },
  ],
  summary: '',
  updatedAt: now(),
});

// ========== 模块级变量 ==========
let currentAbortController: AbortController | null = null;
let summaryDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// ========== Store ==========
export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => {
      const defaultSession = createDefaultSession();
      return {
      sessions: [defaultSession],
      currentSessionId: defaultSession.id,
      isGenerating: false,
      knowledgeBases: DEFAULT_KNOWLEDGE_BASES,
      mcpServers: DEFAULT_MCP_SERVERS,
      tokenUsage: null,
      showThoughtProcess: true,

      // --- 辅助方法 ---
      getCurrentMessages: () => {
        const { sessions, currentSessionId } = get();
        return sessions.find((s) => s.id === currentSessionId)?.messages || [];
      },

      // --- Agent 消息操作 ---
      addMessage: (msg) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.currentSessionId
              ? { ...s, messages: [...s.messages, msg], updatedAt: now() }
              : s,
          ),
        }));
      },

      updateMessage: (id, updates) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== state.currentSessionId) return s;
            return {
              ...s,
              messages: s.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
              updatedAt: now(),
            };
          }),
        }));
      },

      // --- 会话管理 ---
      createNewSession: () => {
        const newSession = createDefaultSession();
        set((state) => ({
          sessions: [newSession, ...state.sessions],
          currentSessionId: newSession.id,
        }));
      },

      switchSession: (id) => set({ currentSessionId: id }),

      deleteSession: (id) => {
        set((state) => {
          const newSessions = state.sessions.filter((s) => s.id !== id);
          if (newSessions.length === 0) {
            const fallback = createDefaultSession();
            return { sessions: [fallback], currentSessionId: fallback.id };
          }
          return {
            sessions: newSessions,
            currentSessionId: state.currentSessionId === id ? newSessions[0].id : state.currentSessionId,
          };
        });
      },

      clearMessages: () =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.currentSessionId
              ? { ...s, messages: createDefaultSession().messages, summary: '' }
              : s,
          ),
        })),

      stopGeneration: () => {
        if (currentAbortController) {
          currentAbortController.abort();
          currentAbortController = null;
        }
        set({ isGenerating: false });
      },

      // --- 控制面板操作 ---
      toggleKnowledgeBase: (id) =>
        set((state) => ({
          knowledgeBases: state.knowledgeBases.map((kb) =>
            kb.id === id ? { ...kb, enabled: !kb.enabled } : kb,
          ),
        })),

      toggleMCPServer: (id) =>
        set((state) => ({
          mcpServers: state.mcpServers.map((srv) =>
            srv.id === id
              ? { ...srv, status: srv.status === 'connected' ? 'disconnected' : 'connected' }
              : srv,
          ),
        })),

      toggleThoughtProcess: () =>
        set((state) => ({ showThoughtProcess: !state.showThoughtProcess })),

      // --- 摘要生成 ---
      generateSummaryForCurrentSession: async () => {
        const { currentSessionId, sessions } = get();
        const session = sessions.find((s) => s.id === currentSessionId);
        if (!session) return;

        const msgs = session.messages
          .filter((m) => m.type === 'text' && (m.role === 'user' || m.role === 'assistant'))
          .slice(0, SUMMARY_COUNT)
          .map((m) => ({ role: m.role, content: m.content || '' }));

        if (msgs.length === 0) return;

        try {
          const newSummary = await requestSummary(msgs);
          set((state) => ({
            sessions: state.sessions.map((s) => {
              if (s.id !== state.currentSessionId) return s;
              const combined = s.summary ? `${s.summary}；${newSummary}` : newSummary;
              return { ...s, summary: combined };
            }),
          }));
        } catch {
          // 静默失败
        }
      },

      // ========== 核心：发送消息（Agent 完整执行流程） ==========
      sendMessage: async (text: string) => {
        const { currentSessionId, sessions, knowledgeBases, mcpServers, addMessage, updateMessage } = get();

        // 辅助：更新会话
        const updateSessionMeta = (updater: (msgs: AgentMessage[]) => AgentMessage[], newTitle?: string) => {
          set((state) => ({
            sessions: state.sessions.map((s) => {
              if (s.id !== state.currentSessionId) return s;
              return {
                ...s,
                messages: updater(s.messages),
                title: newTitle || s.title,
                updatedAt: now(),
              };
            }),
          }));
        };

        // ====== 阶段一：用户消息上屏 ======
        const groupId = uid(); // 本轮对话的"思考链路"分组ID
        const userMsg: AgentMessage = {
          id: uid(),
          groupId,
          role: 'user',
          type: 'text',
          status: 'success',
          content: text,
        };

        const curSession = sessions.find((s) => s.id === currentSessionId);
        const isFirstUserMsg = !curSession?.messages.some((m) => m.role === 'user');
        const sessionTitle = isFirstUserMsg ? text.slice(0, 15) : undefined;

        updateSessionMeta((msgs) => [...msgs, userMsg], sessionTitle);
        set({ isGenerating: true });

        // 创建 AbortController
        const abortController = new AbortController();
        currentAbortController = abortController;

        try {
          // ====== 阶段二：Agent 思考（模拟） ======
          const thoughtMsg: AgentMessage = {
            id: uid(),
            groupId,
            role: 'assistant',
            type: 'thought',
            status: 'streaming',
            content: '',
          };
          addMessage(thoughtMsg);

          // 获取启用的知识库和 MCP Server
          const enabledKBs = knowledgeBases.filter((kb) => kb.enabled);
          const connectedMCPs = mcpServers.filter((srv) => srv.status === 'connected');

          // 根据用户意图构建思考内容
          const shouldSearchKB = enabledKBs.length > 0 &&
            (text.includes('怎么') || text.includes('什么') || text.includes('如何') ||
             text.includes('介绍') || text.includes('原理') || text.includes('架构'));
          const shouldUseMCP = connectedMCPs.length > 0 &&
            (text.includes('文件') || text.includes('代码') || text.includes('读取') ||
             text.includes('查看') || text.includes('目录') || text.includes('打开'));

          // 构建中文思考过程
          let thoughtContent = '';
          const thoughtSteps: string[] = [];

          thoughtSteps.push('🤔 **分析用户意图**：用户询问 "' + text + '"，我需要理解其核心需求。');

          if (shouldSearchKB) {
            thoughtSteps.push('📚 **决策**：该问题涉及专业知识，我需要检索知识库（RAG）来获取准确信息。已启用的知识库：' +
              enabledKBs.map(kb => kb.name).join('、'));
          }

          if (shouldUseMCP) {
            thoughtSteps.push('🔧 **决策**：该问题涉及项目文件操作，我需要通过 MCP 工具来访问文件系统。已连接的 MCP Server：' +
              connectedMCPs.map(srv => srv.name).join('、'));
          }

          if (!shouldSearchKB && !shouldUseMCP) {
            thoughtSteps.push('💡 **决策**：这是一个常规对话，直接基于我的知识进行回答即可。');
          } else {
            thoughtSteps.push('📋 **计划执行步骤**：\n1. 先通过工具获取必要信息\n2. 分析工具返回的数据\n3. 整合信息形成完整回答');
          }

          thoughtContent = thoughtSteps.join('\n\n');
          updateMessage(thoughtMsg.id, { content: thoughtContent, status: 'success' });

          // ====== 阶段三：执行工具调用（模拟 RAG + MCP） ======
          const toolResults: Array<{ name: string; result: unknown }> = [];

          if (shouldSearchKB && enabledKBs.length > 0) {
            // RAG 知识库检索
            const ragCallMsg: AgentMessage = {
              id: uid(),
              groupId,
              role: 'assistant',
              type: 'tool_call',
              status: 'streaming',
              toolName: 'rag_search',
              toolCallId: 'call_rag_' + uid(),
              args: { query: text, knowledgeBases: enabledKBs.map(kb => kb.name) },
            };
            addMessage(ragCallMsg);

            // 模拟检索延迟
            await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));

            if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');

            const searchResults = simulateRAGSearch(text);
            updateMessage(ragCallMsg.id, { status: 'success' });

            const ragResultMsg: AgentMessage = {
              id: uid(),
              groupId,
              role: 'tool',
              type: 'tool_result',
              status: 'success',
              toolName: 'rag_search',
              toolCallId: ragCallMsg.toolCallId,
              result: { query: text, matches: searchResults.length, results: searchResults },
            };
            addMessage(ragResultMsg);
            toolResults.push({ name: 'rag_search', result: ragResultMsg.result });
          }

          if (shouldUseMCP && connectedMCPs.length > 0) {
            // MCP 工具调用 — 根据意图选择操作
            const isReadFile = text.includes('读取') || text.includes('查看内容') || text.includes('打开');
            const isListDir = text.includes('目录') || text.includes('列出') || text.includes('文件列表');
            const targetPath = extractPathFromText(text) || '/src/App.tsx';

            const mcpToolName = isReadFile ? 'mcp_read_file' : isListDir ? 'mcp_list_directory' : 'mcp_read_file';
            const mcpCallMsg: AgentMessage = {
              id: uid(),
              groupId,
              role: 'assistant',
              type: 'tool_call',
              status: 'streaming',
              toolName: mcpToolName,
              toolCallId: 'call_mcp_' + uid(),
              args: isListDir ? { path: '/' } : { path: targetPath },
            };
            addMessage(mcpCallMsg);

            await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
            if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');

            updateMessage(mcpCallMsg.id, { status: 'success' });

            const mcpResult = isListDir
              ? simulateMCPListDirectory('/')
              : simulateMCPFileRead(targetPath);

            const mcpErrMsg = !mcpResult.success && 'error' in mcpResult ? mcpResult.error : undefined;
            const mcpResultMsg: AgentMessage = {
              id: uid(),
              groupId,
              role: 'tool',
              type: 'tool_result',
              status: mcpResult.success ? 'success' : 'error',
              toolName: mcpToolName,
              toolCallId: mcpCallMsg.toolCallId,
              result: mcpResult,
              error: mcpErrMsg,
            };
            addMessage(mcpResultMsg);
            toolResults.push({ name: mcpToolName, result: mcpResult });
          }

          // ====== 阶段四：综合思考——基于工具结果形成回答 ======
          if (toolResults.length > 0) {
            const synthesisThought: AgentMessage = {
              id: uid(),
              groupId,
              role: 'assistant',
              type: 'thought',
              status: 'streaming',
              content: '',
            };
            addMessage(synthesisThought);

            await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
            if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');

            let synthesisContent = '🔍 **分析工具返回结果**：\n\n';
            for (const tr of toolResults) {
              if (tr.name === 'rag_search') {
                const r = tr.result as { matches?: number; results?: RAGSearchResult[] };
                synthesisContent += `- 知识库检索到 **${r?.matches || 0}** 条相关文档，正在整合信息...\n`;
              } else if (tr.name === 'mcp_read_file') {
                const r = tr.result as { success?: boolean };
                synthesisContent += r?.success
                  ? '- 文件读取成功，已获取文件内容用于分析。\n'
                  : '- 文件读取失败，将基于已有知识回答。\n';
              } else if (tr.name === 'mcp_list_directory') {
                const r = tr.result as { files?: string[] };
                synthesisContent += `- 目录扫描完成，共找到 **${r?.files?.length || 0}** 个文件。\n`;
              }
            }
            synthesisContent += '\n✅ **信息收集完毕**，现在整合所有数据，生成最终回答...';
            updateMessage(synthesisThought.id, { content: synthesisContent, status: 'success' });
          }

          // ====== 阶段五：调用大模型生成最终回答 ======
          const aiTextMsg: AgentMessage = {
            id: uid(),
            groupId,
            role: 'assistant',
            type: 'text',
            status: 'streaming',
            content: '',
          };
          addMessage(aiTextMsg);

          const latestSession = get().sessions.find((s) => s.id === currentSessionId);
          const allMsgs = latestSession?.messages || [];
          const summary = latestSession?.summary || '';
          console.log('📋 当前会话消息数:', allMsgs.length, '摘要长度:', summary.length);
          console.log('📋 消息列表:', allMsgs.map(m => `${m.role}:${m.type}:${m.content?.slice(0, 30)}`));
          const payload = buildPayloadMessages(allMsgs, summary);
          console.log('📤 最终 Payload 消息数:', payload.length);

          const apiKey = import.meta.env.VITE_AI_API_KEY;
          console.log('🔑 API Key 已加载:', apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : '❌ 未配置');

          const requestBody = {
            model: 'glm-4-flash',
            messages: payload,
            stream: true,
          };

          const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
            signal: abortController.signal,
          });

          if (!response.ok) {
            const errorBody = await response.text();
            console.error('API 请求失败:', response.status, errorBody);
            console.log('请求 Payload:', JSON.stringify({ model: 'glm-4-flash', messages: payload.slice(0, 3), stream: true }, null, 2));
            throw new Error(`API 请求失败: ${response.status} — ${errorBody}`);
          }
          const reader = response.body?.getReader();
          if (!reader) throw new Error('无法读取响应流');

          const decoder = new TextDecoder('utf-8');
          let fullReply = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkStr = decoder.decode(value, { stream: true });
            const lines = chunkStr.split('\n');

            for (const line of lines) {
              if (line.startsWith('data:') && !line.includes('[DONE]')) {
                const jsonStr = line.replace('data:', '').trim();
                if (!jsonStr) continue;
                try {
                  const data = JSON.parse(jsonStr) as APIResponse;
                  const delta = data.choices?.[0]?.delta;

                  // 检查是否有 tool_calls
                  if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                      if (tc.function?.name) {
                        // 模型主动发起了工具调用
                        const tcMsg: AgentMessage = {
                          id: uid(),
                          groupId,
                          role: 'assistant',
                          type: 'tool_call',
                          status: 'success',
                          toolName: tc.function.name,
                          toolCallId: tc.id || uid(),
                          args: tc.function.arguments || '{}',
                        };
                        addMessage(tcMsg);
                      }
                    }
                  }

                  // 文本内容
                  const char = delta?.content;
                  if (char) {
                    fullReply += char;
                    updateMessage(aiTextMsg.id, { content: fullReply });
                  }
                } catch {
                  // JSON 解析失败，跳过
                }
              }
            }
          }

          // 标记文本消息完成
          updateMessage(aiTextMsg.id, { status: 'success' });

          // 更新 Token 用量（模拟）
          set({
            tokenUsage: {
              promptTokens: Math.round(fullReply.length * 0.8),
              completionTokens: fullReply.length,
              totalTokens: Math.round(fullReply.length * 1.8),
            },
          });

          // ====== 阶段六：检查是否需要摘要 ======
          const updatedSession = get().sessions.find((s) => s.id === currentSessionId);
          if (updatedSession && updatedSession.messages.length >= SUMMARY_THRESHOLD) {
            if (summaryDebounceTimer) clearTimeout(summaryDebounceTimer);
            summaryDebounceTimer = setTimeout(() => {
              get().generateSummaryForCurrentSession();
              set((state) => ({
                sessions: state.sessions.map((s) => {
                  if (s.id !== state.currentSessionId) return s;
                  const recentMsgs = s.messages.slice(-SUMMARY_COUNT);
                  return { ...s, messages: recentMsgs };
                }),
              }));
            }, SUMMARY_DEBOUNCE_MS);
          }
        } catch (error: unknown) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            // 用户中断
          } else {
            console.error('请求失败:', error);
            const errMsg: AgentMessage = {
              id: uid(),
              groupId,
              role: 'assistant',
              type: 'text',
              status: 'error',
              content: '❌ 抱歉，网络连接出现问题，请稍后重试。',
            };
            addMessage(errMsg);
          }
        } finally {
          set({ isGenerating: false });
          if (currentAbortController === abortController) {
            currentAbortController = null;
          }
        }
      },
    };
  },
    {
      name: 'agent_chat_history_v2',
    },
  ),
);

// ========== 辅助：从文本中提取文件路径 ==========
function extractPathFromText(text: string): string | null {
  const match = text.match(/\/[a-zA-Z0-9_\/.-]+\.[a-zA-Z]+/);
  return match ? match[0] : null;
}
