import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// 这里我们选一个类似 VSCode 的深色主题
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
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
            {/* 气泡逻辑 */}
            <div className={`rounded-2xl px-4 py-2.5 shadow-sm text-sm leading-relaxed overflow-x-auto ${msg.role === 'user'
              ? 'bg-blue-600 text-white rounded-tr-none'
              : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
              }`}>
              {msg.role === 'user' ? (
                // 用户的消息通常是纯文本，直接展示即可
                msg.content
              ) : (
                // AI 的消息交给 ReactMarkdown 渲染
                <ReactMarkdown
                  components={{
                    // 拦截所有的 <code> 标签进行自定义渲染
                      // 1. 注意这里：把 ref 单独解构出来，剩下的属性放到 rest 变量里
                      code({ node, className, children, ref, ...rest }) {
                        const match = /language-(\w+)/.exec(className || '');
                        return match ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus as any}
                            language={match[1]}
                            PreTag="div"
                            {...rest} // 👈 2. 注意这里：只把去除 ref 之后的 rest 传给它，避开类型冲突
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          // 原生的 code 标签是可以接收原生 ref 的，所以这里把 ref 传给它
                          <code ref={ref} className="px-1 py-0.5 mx-1 text-pink-600 bg-slate-100 rounded font-mono text-xs" {...rest}>
                            {children}
                          </code>
                        );
                      }  
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}