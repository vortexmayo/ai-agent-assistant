import React, { useState, useEffect, useRef } from 'react';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
}

const ChatApp: React.FC = () => {
  // 1. 初始化状态：尝试从 localStorage 读取已有的消息
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('chat_history');
    return saved ? JSON.parse(saved) : []; // 这里的 JSON.parse 涉及深拷贝考点
  });

  const [input, setInput] = useState('');

  // 2. 创建用于滚动的 Ref
  const scrollRef = useRef<HTMLDivElement>(null);

  // 3. 自动滚动逻辑：监听 messages 数组的变化
  useEffect(() => {
    if (scrollRef.current) {
      // 使用 scrollIntoView 实现平滑滚动
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    // 4. 持久化存储：每当消息更新，写入本地
    localStorage.setItem('chat_history', JSON.stringify(messages));
  }, [messages]); // useEffect 的依赖数组

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMessage: Message = { id: Date.now(), text: input, sender: 'user' };
    setMessages([...messages, newMessage]);
    setInput('');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* 消息展示区 */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg ${msg.sender === 'user' ? 'bg-green-500 text-white' : 'bg-white'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {/* 自动滚动的锚点元素 */}
        <div ref={scrollRef} />
      </div>

      {/* 输入框区 */}
      <div className="p-4 bg-white border-t">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="输入消息..."
          className="w-full p-2 border rounded"
        />
      </div>
    </div>
  );
};

export default ChatApp;