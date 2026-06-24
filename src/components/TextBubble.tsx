import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { AgentMessage } from '../types/chat';

interface TextBubbleProps {
  message: AgentMessage;
}

/**
 * 文本消息气泡组件
 * 支持 Markdown 渲染、代码高亮、语音播报
 * 根据角色自动调整样式（用户右侧蓝泡 / AI 左侧白泡）
 */
export const TextBubble: React.FC<TextBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const isError = message.status === 'error';

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => window.speechSynthesis.cancel();
  }, []);

  const handleSpeak = (text: string, id: string) => {
    if (!('speechSynthesis' in window)) return;
    if (playingId === id && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setPlayingId(null);
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const zhVoice =
      voices.find(
        (v) =>
          v.lang.includes('zh') &&
          (v.name.includes('Xiaoxiao') || v.name.includes('female') || v.name.includes('女')),
      ) || voices.find((v) => v.lang.includes('zh'));

    if (zhVoice) utterance.voice = zhVoice;
    utterance.onend = () => setPlayingId(null);
    utterance.onerror = () => setPlayingId(null);
    window.speechSynthesis.speak(utterance);
    setPlayingId(id);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        {/* 头像 */}
        <div
          className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
            isUser ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
          } ${isError ? 'bg-red-500' : ''}`}
        >
          {isUser ? 'ME' : isError ? '⚠️' : 'AI'}
        </div>

        {/* 气泡 */}
        <div
          className={`rounded-2xl px-4 py-2.5 shadow-sm text-sm leading-relaxed overflow-x-auto ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-none'
              : isError
                ? 'bg-red-50 border border-red-200 text-red-700 rounded-tl-none'
                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
          }`}
        >
          {isUser ? (
            <span>{message.content}</span>
          ) : (
            <>
              <ReactMarkdown
                components={{
                  code({ node, className, children, ref, ...rest }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return match ? (
                      <SyntaxHighlighter
                        style={vscDarkPlus as any}
                        language={match[1]}
                        PreTag="div"
                        {...rest}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code
                        ref={ref}
                        className="px-1 py-0.5 mx-1 text-pink-600 bg-slate-100 rounded font-mono text-xs"
                        {...rest}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content || (isStreaming ? '...' : '')}
              </ReactMarkdown>

              {/* 流式输出光标 */}
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-500 animate-pulse rounded-sm align-text-bottom" />
              )}

              {/* 语音播报按钮（仅 AI 回复） */}
              {!isUser && !isStreaming && message.content && (
                <button
                  onClick={() => handleSpeak(message.content || '', message.id)}
                  className="flex items-center gap-1 mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  title={playingId === message.id ? '停止播报' : '朗读回复'}
                >
                  {playingId === message.id ? '⏹️ 停止播报' : '🔊 语音播报'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
