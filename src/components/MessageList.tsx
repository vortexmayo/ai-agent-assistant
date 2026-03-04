// 1. 定义单条消息的 TypeScript 类型规范
export interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

// 2. 定义组件接收的“参数”（Props），它需要接收一个叫 messages 的数组
interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  return (
    <div className="space-y-6">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
          <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
            {/* 头像占位 */}
            <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {msg.role === 'user' ? 'ME' : 'AI'}
            </div>

            {/* 气泡逻辑 */}
            <div className={`rounded-2xl px-4 py-2.5 shadow-sm text-sm leading-relaxed ${msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-none'
                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
              }`}>
              {msg.content}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}