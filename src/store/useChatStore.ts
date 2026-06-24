import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type AgentMessage,
  type Session,
  type APIResponse,
  type KnowledgeBase,
  type MCPServer,
  type TokenUsage,
} from '../types/chat';

// ========== 常量配置 ==========
const SYSTEM_PROMPT: string =
  '你是一个智能 Agent 助手，具备思考能力、知识库检索（RAG）和工具调用（MCP）能力。' +
  '在回答用户问题时，请先进行思考（用中文），然后根据需要调用工具获取信息，最后给出完整回答。' +
  '当用户询问需要外部信息的问题时，主动使用工具。';

const SUMMARY_THRESHOLD = 15;
const SUMMARY_COUNT = 8;
const SUMMARY_DEBOUNCE_MS = 3000;

// ========== MCP 代理服务配置 ==========
const MCP_PROXY_URL = 'http://localhost:3001';
const MAX_TOOL_CALL_ROUNDS = 5; // 最大工具调用轮数，防止无限循环

// ========== MCP 工具定义类型（与代理服务返回格式一致） ==========
interface MCPToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}


// ========== 默认 MCP Server 列表 ==========
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

// ========== MCP 代理通信函数 ==========

/** 检查 MCP 代理服务是否在线 */
async function checkMCPHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${MCP_PROXY_URL}/api/mcp/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** 从 MCP 代理获取可用工具列表 */
async function fetchMCPTools(): Promise<MCPToolDef[]> {
  const res = await fetch(`${MCP_PROXY_URL}/api/mcp/tools`);
  if (!res.ok) throw new Error('获取工具列表失败');
  const data = await res.json();
  return data.tools || [];
}

