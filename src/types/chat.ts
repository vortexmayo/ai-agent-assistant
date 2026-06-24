// ========== 消息状态枚举 ==========
export type MessageStatus = 'pending' | 'streaming' | 'success' | 'error';

// ========== 消息类型枚举 ==========
export type MessageType = 'text' | 'thought' | 'tool_call' | 'tool_result';

// ========== Agent 消息角色 ==========
export type AgentRole = 'user' | 'assistant' | 'system' | 'tool';

// ========== 工具调用状态 ==========
export type ToolCallStatus = 'calling' | 'running' | 'done' | 'error';

// ========== Agent 消息协议（核心数据结构） ==========
export interface AgentMessage {
  id: string;
  groupId: string;          // 同一轮对话的"思考链路"分组
  role: AgentRole;
  type: MessageType;
  status: MessageStatus;

  // 针对不同消息类型的载荷
  content?: string;         // text / thought 的文本内容
  toolName?: string;        // tool_call 的工具名，如 'rag_search'
  toolCallId?: string;      // 工具调用的唯一ID
  args?: string | object;   // tool_call 的参数
  result?: unknown;         // tool_result 的返回结果
  error?: string;           // 错误信息
}

// ========== 会话数据结构（扩展版） ==========
export interface Session {
  id: string;
  title: string;
  messages: AgentMessage[];
  summary: string;
  updatedAt: number;
}

// ========== 知识库配置 ==========
export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

// ========== MCP Server 配置 ==========
export interface MCPServer {
  id: string;
  name: string;
  type: 'filesystem' | 'github' | 'api' | 'database';
  status: 'connected' | 'disconnected' | 'connecting';
  description: string;
}

// ========== Token 用量统计 ==========
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ========== 发送给大模型的 Payload ==========
export interface PayloadMessage {
  role: string;
  content: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

// ========== 大模型 API 响应结构 ==========
export interface APIResponse {
  choices: Array<{
    delta: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: TokenUsage;
}

// ========== RAG 搜索结果 ==========
export interface RAGSearchResult {
  chunkId: string;
  content: string;
  score: number;
  source: string;
}
