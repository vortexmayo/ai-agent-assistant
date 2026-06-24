import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { AgentMessage } from '../types/chat';

interface ThoughtNodeProps {
  message: AgentMessage;
}

/**
 * 思考过程节点组件
 * 以可折叠卡片形式展示 AI 的思考过程，支持：
 * - 思考中动画（脉冲光效）
 * - 折叠/展开切换
 * - Markdown 格式思考内容
 */
export const ThoughtNode: React.FC<ThoughtNodeProps> = ({ message }) => {
  const [collapsed, setCollapsed] = useState(false);
  const isStreaming = message.status === 'streaming' || message.status === 'pending';

  return (
    <div className="my-3 ml-4 border-l-2 border-amber-400/60 pl-4">
      {/* 思考头部 - 可点击折叠 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors cursor-pointer select-none"
      >
        {/* 🧠 思考图标 + 动画 */}
        <span className={`text-base ${isStreaming ? 'animate-pulse' : ''}`}>
          {isStreaming ? '💭' : '🧠'}
        </span>
        <span>
          {isStreaming ? '正在思考中...' : '思考过程'}
        </span>
        {!isStreaming && (
          <span className="text-amber-400 transition-transform" style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
            ▼
          </span>
        )}
        {isStreaming && (
          <span className="flex gap-0.5 ml-1">
            <span className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
      </button>

      {/* 思考内容 */}
      {!collapsed && message.content && (
        <div
          className={`mt-2 p-3 rounded-lg text-sm leading-relaxed transition-all
            ${isStreaming
              ? 'bg-amber-50/80 border border-amber-200/50 animate-pulse'
              : 'bg-amber-50/50 border border-amber-100'
            }
            text-amber-900/80 prose prose-sm max-w-none prose-strong:text-amber-900 prose-code:text-amber-700`}
        >
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      )}

      {/* 错误状态 */}
      {message.status === 'error' && (
        <div className="mt-2 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-600">
          ⚠️ 思考过程出错：{message.error || '未知错误'}
        </div>
      )}
    </div>
  );
};
