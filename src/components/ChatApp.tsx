import { useEffect, useRef } from 'react';
import MessageList, { type Message } from './MessageList';


type ChatAppProps = {
  messages: Message[];
};

const ChatApp: React.FC<ChatAppProps> = ({ messages }) => {
  // 创建用于滚动的 Ref
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动逻辑：监听 messages 的变化
  useEffect(() => {
    if (scrollRef.current) {
      // 使用 scrollIntoView 实现平滑滚动
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]); // useEffect 的依赖数组

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