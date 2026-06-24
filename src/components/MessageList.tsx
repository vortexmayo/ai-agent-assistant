import { useEffect, useRef, useCallback } from 'react';
import type { AgentMessage } from '../types/chat';
import { TextBubble } from './TextBubble';
import { ThoughtNode } from './ThoughtNode';
import { ToolCallNode } from './ToolCallNode';
import { ToolResultNode } from './ToolResultNode';

interface MessageListProps {
  messages: AgentMessage[];
  showThoughtProcess?: boolean;
  /** 外部滚动容器的 ref，用于检测用户是否在底部 */
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

/** 判定"在底部"的距离阈值（px），用户在这个范围内视为在底部，允许自动滚动 */
const BOTTOM_THRESHOLD = 80;

/**
 * 消息列表组件（重构版）
 * 根据消息类型动态渲染不同的子组件：
 * - text → TextBubble
 * - thought → ThoughtNode（可折叠思考卡片）
 * - tool_call → ToolCallNode（工具调用状态）
 * - tool_result → ToolResultNode（工具返回结果）
 *
 * 按 groupId 分组，同一组消息展示在同一"对话回合"卡片中
 *
 * 自动滚动策略：
 * - 用户处于底部附近时，新消息自动滚动到底部
 * - 用户正在上拉查看历史内容时，不强制滚动，并在右下角显示"回到底部"按钮
 */
export default function MessageList({ messages, showThoughtProcess = true, scrollContainerRef }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isUserScrollingUpRef = useRef(false);

  /** 判断滚动容器是否处于底部附近 */
  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom < BOTTOM_THRESHOLD;
  }, []);

  /** 平滑滚动到底部 */
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // 监听用户手动滚动，判断是否离开底部
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      isUserScrollingUpRef.current = !isNearBottom();
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [isNearBottom]);

  // 消息变化时：仅在用户处于底部时自动跟随滚动
  useEffect(() => {
    if (isNearBottom()) {
      scrollToBottom(true);
    }
  }, [messages, isNearBottom, scrollToBottom]);

  // 将消息按 groupId 分组
  const groupedMessages = groupMessagesByGroupId(messages);

  /** 回到底部 */
  const handleBackToBottom = useCallback(() => {
    scrollToBottom(true);
  }, [scrollToBottom]);

  return (
    <div className="relative">
      <div className="space-y-4">
        {groupedMessages.map((group) => (
          <MessageGroup
            key={group.groupId}
            group={group}
            showThoughtProcess={showThoughtProcess}
          />
        ))}
        <div ref={messagesEndRef} className="h-0" />
      </div>

      {/* "回到底部"浮动按钮：仅在用户上拉离开底部时显示 */}
      {!isNearBottom() && (
        <button
          onClick={handleBackToBottom}
          className="sticky bottom-4 float-right z-20 flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-full shadow-lg text-xs text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all animate-in fade-in"
        >
          <span>↓</span> 回到底部
        </button>
      )}
    </div>
  );
}

// ========== 消息分组展示 ==========
interface MessageGroup {
  groupId: string;
  messages: AgentMessage[];
}

function MessageGroup({
  group,
  showThoughtProcess,
}: {
  group: MessageGroup;
  showThoughtProcess: boolean;
}) {
  // 判断这一组是否为用户消息组（只有一条文本消息）
  const isUserGroup = group.messages.length === 1 &&
    group.messages[0].role === 'user' &&
    group.messages[0].type === 'text';

  if (isUserGroup) {
    // 用户消息直接渲染
    return <TextBubble message={group.messages[0]} />;
  }

  // Agent 回复组：可能包含 thought → tool_call → tool_result → thought → text
  const hasAgentContent = group.messages.some(
    (m) => m.role === 'assistant' || m.role === 'tool'
  );

  if (!hasAgentContent) return null;

  // 提取组内首条消息的角色信息用于显示
  const firstAssistantMsg = group.messages.find((m) => m.role === 'assistant');

  return (
    <div className="my-3">
      {/* 组标识：显示 AI 头像和分组信息 */}
      {firstAssistantMsg && (
        <div className="flex items-center gap-2 mb-2 ml-1">
          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
            AI
          </div>
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
            智能体回复链路
          </span>
        </div>
      )}

      {/* 按顺序渲染组内消息 */}
      <div className="space-y-1">
        {group.messages.map((msg) => {
          switch (msg.type) {
            case 'text':
              return <TextBubble key={msg.id} message={msg} />;

            case 'thought':
              if (!showThoughtProcess) return null;
              return <ThoughtNode key={msg.id} message={msg} />;

            case 'tool_call':
              return <ToolCallNode key={msg.id} message={msg} />;

            case 'tool_result':
              return <ToolResultNode key={msg.id} message={msg} />;

            default:
              return null;
          }
        })}
      </div>

      {/* 组间分隔线 */}
      <div className="mt-3 border-b border-slate-100" />
    </div>
  );
}

// ========== 消息分组函数 ==========
function groupMessagesByGroupId(messages: AgentMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (const msg of messages) {
    if (!currentGroup || currentGroup.groupId !== msg.groupId) {
      currentGroup = { groupId: msg.groupId, messages: [] };
      groups.push(currentGroup);
    }
    currentGroup.messages.push(msg);
  }

  return groups;
}