/** 将 MCP 工具定义转换为智谱 API 的 tools 格式 */
function toZhipuTools(mcpTools: MCPToolDef[]) {
  return mcpTools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

/** 执行真实的 MCP 工具调用 */
async function executeMCPCall(toolName: string, args: Record<string, unknown>) {
  const res = await fetch(`${MCP_PROXY_URL}/api/mcp/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolName, args }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${res.status}`);
  }
  return res.json();
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
        const { currentSessionId, sessions, addMessage, updateMessage } = get();

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
          // ====== 阶段二：Agent 思考 ======
          const thoughtMsg: AgentMessage = {
            id: uid(),
            groupId,
            role: 'assistant',
            type: 'thought',
            status: 'streaming',
            content: '',
          };
          addMessage(thoughtMsg);

          // 检测 MCP 代理是否在线
          const mcpOnline = await checkMCPHealth();
          let mcpTools: MCPToolDef[] = [];
          if (mcpOnline) {
            try {
              mcpTools = await fetchMCPTools();
              console.log(`🔧 已加载 ${mcpTools.length} 个 MCP 工具:`, mcpTools.map((t) => t.name).join(', '));
            } catch {
              console.warn('⚠️ MCP 工具列表获取失败，以纯聊天模式运行');
            }
          }

          // 构建中文思考过程
          const thoughtSteps: string[] = [];
          thoughtSteps.push(`🤔 **分析用户意图**：收到问题 "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`);
          if (mcpTools.length > 0) {
            thoughtSteps.push(`🔧 **MCP 已就绪**：已连接 SQLite 数据库代理服务，可用工具：${mcpTools.map((t) => t.name).join('、')}`);
            thoughtSteps.push('📋 **策略**：大模型将自主判断是否需要调用工具查询数据库。\n可查询的表：users（用户）、products（产品）、sales（销售）、tasks（任务）');
          } else if (mcpOnline) {
            thoughtSteps.push('⚠️ **MCP 工具加载异常**，以纯聊天模式回答');
          } else {
            thoughtSteps.push('💡 **MCP 代理未启动**，以纯聊天模式回答。如需使用数据库查询功能，请先运行 `npm run mcp-server` 启动代理服务');
          }
          updateMessage(thoughtMsg.id, { content: thoughtSteps.join('\n\n'), status: 'success' });

          // ====== 阶段三：工具调用循环（大模型自主决策 + 真实 MCP 执行） ======
          const apiKey = import.meta.env.VITE_AI_API_KEY;
          const allToolResults: Array<{ toolCallId: string; toolName: string; result: unknown }> = [];

          // 构建初始消息 Payload
          const latestSession = get().sessions.find((s) => s.id === currentSessionId);
          const summary = latestSession?.summary || '';
          let currentPayload = buildPayloadMessages(
            get().sessions.find((s) => s.id === currentSessionId)?.messages || [],
            summary,
          );

          // 工具调用循环（最多 MAX_TOOL_CALL_ROUNDS 轮）
          for (let round = 0; round < MAX_TOOL_CALL_ROUNDS; round++) {
            if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');

            // 构建请求体（首轮带 tools，后续轮次根据情况决定）
            const requestBody: Record<string, unknown> = {
              model: 'glm-4-flash',
              messages: currentPayload,
              stream: true,
            };
            if (mcpTools.length > 0 && round < MAX_TOOL_CALL_ROUNDS - 1) {
              requestBody.tools = toZhipuTools(mcpTools);
            }

            console.log(`🔄 第 ${round + 1} 轮模型请求，Payload ${currentPayload.length} 条消息，工具 ${mcpTools.length} 个`);

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
              throw new Error(`API 请求失败: ${response.status} — ${errorBody}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('无法读取响应流');

            // 累积本轮结果
            let fullReply = '';
            const toolCallsAcc: Map<number, { id: string; name: string; arguments: string }> = new Map();
            let finishReason = '';
            const aiTextMsg: AgentMessage = {
              id: uid(),
              groupId,
              role: 'assistant',
              type: 'text',
              status: 'streaming',
              content: '',
            };
            addMessage(aiTextMsg);

            const decoder = new TextDecoder('utf-8');
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunkStr = decoder.decode(value, { stream: true });
              const lines = chunkStr.split('\n');

              for (const line of lines) {
                if (!line.startsWith('data:') || line.includes('[DONE]')) continue;
                const jsonStr = line.replace('data:', '').trim();
                if (!jsonStr) continue;

                try {
                  const data = JSON.parse(jsonStr) as APIResponse;
                  const delta = data.choices?.[0]?.delta;
                  finishReason = data.choices?.[0]?.finish_reason || finishReason;

                  // 累积 tool_calls 片段（SSE 可能分包传输）
                  if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                      const idx = tc.index ?? 0;
                      if (!toolCallsAcc.has(idx)) {
                        toolCallsAcc.set(idx, { id: tc.id || '', name: '', arguments: '' });
                      }
                      const acc = toolCallsAcc.get(idx)!;
                      if (tc.id) acc.id = tc.id;
                      if (tc.function?.name) acc.name += tc.function.name;
                      if (tc.function?.arguments) acc.arguments += tc.function.arguments;
                    }
                  }

                  // 流式文本
                  if (delta?.content) {
                    fullReply += delta.content;
                    updateMessage(aiTextMsg.id, { content: fullReply });
                  }
                } catch {
                  // JSON 解析失败，跳过
                }
              }
            }

            // 本轮结束：判断是否有工具调用需要执行
            if (toolCallsAcc.size > 0) {
              // 删除空文本消息（模型只返回了工具调用，没有文本）
              if (!fullReply) {
                updateMessage(aiTextMsg.id, { status: 'success', content: '' });
              }

              // 展示并执行每一个工具调用
              const roundResults: Array<{ toolCallId: string; toolName: string; result: unknown }> = [];

              for (const [, tc] of toolCallsAcc) {
                console.log(`🔧 模型调用工具: ${tc.name}`, tc.arguments.slice(0, 200));

                // 展示 tool_call 消息
                const tcMsgId = uid();
                const tcMsg: AgentMessage = {
                  id: tcMsgId,
                  groupId,
                  role: 'assistant',
                  type: 'tool_call',
                  status: 'streaming',
                  toolName: tc.name,
                  toolCallId: tc.id,
                  args: tc.arguments,
                };
                addMessage(tcMsg);

                // 执行真实 MCP 调用
                try {
                  let parsedArgs: Record<string, unknown> = {};
                  try { parsedArgs = JSON.parse(tc.arguments); } catch { /* 参数可能为空 */ }

                  const mcpRes = await executeMCPCall(tc.name, parsedArgs);
                  updateMessage(tcMsgId, { status: 'success' });

                  const resultMsg: AgentMessage = {
                    id: uid(),
                    groupId,
                    role: 'tool',
                    type: 'tool_result',
                    status: 'success',
                    toolName: tc.name,
                    toolCallId: tc.id,
                    result: mcpRes.result,
                  };
                  addMessage(resultMsg);
                  roundResults.push({ toolCallId: tc.id, toolName: tc.name, result: mcpRes.result });
                } catch (err) {
                  updateMessage(tcMsgId, { status: 'error', error: (err as Error).message });
                  const errMsg: AgentMessage = {
                    id: uid(),
                    groupId,
                    role: 'tool',
                    type: 'tool_result',
                    status: 'error',
                    toolName: tc.name,
                    toolCallId: tc.id,
                    error: (err as Error).message,
                  };
                  addMessage(errMsg);
                  roundResults.push({ toolCallId: tc.id, toolName: tc.name, result: { error: (err as Error).message } });
                }
              }

              allToolResults.push(...roundResults);

              // 更新 Payload：追加 assistant tool_calls 和 tool results
              const assistantToolCallMsg = {
                role: 'assistant' as const,
                content: null,
                tool_calls: Array.from(toolCallsAcc.entries()).map(([, tc]) => ({
                  id: tc.id,
                  type: 'function' as const,
                  function: { name: tc.name, arguments: tc.arguments },
                })),
              };
              currentPayload.push(assistantToolCallMsg as unknown as { role: string; content: string });

              for (const rr of roundResults) {
                currentPayload.push({
                  role: 'tool',
                  tool_call_id: rr.toolCallId,
                  content: JSON.stringify(rr.result),
                } as unknown as { role: string; content: string });
              }

              console.log(`✅ 第 ${round + 1} 轮完成，执行了 ${toolCallsAcc.size} 个工具调用，准备下一轮...`);
            } else {
              // 没有工具调用，标记完成并退出循环
              updateMessage(aiTextMsg.id, { status: 'success' });
              set({
                tokenUsage: {
                  promptTokens: Math.round(JSON.stringify(currentPayload).length / 2),
                  completionTokens: fullReply.length,
                  totalTokens: Math.round(JSON.stringify(currentPayload).length / 2 + fullReply.length),
                },
              });
              break;
            }

            // 最后一轮检查：如果还有工具调用但已达最大轮数
            if (round === MAX_TOOL_CALL_ROUNDS - 1) {
              console.warn('⚠️ 达到最大工具调用轮数，强制结束');
            }
          }

          // ====== 阶段四：检查是否需要摘要 ======
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
            // 用户主动中断
          } else {
            console.error('请求失败:', error);
            const errMsg: AgentMessage = {
              id: uid(),
              groupId,
              role: 'assistant',
              type: 'text',
              status: 'error',
              content: '❌ 抱歉，请求出现问题：' + ((error as Error).message || '未知错误'),
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

