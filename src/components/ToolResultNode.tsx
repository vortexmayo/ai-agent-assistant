import React, { useState } from 'react';
import type { AgentMessage } from '../types/chat';

interface ToolResultNodeProps {
  message: AgentMessage;
}

/**
 * 工具结果节点组件
 * 展示工具调用的返回结果，包含：
 * - 默认折叠的 JSON 数据框
 * - 结果摘要
 * - RAG 搜索结果的特殊渲染
 * - 文件内容的高亮展示
 */
export const ToolResultNode: React.FC<ToolResultNodeProps> = ({ message }) => {
  const [collapsed, setCollapsed] = useState(true);
  const isError = message.status === 'error';

  // 提取结果摘要
  const summary = getResultSummary(message);

  return (
    <div className="my-2 ml-4 border-l-2 border-green-400/60 pl-4">
      <div className={`rounded-lg border overflow-hidden
        ${isError ? 'bg-red-50/50 border-red-200' : 'bg-green-50/40 border-green-100'}`}
      >
        {/* 结果头部 - 可点击折叠 */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium
            text-green-700 hover:bg-green-100/50 transition-colors cursor-pointer select-none"
        >
          <span className={`text-sm ${isError ? '' : ''}`}>
            {isError ? '❌' : '✅'}
          </span>
          <span className="flex-1 text-left">
            {isError ? '工具执行失败' : `工具结果: ${summary}`}
          </span>
          <span
            className="text-green-400 transition-transform text-[10px]"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          >
            ▼
          </span>
        </button>

        {/* 结果内容（可折叠） */}
        {!collapsed && (
          <div className="border-t border-green-200/50">
            {/* RAG 搜索结果特殊渲染 */}
            {message.toolName === 'rag_search' && isRAGResult(message.result) && (
              <RAGResults results={message.result.results} />
            )}

            {/* 文件内容渲染 */}
            {message.toolName === 'mcp_read_file' && isFileReadResult(message.result) && (
              <FileContent
                content={message.result.content}
                path={getPathArg(message.args)}
              />
            )}

            {/* 文件列表渲染 */}
            {message.toolName === 'mcp_list_directory' && isFileListResult(message.result) && (
              <FileList files={message.result.files} />
            )}

            {/* 通用 JSON 渲染 */}
            <div className="p-3">
              <pre className="text-xs text-green-800/70 font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto bg-green-100/30 p-2 rounded">
                {formatJSON(message.result)}
              </pre>
            </div>
          </div>
        )}

        {/* 折叠状态下的简略预览 */}
        {collapsed && (
          <div className="px-3 pb-2 text-[11px] text-green-600/50 truncate">
            {getTruncatedPreview(message)}
          </div>
        )}
      </div>
    </div>
  );
};

// ========== RAG 搜索结果子组件 ==========
interface RAGResultItem {
  chunkId: string;
  content: string;
  score: number;
  source: string;
}

const RAGResults: React.FC<{ results: RAGResultItem[] }> = ({ results }) => (
  <div className="p-3 space-y-2">
    <div className="text-xs font-medium text-green-700">
      📚 检索到 {results.length} 条相关文档：
    </div>
    {results.map((item) => (
      <div key={item.chunkId} className="bg-white/60 rounded p-2 border border-green-100">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-green-700">{item.source}</span>
          <span className="text-[10px] text-green-500 bg-green-100 px-1.5 py-0.5 rounded">
            相关度: {(item.score * 100).toFixed(0)}%
          </span>
        </div>
        <p className="text-xs text-green-700/70 leading-relaxed line-clamp-3">
          {item.content}
        </p>
      </div>
    ))}
  </div>
);

// ========== 文件内容子组件 ==========
const FileContent: React.FC<{ content: string; path: string }> = ({ content, path }) => (
  <div className="p-3">
    <div className="text-xs font-medium text-green-700 mb-1">
      📄 {path}
    </div>
    <pre className="text-xs text-green-800/70 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto bg-slate-900 text-green-300 p-3 rounded">
      {content}
    </pre>
  </div>
);

// ========== 文件列表子组件 ==========
const FileList: React.FC<{ files: string[] }> = ({ files }) => (
  <div className="p-3">
    <div className="text-xs font-medium text-green-700 mb-1">
      📂 目录内容 ({files.length} 个文件)：
    </div>
    <div className="flex flex-wrap gap-1">
      {files.map((f) => (
        <span key={f} className="text-[10px] bg-white/60 px-1.5 py-0.5 rounded border border-green-100 font-mono text-green-700">
          {f}
        </span>
      ))}
    </div>
  </div>
);

// ========== 工具函数 ==========

function getResultSummary(message: AgentMessage): string {
  if (!message.result) return '空结果';

  try {
    const obj = typeof message.result === 'object' ? message.result : JSON.parse(String(message.result));

    if (message.toolName === 'rag_search' && 'matches' in obj) {
      return `找到 ${obj.matches} 条匹配文档`;
    }
    if (message.toolName === 'mcp_read_file' && 'success' in obj) {
      return obj.success ? '文件读取成功' : '文件读取失败';
    }
    if (message.toolName === 'mcp_list_directory' && 'files' in obj) {
      return `共 ${obj.files?.length || 0} 个文件`;
    }
    return '执行完成';
  } catch {
    return '执行完成';
  }
}

function getTruncatedPreview(message: AgentMessage): string {
  try {
    const str = typeof message.result === 'string' ? message.result : JSON.stringify(message.result);
    return str.slice(0, 100) + (str.length > 100 ? '...' : '');
  } catch {
    return '...';
  }
}

function formatJSON(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

// ========== 类型守卫函数 ==========

function isRAGResult(result: unknown): result is { results: RAGResultItem[] } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'results' in result &&
    Array.isArray((result as Record<string, unknown>).results)
  );
}

function isFileReadResult(result: unknown): result is { content: string } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'content' in result &&
    typeof (result as Record<string, unknown>).content === 'string'
  );
}

function isFileListResult(result: unknown): result is { files: string[] } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'files' in result &&
    Array.isArray((result as Record<string, unknown>).files)
  );
}

function getPathArg(args?: string | object): string {
  if (typeof args === 'object' && args !== null && 'path' in args) {
    return String((args as Record<string, unknown>).path);
  }
  return 'unknown';
}
