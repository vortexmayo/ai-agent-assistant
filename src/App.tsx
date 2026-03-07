import React from 'react';
import { ChatInput } from './components/ChatInput';
import { useChatStore } from './store/useChatStore';
import  MessageList  from './components/MessageList';


export default function App() {
  const messages = useChatStore((state) => state.messages);
  const isGenerating = useChatStore((state) => state.isGenerating);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const clearMessages = useChatStore((state) => state.clearMessages);

  return (
    <div className="flex w-full h-screen font-sans bg-white text-slate-900">
      {/* 1. 左侧：侧边栏 (Sidebar) - 采用深色渐变增加高级感 */}
      <aside className="flex flex-col w-64 shadow-xl shrink-0 bg-slate-900 text-slate-200">
        <div className="p-4">
          <button className="w-full py-2.5 px-4 border border-slate-700 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center gap-2 text-sm font-medium">
            <span className="text-lg">+</span> 新建对话
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-semibold tracking-wider uppercase text-slate-500">最近对话</div>
          <div className="p-3 text-sm border-l-2 border-blue-500 rounded-r-lg cursor-pointer bg-slate-800">React 布局复习计划</div>
          <div className="p-3 text-sm transition-colors rounded-lg cursor-pointer text-slate-400 hover:bg-slate-800 hover:text-slate-200">Flexbox 原理解析</div>
        </nav>
      </aside>

      {/* 2. 右侧：主聊天区 (Main) */}
      <main className="flex flex-col flex-1 min-w-0 bg-slate-50/50">
      
        {/* 顶部状态栏 */}
        <header className="sticky top-0 z-10 flex items-center px-6 border-b h-14 border-slate-200 bg-white/80 backdrop-blur-md">
          <h2 className="flex-1 font-semibold text-slate-700">AI 智能体助手</h2>
          {/* 直接绑定清空仓库的方法 */}
          <button
            onClick={clearMessages}
            className="px-4 py-2 ml-auto text-sm text-gray-600 transition-colors bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            清空对话
          </button>
        </header>

        {/* 聊天内容区 */}
        <section className="flex-1 p-4 overflow-y-auto md:p-8">
          <div className="max-w-3xl mx-auto"> {/* 限制宽度，提升阅读体验 */}
            <MessageList messages={messages} />
          </div>
        </section>

        {/* 3. 底部：输入框 (Footer) */}
        <footer className="p-6 bg-transparent">
          <div className="relative max-w-3xl mx-auto group">
            <div className="absolute -inset-0.5 bg-linear-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000"></div>
            <div className="relative p-2 bg-white border shadow-sm border-slate-200 rounded-2xl">
              <ChatInput onSend={sendMessage} disabled={isGenerating} />
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-2">AI 生成内容可能存在偏差，请谨慎参考</p>
          </div>
        </footer>
      </main>
    </div>
  );
}