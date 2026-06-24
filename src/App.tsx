import { useRef } from 'react';
import { ChatInput } from './components/ChatInput';
import { useChatStore } from './store/useChatStore';
import MessageList from './components/MessageList';
import { ControlPanel } from './components/ControlPanel';

/**
 * AI 智能体工作台 — 主应用组件
 *
 * 三栏布局：
 * - 左侧边栏（260px）：会话列表
 * - 中间主工作区（flex-1）：消息流 + 输入框
 * - 右侧控制面板（250px）：知识库 / MCP / Token
 */
export default function App() {
  // --- 会话管理 ---
  const sessions = useChatStore((s) => s.sessions);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const createNewSession = useChatStore((s) => s.createNewSession);
  const switchSession = useChatStore((s) => s.switchSession);
  const deleteSession = useChatStore((s) => s.deleteSession);

  // --- 消息 & 生成 ---
  const isGenerating = useChatStore((s) => s.isGenerating);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopGeneration = useChatStore((s) => s.stopGeneration);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const getCurrentMessages = useChatStore((s) => s.getCurrentMessages);
  const showThoughtProcess = useChatStore((s) => s.showThoughtProcess);

  const messages = getCurrentMessages();
  const scrollContainerRef = useRef<HTMLElement>(null);

  return (
    <div className="flex w-full h-screen font-sans bg-white text-slate-900 overflow-hidden">
      {/* ======== 左侧：会话侧边栏 ======== */}
      <aside className="flex flex-col w-65 shadow-xl shrink-0 bg-slate-900 text-slate-200">
        {/* Logo / 标题区 */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🤖</span>
            <div>
              <h1 className="text-sm font-bold text-white">智能体工作台</h1>
              <p className="text-[10px] text-slate-400">Agent Workbench</p>
            </div>
          </div>
          <button
            onClick={createNewSession}
            className="w-full py-2.5 px-4 border border-slate-700 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center gap-2 text-sm font-medium"
          >
            <span className="text-lg">+</span> 新建对话
          </button>
        </div>

        {/* 会话列表 */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="px-3 py-2 text-xs font-semibold tracking-wider uppercase text-slate-500">
            最近对话
          </div>

          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => switchSession(session.id)}
              className={`group flex items-center justify-between p-3 text-sm transition-colors rounded-lg cursor-pointer ${
                currentSessionId === session.id
                  ? 'bg-slate-800 border-l-2 border-blue-500 rounded-l-none text-slate-200'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <span className="flex-1 truncate">{session.title}</span>

              {/* 删除按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(session.id);
                }}
                className="ml-2 transition-opacity opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400"
                title="删除对话"
              >
                ✕
              </button>
            </div>
          ))}
        </nav>

        {/* 底部信息 */}
        <div className="p-3 border-t border-slate-700/50">
          <div className="text-[10px] text-slate-500 text-center">
            AI Agent · RAG + MCP 已就绪
          </div>
        </div>
      </aside>

      {/* ======== 中间：主工作区 ======== */}
      <main className="flex flex-col flex-1 min-w-0 bg-slate-50/50">
        {/* 顶部工具栏 */}
        <header className="sticky top-0 z-10 flex items-center px-6 border-b h-14 border-slate-200 bg-white/80 backdrop-blur-md shrink-0">
          <h2 className="flex-1 font-semibold text-slate-700 text-sm">
            🧠 AI 智能体助手
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={clearMessages}
              className="px-3 py-1.5 text-xs text-slate-500 transition-colors bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              清空对话
            </button>
            {/* 在线状态指示器 */}
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              在线
            </span>
          </div>
        </header>

        {/* 消息流区域 */}
        <section ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
          <div className="max-w-3xl mx-auto">
            <MessageList
              messages={messages}
              showThoughtProcess={showThoughtProcess}
              scrollContainerRef={scrollContainerRef}
            />
          </div>
        </section>

        {/* 底部输入区 */}
        <footer className="p-4 md:p-6 bg-transparent shrink-0">
          <div className="relative max-w-3xl mx-auto group">
            <div className="absolute -inset-0.5 bg-linear-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000" />
            <div className="relative p-2 bg-white border shadow-sm border-slate-200 rounded-2xl">
              <ChatInput onSend={sendMessage} onStop={stopGeneration} disabled={isGenerating} />
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-2">
              AI 生成内容可能存在偏差，请谨慎参考 · 思考过程与工具调用可实时追踪
            </p>
          </div>
        </footer>
      </main>

      {/* ======== 右侧：控制面板 ======== */}
      <ControlPanel />
    </div>
  );
}
