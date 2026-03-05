import { useEffect, useState } from 'react';
import { ChatInput } from './components/ChatInput';
import ChatApp from './components/ChatApp';
import { type Message } from './components/MessageList';

// 写死一个初始的数据数组 
const initialMessages: Message[] = [
  { id: 1, role: 'user', content: '你好，请问你是谁？' },
  { id: 2, role: 'assistant', content: '你好！我是你的 AI 助手，今天有什么可以帮你的？' },
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('chat_history');
    if (!saved) return initialMessages;
    try {
      const parsed = JSON.parse(saved) as unknown;
      if (Array.isArray(parsed)) return parsed as Message[];
      return initialMessages;
    } catch {
      return initialMessages;
    }
  });

  useEffect(() => {
    localStorage.setItem('chat_history', JSON.stringify(messages));
  }, [messages]);

  const handleSend = async (text: string) => {
    // ==========================================
    // 第一步：用户消息上屏
    // ==========================================
    const newUserMessage: Message = { id: Date.now(), role: 'user', content: text };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);

    // ==========================================
    // 第二步：给 AI 提前准备一个“空的气泡”占位置
    // ==========================================
    const aiMessageId = Date.now() + 1; // 提前给 AI 办好一张身份证
    setMessages((prev) => [
      ...prev,
      { id: aiMessageId, role: 'assistant', content: '' } // 👈 内容暂时是空的
    ]);

    // 把包含最新消息的数组转换为 API 需要的格式
    const apiMessages = updatedMessages.slice(-6).map((msg) => ({
      role: msg.role,
      content: msg.content
    }));

    try {
      // ==========================================
      // 第三步：发起流式网络请求
      // ==========================================
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_AI_API_KEY}` // ⚠️ 记得换成你的 Key
        },
        body: JSON.stringify({
          model: "glm-4.7-flash",
          messages: apiMessages,
          stream: true // 👈 核心秘籍：告诉服务器，我要开启流式传输！
        })
      });

      if (!response.ok) throw new Error(`请求失败: ${response.status}`);
      if (!response.body) throw new Error("没有返回可读流 (ReadableStream)");

      // ==========================================
      // 第四步：请出小弟（Reader）和翻译官（Decoder）
      // ==========================================
      const reader = response.body.getReader(); // 盯住传送带
      const decoder = new TextDecoder('utf-8'); // 准备翻译
      let aiFullReply = ''; // 我们准备一个空字符串，用来把蹦出来的字慢慢拼起来

      // ==========================================
      // 第五步：开启打字机死循环！
      // ==========================================
      while (true) {
        // 等待传送带运过来下一块碎肉（chunk）
        const { done, value } = await reader.read();

        // 如果传送带停了（大模型说完了），就打破循环，下班！
        if (done) break;

        // 1. 把电脑底层的二进制乱码翻译成字符串
        // 返回的格式大概长这样: `data: {"choices":[{"delta":{"content":"哈"}}]}\n\n`
        const chunkString = decoder.decode(value, { stream: true });

        // 2. 因为一次可能传过来好几个词，被换行符连着，所以我们按行拆开处理
        const lines = chunkString.split('\n');

        for (const line of lines) {
          // 找到包含 'data:' 的有效行，并且排除掉最后一句 '[DONE]'
          if (line.startsWith('data:') && !line.includes('[DONE]')) {
            // 把前面的 'data:' 砍掉，只留下纯纯的 JSON 字符串
            const jsonString = line.replace('data:', '').trim();
            if (jsonString) {
              try {
                // 把 JSON 字符串解析成真正的 JavaScript 对象
                const parsedData = JSON.parse(jsonString);

                // ⚠️ 注意：流式返回的数据结构叫 delta，普通返回叫 message
                const newChar = parsedData.choices[0].delta.content;

                if (newChar) {
                  aiFullReply += newChar; // 把新字拼接到总帖子里

                  // ==========================================
                  // 第六步：更新屏幕上的气泡，产生动画效果
                  // ==========================================
                  setMessages((prevMessages) =>
                    // 遍历所有消息，找到我们第二步插进去的那个“空 AI 气泡”
                    // 把它的内容替换成目前拼接好的、越来越长的字符串！
                    prevMessages.map((msg) =>
                      msg.id === aiMessageId
                        ? { ...msg, content: aiFullReply }
                        : msg
                    )
                  );
                }
              } catch (e) {
                // 偶尔有半截子 JSON 解析失败是正常的，直接忽略，等下一个 chunk 拼完就行
                console.error("解析单行 JSON 失败", e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("流式请求出错了:", error);
    }
  };
  
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
          <h2 className="font-semibold text-slate-700">AI 智能体助手</h2>
        </header>

        {/* 聊天内容区 */}
        <section className="flex-1 p-4 overflow-y-auto md:p-8">
          <div className="max-w-3xl mx-auto"> {/* 限制宽度，提升阅读体验 */}
            <ChatApp messages={messages} />
          </div>
        </section>

        {/* 3. 底部：输入框 (Footer) */}
        <footer className="p-6 bg-transparent">
          <div className="relative max-w-3xl mx-auto group">
            <div className="absolute -inset-0.5 bg-linear-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000"></div>
            <div className="relative p-2 bg-white border shadow-sm border-slate-200 rounded-2xl">
              <ChatInput onSend={handleSend} />
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-2">AI 生成内容可能存在偏差，请谨慎参考</p>
          </div>
        </footer>
      </main>
    </div>
  );
}