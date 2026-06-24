import React from 'react';
import type { AgentMessage } from '../types/chat';

interface ToolCallNodeProps {
  message: AgentMessage;
}

/**
 * 工具调用节点组件
 * 展示 AI 发起的工具调用，包含：
 * - 工具图标（根据工具名自动匹配）
 * - 工具名称与状态标识
 * - 调用参数展示
 * - 实时状态动画
 */
export const ToolCallNode: React.FC<ToolCallNodeProps> = ({ message }) => {
  const isRunning = message.status === 'streaming' || message.status === 'pending';
  const isError = message.status === 'error';

  // 根据工具名选择图标和颜色
  const toolMeta = getToolMeta(message.toolName || '');

  // 格式化参数展示
  const argsDisplay = formatArgs(message.args);

  return (
    <div className="my-2 ml-4 border-l-2 border-blue-400/60 pl-4">
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border transition-all
          ${isRunning
            ? 'bg-blue-50/80 border-blue-200 animate-pulse'
            : isError
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50/40 border-blue-100'
          }`}
      >
        {/* 工具图标 */}
        <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg
          ${isRunning ? 'bg-blue-200 animate-spin-slow' : 'bg-blue-100'}
        `}>
          {isRunning ? '⚙️' : toolMeta.icon}
        </div>

        {/* 工具信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-blue-700">
              {toolMeta.label}
            </span>
            {/* 状态标识 */}
            <StatusBadge status={message.status} />
          </div>

          {/* 参数摘要 */}
          {argsDisplay && (
            <div className="mt-1 text-xs text-blue-600/70 font-mono truncate max-w-md">
              {argsDisplay}
            </div>
          )}
        </div>

        {/* RAG 特殊标识：搜索放大镜 */}
        {message.toolName === 'rag_search' && (
          <span className="shrink-0 text-blue-400" title="正在检索知识库">
            🔍
          </span>
        )}
      </div>
    </div>
  );
};

// ========== 状态徽章 ==========
const StatusBadge: React.FC<{ status: AgentMessage['status'] }> = ({ status }) => {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: '等待中', className: 'bg-gray-100 text-gray-500' },
    streaming: { label: '执行中', className: 'bg-blue-100 text-blue-600 animate-pulse' },
    success: { label: '✓ 完成', className: 'bg-green-100 text-green-600' },
    error: { label: '✗ 失败', className: 'bg-red-100 text-red-600' },
  };

  const c = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${c.className}`}>
      {c.label}
    </span>
  );
};

// ========== 工具元数据映射 ==========
function getToolMeta(toolName: string): { icon: string; label: string } {
  const meta: Record<string, { icon: string; label: string }> = {
    rag_search: { icon: '📚', label: '知识库检索 (RAG)' },
    mcp_read_file: { icon: '📄', label: '读取文件 (MCP)' },
    mcp_write_file: { icon: '✏️', label: '写入文件 (MCP)' },
    mcp_list_directory: { icon: '📂', label: '列出目录 (MCP)' },
    web_search: { icon: '🌐', label: '网络搜索' },
    code_execute: { icon: '▶️', label: '代码执行' },
  };

  return meta[toolName] || { icon: '🔧', label: `工具调用: ${toolName}` };
}

// ========== 参数格式化 ==========
function formatArgs(args?: string | object): string {
  if (!args) return '';
  try {
    const obj = typeof args === 'string' ? JSON.parse(args) : args;
    // 特殊处理常见参数
    if (obj && typeof obj === 'object') {
      const parts: string[] = [];
      if ('query' in obj) parts.push(`查询: "${obj.query}"`);
      if ('path' in obj) parts.push(`路径: ${obj.path}`);
      if ('knowledgeBases' in obj && Array.isArray(obj.knowledgeBases)) {
        parts.push(`知识库: ${obj.knowledgeBases.join(', ')}`);
      }
      if (parts.length > 0) return parts.join(' | ');
    }
    return JSON.stringify(obj, null, 0).slice(0, 120);
  } catch {
    return String(args).slice(0, 120);
  }
}
