import React, { useState, useEffect, useRef } from 'react';
import MessageList, { type Message } from './MessageList';


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
    const newMessage: Message = { id: Date.now(), content: input, role: 'user' };
    setMessages([...messages, newMessage]);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* 消息展示区 */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <MessageList messages={messages} />
        {/* 自动滚动的锚点元素 */}
        <div ref={scrollRef} />
      </div>
    </div>
  );
};

export default ChatApp;