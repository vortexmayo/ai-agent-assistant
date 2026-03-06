import React, { useState, useRef, useEffect } from 'react';

// 兼容不同浏览器的前缀，骗过 TypeScript 的类型检查
const SpeechRecognitionAPI =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean; // 加个问号，表示这个属性是“可选的”
}
 

export const ChatInput = ({ onSend, disabled = false }: ChatInputProps) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false); // 记录是否正在录音

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null); // 保存语音识别实例
  const debounceTimerRef = useRef<any>(null);
  
  // 初始化语音识别实例
  useEffect(() => {
    if (SpeechRecognitionAPI) {
      recognitionRef.current = new SpeechRecognitionAPI();
      // continuous 为 true 意味着只要不手动停止，就会一直听（适合按住说话）
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false; // 我们这里只要最终识别的那句话
      recognitionRef.current.lang = 'zh-CN'; // 识别中文

      // 当识别出结果时触发
      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        // 将识别出来的文字追加到现有的输入框内容后面
        if (finalTranscript) {
          setText((prev) => prev + finalTranscript);
        }
      };

      // 错误处理与结束处理
      recognitionRef.current.onerror = (event: any) => {
        console.error('语音识别报错:', event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const handleDebouncedSend = (textToSend: string) => {
    // 每次触发发送前，先看储物箱里有没有正在读条的计时器，有就掐断它
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 重新设立一个新的计时器，设定 500 毫秒（半秒）的延迟
    debounceTimerRef.current = setTimeout(() => {
      onSend(textToSend); // 真正呼叫 App.tsx 里的 handleSend
      setText('');        // 清空输入框
    }, 500);
  };

  // 自动拉伸高度逻辑
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [text]);

  // 按下回车键发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) {
        handleDebouncedSend(text);
      }
    }
  };

  // =============== 新增：麦克风按住/松开事件 ===============
  const startRecording = () => {
    if (!recognitionRef.current) {
      alert('抱歉，你的浏览器不支持语音识别，请使用 Chrome。');
      return;
    }
    setIsRecording(true);
    recognitionRef.current.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="relative flex items-end gap-2">
      <textarea
        ref={textAreaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={
          disabled
            ? "AI 正在思考中..."
            : isRecording
              ? "正在聆听中..."
              : "输入消息，Enter 发送..."
        }
        className="flex-1 w-full p-3 overflow-y-auto bg-transparent border-none outline-none resize-none focus:ring-0 text-slate-700 placeholder-slate-400 max-h-40"
        rows={1}/>
        

      {/* 麦克风按钮：按住说话，松开停止 */}
      <button
        type="button"
        onMouseDown={startRecording} // 鼠标按下
        onMouseUp={stopRecording}    // 鼠标松开
        onMouseLeave={stopRecording} // 鼠标移出按钮区域也要停止，防止卡死
        // 如果要在手机上测试，加上触摸事件：
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        className={`p-3 rounded-xl transition-all flex shrink-0 ${isRecording
            ? 'bg-red-500 text-white animate-pulse' // 录音时的呼吸灯状态
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
      >
        {/* 这里用一个简单的 emoji 代替图标，如果你引入了 icon 库可以换掉 */}
        {isRecording ? '🎙️' : '🎤'}
      </button>

      {/* 发送按钮：为了方便点击发送，顺手加上 */}
      <button
        onClick={() => {
          if (text.trim()) {
            handleDebouncedSend(text);
          }
        }}
        className="p-3 text-white transition-colors bg-blue-500 shrink-0 rounded-xl hover:bg-blue-600"
      >
        发送
      </button>
    </div>
  );
};