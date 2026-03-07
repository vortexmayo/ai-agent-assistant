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

// 1. 新增：定义单个会话的数据结构
export interface Session {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

// 1. 定义我们仓库（Store）的数据结构
interface ChatState {
  sessions: Session[];          // 所有历史会话列表
  currentSessionId: string;     // 当前正在浏览的会话 ID
  isGenerating: boolean; // 新增：用来记录 AI 是否正在打字回消息
  // 会话管理动作
  createNewSession: () => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  // 消息管理动作
  clearMessages: () => void;
  sendMessage: (text: string) => Promise<void>;
  // 辅助获取当前会话消息的方法（用于 UI 渲染）
  getCurrentMessages: () => Message[];

}

// 生成一个默认的初始会话
const createDefaultSession = (): Session => ({
  id: Date.now().toString(),
  title: '新对话',
  messages: [{ id: 1, role: 'assistant', content: '你好！我是你的 AI 助手，今天有什么可以帮你的？' }],
  updatedAt: Date.now(),
});

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [createDefaultSession()],
      currentSessionId: createDefaultSession().id,
      isGenerating: false,

      // --- 获取当前会话的消息 ---
      getCurrentMessages: () => {
        const { sessions, currentSessionId } = get();
        const currentSession = sessions.find(s => s.id === currentSessionId);
        return currentSession ? currentSession.messages : [];
      },

      // --- 会话管理动作 ---
      createNewSession: () => {
        const newSession = createDefaultSession();
        set((state) => ({
          sessions: [newSession, ...state.sessions],
          currentSessionId: newSession.id,
        }));
      },

      switchSession: (id) => set({ currentSessionId: id }),

      deleteSession: (id) => {
        set((state) => {
          const newSessions = state.sessions.filter(s => s.id !== id);
          // 如果删光了，自动建一个兜底
          if (newSessions.length === 0) {
            const fallback = createDefaultSession();
            return { sessions: [fallback], currentSessionId: fallback.id };
          }
          // 如果删除的是当前选中的会话，自动切换到第一个
          const nextSessionId = state.currentSessionId === id ? newSessions[0].id : state.currentSessionId;
          return { sessions: newSessions, currentSessionId: nextSessionId };
        });
      },

      // 清空当前会话的消息
      clearMessages: () => set((state) => ({
        sessions: state.sessions.map(s => 
          s.id === state.currentSessionId 
            ? { ...s, messages: createDefaultSession().messages } 
            : s
        )
      })),

      // --- 发送消息逻辑 ---
      sendMessage: async (text: string) => {
        const { currentSessionId, sessions } = get();
        
        // 辅助函数：更新当前会话的 messages
        const updateCurrentSessionMessages = (updater: (msgs: Message[]) => Message[], updateTitle?: string) => {
          set((state) => ({
            sessions: state.sessions.map(s => {
              if (s.id !== state.currentSessionId) return s;
              return {
                ...s,
                messages: updater(s.messages),
                title: updateTitle || s.title, // 如果传入了新标题则更新标题
                updatedAt: Date.now()
              };
            })
          }));
        };

        // 第一步：用户消息上屏
        const userMsg: Message = { id: Date.now(), role: 'user', content: text };
        
        // 智能命名：如果是会话的“第一条用户消息”，将其截取作为会话标题
        const currentSession = sessions.find(s => s.id === currentSessionId);
        const isFirstUserMessage = currentSession?.messages.filter(m => m.role === 'user').length === 0;
        const newTitle = isFirstUserMessage ? text.slice(0, 15) : undefined;

        updateCurrentSessionMessages((msgs) => [...msgs, userMsg], newTitle);

        // 第二步：给 AI 提前准备空气泡
        const aiMsgId = Date.now() + 1;
        updateCurrentSessionMessages((msgs) => [...msgs, { id: aiMsgId, role: 'assistant', content: '' }]);

        set({ isGenerating: true });

        try {
          // 获取当前上下文（最多取最近 6 条）
          const latestMessages = get().getCurrentMessages();
          const contextMessages = latestMessages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content
          }));

          const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_AI_API_KEY}`
            },
            body: JSON.stringify({
              model: "glm-4.7-flash",
              messages: contextMessages,
              stream: true
            })
          });

          if (!response.ok) throw new Error('请求失败');
          const reader = response.body?.getReader();
          if (!reader) throw new Error('没有返回可读流');
          
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
                      // 第三步：精准更新当前会话中，那个空气泡的内容
                      updateCurrentSessionMessages((msgs) => 
                        msgs.map(msg => msg.id === aiMsgId ? { ...msg, content: aiFullReply } : msg)
                      );
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
          updateCurrentSessionMessages((msgs) => 
            msgs.map(msg => msg.id === aiMsgId ? { ...msg, content: '抱歉，网络开小差了，请稍后再试。' } : msg)
          );
        } finally {
          set({ isGenerating: false });
        }
      }
    }),
    {
      name: 'chat_history',
    }
  )
);