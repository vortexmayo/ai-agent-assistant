import React, { useState, useRef, useEffect } from 'react';

export const ChatInput = ({ onSend }: { onSend: (text: string) => void }) => {
  const [text, setText] = useState('');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);


  // 自动拉伸高度逻辑
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // 阻止默认换行 
      if (text.trim()) {
        onSend(text);
        setText(''); // 发送后清空 
      }
    }
  };

  return (
    <textarea
      ref={textAreaRef}
      value={text} // 受控组件绑定 
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="输入消息，Enter 发送..."
      className="w-full p-3 bg-transparent border-none focus:ring-0 resize-none text-slate-700 placeholder-slate-400 max-h-40 overflow-y-auto outline-none"
      rows={1}
    />
  );
};