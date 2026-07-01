import React from 'react';
import { useChatStore } from '../store/useChatStore';

/**
 * 右侧控制面板组件
 * 包含三个区域：
 * 1. 知识库管理（RAG）- 开关各知识库
 * 2. MCP Server 状态 - 查看已连接的工具服务
 * 3. 上下文用量 - Token 消耗统计
 */
export const ControlPanel: React.FC = () => {
  const knowledgeBases = useChatStore((s) => s.knowledgeBases);
  const mcpServers = useChatStore((s) => s.mcpServers);
  const tokenUsage = useChatStore((s) => s.tokenUsage);
  const showThoughtProcess = useChatStore((s) => s.showThoughtProcess);
  const toggleKnowledgeBase = useChatStore((s) => s.toggleKnowledgeBase);
  const toggleThoughtProcess = useChatStore((s) => s.toggleThoughtProcess);

  return (
    <aside className="w-64 shrink-0 border-l border-slate-200 bg-white flex flex-col h-full overflow-y-auto">
      {/* 面板标题 */}
      <div className="p-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <span>⚙️</span> 控制面板
        </h3>
        <p className="text-[10px] text-slate-400 mt-0.5">Agent 调度与上下文管理</p>
      </div>

      {/* ===== 1. 知识库管理 (RAG) ===== */}
      <section className="p-4 border-b border-slate-100">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
          📚 知识库 (RAG)
        </h4>
        <div className="space-y-2">
          {knowledgeBases.map((kb) => (
            <label
              key={kb.id}
              className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
            >
              {/* 自定义开关 */}
              <button
                onClick={() => toggleKnowledgeBase(kb.id)}
                className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${
                  kb.enabled ? 'bg-blue-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                    kb.enabled ? 'left-4.5' : 'left-0.5'
                  }`}
                />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-700 truncate">{kb.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{kb.description}</div>
              </div>
              <span
                className={`text-[10px] font-medium ${kb.enabled ? 'text-blue-500' : 'text-slate-400'}`}
              >
                {kb.enabled ? 'ON' : 'OFF'}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* ===== 2. MCP Server 状态 ===== */}
      <section className="p-4 border-b border-slate-100">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
          🔌 MCP 工具服务
        </h4>
        <div className="space-y-3">
          {/* 🗄️ SQLite */}
          <MCPServiceGroup
            icon="🗄️"
            name="SQLite 数据库"
            desc="本地数据查询与分析"
            connected={mcpServers.some(s => s.id === 'mcp-db' && s.status === 'connected')}
            toolCount={5}
          />
          {/* 📁 文件系统 */}
          <MCPServiceGroup
            icon="📁"
            name="文件系统 (FS)"
            desc="项目文件读写与搜索"
            connected={mcpServers.some(s => s.id === 'mcp-fs' && s.status === 'connected')}
            toolCount={4}
          />
          {/* 🧠 RAG 知识库 */}
          <MCPServiceGroup
            icon="🧠"
            name="RAG 知识库"
            desc="Embedding 向量检索"
            connected={mcpServers.some(s => s.id === 'mcp-rag' && s.status === 'connected')}
            toolCount={3}
          />
          {/* 🐙 GitHub */}
          <MCPServiceGroup
            icon="🐙"
            name="GitHub API"
            desc="公开仓库文件读取"
            connected={mcpServers.some(s => s.id === 'mcp-gh' && s.status === 'connected')}
            toolCount={1}
          />
        </div>
      </section>

      {/* ===== 3. 思考过程显示开关 ===== */}
      <section className="p-4 border-b border-slate-100">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
          🧠 显示设置
        </h4>
        <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
          <span className="text-xs text-slate-700">显示思考过程</span>
          <button
            onClick={toggleThoughtProcess}
            className={`relative w-8 h-4 rounded-full transition-colors ${
              showThoughtProcess ? 'bg-amber-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                showThoughtProcess ? 'left-4.5' : 'left-0.5'
              }`}
            />
          </button>
        </label>
      </section>

      {/* ===== 4. 上下文用量 (Token) ===== */}
      <section className="p-4">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
          📊 上下文用量
        </h4>
        {tokenUsage ? (
          <div className="space-y-3">
            {/* 进度条 */}
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-slate-500">Token 消耗</span>
                <span className="font-mono text-slate-700">{tokenUsage.totalTokens.toLocaleString()}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full transition-all"
                  style={{ width: `${Math.min((tokenUsage.totalTokens / 4096) * 100, 100)}%` }}
                />
              </div>
              <div className="text-right text-[9px] text-slate-400 mt-0.5">上下文窗口 4K</div>
            </div>

            {/* 详细统计 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <div className="text-[10px] text-blue-500 font-medium">输入 Token</div>
                <div className="text-sm font-bold text-blue-700 font-mono">
                  {tokenUsage.promptTokens.toLocaleString()}
                </div>
              </div>
              <div className="bg-cyan-50 rounded-lg p-2 text-center">
                <div className="text-[10px] text-cyan-500 font-medium">输出 Token</div>
                <div className="text-sm font-bold text-cyan-700 font-mono">
                  {tokenUsage.completionTokens.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-slate-400">
            <div className="text-2xl mb-1">📈</div>
            <div className="text-[10px]">发送消息后将显示</div>
            <div className="text-[10px]">Token 使用统计</div>
          </div>
        )}
      </section>
    </aside>
  );
};

// ========== MCP 服务分组子组件 ==========

interface MCPServiceGroupProps {
  icon: string;
  name: string;
  desc: string;
  connected: boolean;
  toolCount: number;
}

const MCPServiceGroup: React.FC<MCPServiceGroupProps> = ({ icon, name, desc, connected, toolCount }) => (
  <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors">
    <span className="text-base shrink-0">{icon}</span>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-slate-700">{name}</span>
        <span className="text-[9px] text-slate-400 bg-slate-100 px-1 rounded">{toolCount} 工具</span>
      </div>
      <div className="text-[10px] text-slate-400 truncate">{desc}</div>
    </div>
    <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-green-500' : 'bg-slate-300'}`} />
  </div>
);
