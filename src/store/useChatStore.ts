import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type Message } from '../components/MessageList';

// 定义大模型返回的数据结构契约
interface APIResponse {
  choices: Array<{
    delta: {
      content?: string; // 加上问号表示这个字段可能为空（比如流式传输刚开始或结束时）
    };
  }>;
}

// 1. 定义我们仓库（Store）的数据结构
interface ChatState {
  messages: Message[];
  isGenerating: boolean; // 新增：用来记录 AI 是否正在打字回消息
  addMessage: (message: Message) => void;
  updateMessage: (id: number, content: string) => void;
  clearMessages: () => void;
  sendMessage: (text: string) => Promise<void>;
}

// 默认写死的初始对话
const initialMessages: Message[] = [
  { id: 1, role: 'user', content: '你好，请问你是谁？' },
  { id: 2, role: 'assistant', content: '你好！我是你的 AI 助手，今天有什么可以帮你的？' },
];

// 2. 创建并导出全局 Store
export const useChatStore = create<ChatState>()(
  // 核心魔法：persist 中间件自动接管 localStorage！
  persist(
    (set, get) => ({
      // --- 状态数据 ---
      messages: initialMessages,
      isGenerating: false,

      // --- 基础动作函数 ---
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),

      updateMessage: (id, content) =>
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, content } : msg
          ),
        })),

      clearMessages: () => set({ messages: initialMessages }),

      // --- 核心业务逻辑：发送消息与流式请求 ---
      sendMessage: async (text: string) => {
        // get() 可以拿到仓库里当前的所有状态和函数
        const { addMessage, updateMessage } = get();

        // 第一步：用户消息上屏
        const userMsg: Message = { id: Date.now(), role: 'user', content: text };
        addMessage(userMsg);

        // 第二步：给 AI 提前准备空气泡
        const aiMsgId = Date.now() + 1;
        addMessage({ id: aiMsgId, role: 'assistant', content: '' });

        // 标记 AI 开始思考/打字
        set({ isGenerating: true });

        try {
          // 截取最近 6 条对话作为上下文记忆
          const contextMessages = [...get().messages].slice(-6).map((m) => ({
            role: m.role,
            content: m.content
          }));

          const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // 注意：在实际项目中，别忘了配好环境变量 VITE_AI_API_KEY
              'Authorization': `Bearer ${import.meta.env.VITE_AI_API_KEY}`
            },
            body: JSON.stringify({
              model: "glm-4.7-flash",
              messages: contextMessages,
              stream: true
            })
          });

          if (!response.ok) throw new Error('请求失败');
          if (!response.body) throw new Error('没有返回可读流');

          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let aiFullReply = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkString = decoder.decode(value, { stream: true });
            const lines = chunkString.split('\n');

            for (const line of lines) {
              if (line.startsWith('data:') && !line.includes('[DONE]')) {
                const jsonString = line.replace('data:', '').trim();
                if (jsonString) {
                  try {
                    const parsedData = JSON.parse(jsonString) as APIResponse;
                    const newChar = parsedData.choices[0]?.delta?.content;
                    if (newChar) {
                      aiFullReply += newChar;
                      // 第三步：调用基础动作函数，精准更新那个空气泡的内容
                      updateMessage(aiMsgId, aiFullReply);
                    }
                  } catch (e) {
                    console.error("JSON 解析失败", e);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("请求报错:", error);
          updateMessage(aiMsgId, '抱歉，网络开小差了，请稍后再试。');
        } finally {
          // 无论成功还是失败，最后都要解除生成状态
          set({ isGenerating: false });
        }
      }
    }),
    {
      name: 'chat_history', // 这个名字就是存入 localStorage 的 key
    }
  )
);