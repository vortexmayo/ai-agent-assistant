import { ChatInput } from './components/ChatInput';
import { useChatStore } from './store/useChatStore';
import  MessageList  from './components/MessageList';


export default function App() {
  const sessions = useChatStore((state) => state.sessions);
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const createNewSession = useChatStore((state) => state.createNewSession);
  const switchSession = useChatStore((state) => state.switchSession);
  const deleteSession = useChatStore((state) => state.deleteSession);
  const getCurrentMessages = useChatStore((state) => state.getCurrentMessages);

  // 保持原有的方法
  const isGenerating = useChatStore((state) => state.isGenerating);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const clearMessages = useChatStore((state) => state.clearMessages);
 
  // 动态获取当前选中会话的消息列表
  const messages = getCurrentMessages();
  
  return (
    <div className="flex w-full h-screen font-sans bg-white text-slate-900">
      {/* 1. 左侧：侧边栏 */}
      <aside className="flex flex-col w-64 shadow-xl shrink-0 bg-slate-900 text-slate-200">
        <div className="p-4">
          <button
            onClick={createNewSession}
            className="w-full py-2.5 px-4 border border-slate-700 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center gap-2 text-sm font-medium"
          >
            <span className="text-lg">+</span> 新建对话
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="px-3 py-2 text-xs font-semibold tracking-wider uppercase text-slate-500">最近对话</div>

          {/* 动态渲染会话列表 */}
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => switchSession(session.id)}
              className={`group flex items-center justify-between p-3 text-sm transition-colors rounded-lg cursor-pointer ${currentSessionId === session.id
                  ? 'bg-slate-800 border-l-2 border-blue-500 rounded-l-none text-slate-200' // 选中状态样式
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' // 未选中状态样式
                }`}
            >
              <span className="flex-1 truncate">{session.title}</span>

              {/* 删除按钮（悬浮时显示） */}
              <button
                onClick={(e) => {
                  e.stopPropagation(); // 阻止冒泡，防止触发外层的 switchSession
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
      </aside>

      {/* 2. 右侧：主聊天区 ...此处与你原有的代码保持一致... */}
      <main className="flex flex-col flex-1 min-w-0 bg-slate-50/50">
        <header className="sticky top-0 z-10 flex items-center px-6 border-b h-14 border-slate-200 bg-white/80 backdrop-blur-md">
          <h2 className="flex-1 font-semibold text-slate-700">AI 智能体助手</h2>
          <button
            onClick={clearMessages}
            className="px-4 py-2 ml-auto text-sm text-gray-600 transition-colors bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            清空当前对话
          </button>
        </header>

        <section className="flex-1 p-4 overflow-y-auto md:p-8">
          <div className="max-w-3xl mx-auto">
            {/* 传入动态获取到的当前会话 messages */}
            <MessageList messages={messages} />
          </div>
        </section>

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