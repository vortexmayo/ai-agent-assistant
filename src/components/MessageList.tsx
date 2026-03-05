import ReactMarkdown from 'react-markdown';
import React, { useState, useEffect } from 'react';
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
  // 存储浏览器支持的语音包列表
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  // 记录当前正在播报的消息 ID，用于控制“朗读/停止”状态
  const [playingId, setPlayingId] = useState<string | null>(null);

  // 1. 组件挂载时获取系统语音包
  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };

    // 初始化获取
    loadVoices();

    // 注意：某些浏览器（如 Chrome）的语音包是异步加载的，必须监听 onvoiceschanged 事件
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // 清理副作用：组件卸载时立刻停止播报，防止切页面后后台还在说话
    return () => window.speechSynthesis.cancel();
  }, []);

  // 2. 核心 TTS 播报函数
  const handleSpeak = (text: string, id: string) => {
    // 兼容性检查
    if (!('speechSynthesis' in window)) {
      alert('抱歉，您的浏览器不支持语音合成功能。');
      return;
    }

    // 如果用户点击的是当前正在播报的声音，则停止（实现 播放/暂停 切换逻辑）
    if (playingId === id && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setPlayingId(null);
      return;
    }

    // 每次开始新播报前，先切断之前可能在播放的声音
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // 3. 筛选中文女声（不同系统名称不同，如 Windows 的 Xiaoxiao，Mac 的 Tingting）
    // 兜底策略：找不到明确的女声，就用第一个包含 'zh' 的中文语音包
    const zhVoice = voices.find(v => v.lang.includes('zh') && (v.name.includes('Xiaoxiao') || v.name.includes('female') || v.name.includes('女')))
      || voices.find(v => v.lang.includes('zh'));

    if (zhVoice) utterance.voice = zhVoice;

    // 监听播放结束和错误事件，重置按钮状态
    utterance.onend = () => setPlayingId(null);
    utterance.onerror = () => setPlayingId(null);

    // 触发浏览器调用底层扬声器
    window.speechSynthesis.speak(utterance);
    setPlayingId(id);
  };
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
              {/* 4. 只在 AI (assistant) 的回复气泡内渲染喇叭按钮 */}
              {msg.role === 'assistant' && (
                <button
                  // 注意：这里把 msg.id 转换成了 string，适配 ts 类型
                  onClick={() => handleSpeak(msg.content, msg.id.toString())}
                  className="flex items-center gap-1 mt-2 text-sm text-gray-500 transition-colors hover:text-gray-800"
                  title={playingId === msg.id.toString() ? "停止播报" : "朗读回复"}
                >
                  {playingId === msg.id.toString() ? '⏹️ 停止播报' : '🔊 语音播报'}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}