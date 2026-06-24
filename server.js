/**
 * AI 智能体工作台 — MCP BFF 代理服务
 *
 * 在浏览器（React 前端）与本地 SQLite 数据库之间架桥。
 * 对外暴露与 MCP 协议兼容的 SQLite 工具接口：
 *   - list_tables      → 列出所有表
 *   - describe_table   → 查看表结构
 *   - read_query       → 执行只读 SQL 查询
 *   - write_query      → 执行写入 SQL 操作
 *   - create_table     → 创建新表
 *
 * 启动方式：node server.js
 * 默认端口：3001
 */

import express from 'express';
import cors from 'cors';
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, 'test.db');
const PORT = 3001;

// ========== Express 初始化 ==========
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ========== SQLite 数据库加载 ==========
let db = null;

async function loadDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    console.log('📂 加载数据库:', DB_PATH);
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    console.log('🆕 创建新数据库:', DB_PATH);
    db = new SQL.Database();
  }

  // 自动建表
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT NOT NULL, department TEXT DEFAULT \'技术部\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL, price REAL NOT NULL, stock INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL, total_amount REAL NOT NULL, sale_date DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, status TEXT DEFAULT \'pending\', assignee TEXT, priority TEXT DEFAULT \'normal\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  console.log('✅ 数据库表已就绪');
}

/** 保存数据库到文件 */
function saveDatabase() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ========== 工具定义（兼容 MCP 格式） ==========
const TOOLS = [
  {
    name: 'list_tables',
    description: '列出数据库中所有的表名称。用于了解数据库中有哪些数据表可用。',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'describe_table',
    description: '查看指定表的结构，包括列名、数据类型、是否可空、默认值等详细信息。在执行查询前应先调用此工具了解表结构。',
    inputSchema: {
      type: 'object',
      properties: { table_name: { type: 'string', description: '要查看结构的表名，例如：users、products、sales、tasks' } },
      required: ['table_name'],
    },
  },
  {
    name: 'read_query',
    description: '执行只读的 SELECT 查询语句。用于从数据库中检索数据。支持 JOIN、WHERE、GROUP BY、ORDER BY 等标准 SQL 语法。',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: '要执行的 SELECT 查询语句' } },
      required: ['query'],
    },
  },
  {
    name: 'write_query',
    description: '执行写入操作（INSERT、UPDATE、DELETE）。用于向数据库中添加、修改或删除数据。操作会自动保存到磁盘。',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: '要执行的 INSERT/UPDATE/DELETE 语句' } },
      required: ['query'],
    },
  },
  {
    name: 'create_table',
    description: '创建新的数据库表。需要提供完整的 CREATE TABLE 语句。',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: '完整的 CREATE TABLE SQL 语句' } },
      required: ['query'],
    },
  },
];

// ========== HTTP API ==========

/** 健康检查 */
app.get('/api/mcp/health', (_req, res) => {
  const tables = getTableNames();
  res.json({
    status: 'ok',
    dbPath: DB_PATH,
    tableCount: tables.length,
    tables,
    tools: TOOLS.map((t) => t.name),
  });
});

/** 获取可用工具列表 */
app.get('/api/mcp/tools', (_req, res) => {
  res.json({ tools: TOOLS });
});

/** 执行工具调用 */
app.post('/api/mcp/call', (req, res) => {
  const { toolName, args } = req.body;

  if (!toolName) {
    return res.status(400).json({ success: false, error: '缺少 toolName 参数' });
  }

  try {
    console.log(`🔧 执行工具: ${toolName}`, JSON.stringify(args).slice(0, 300));

    let result;
    switch (toolName) {
      case 'list_tables':
        result = handleListTables();
        break;
      case 'describe_table':
        result = handleDescribeTable(args?.table_name);
        break;
      case 'read_query':
        result = handleReadQuery(args?.query);
        break;
      case 'write_query':
        result = handleWriteQuery(args?.query);
        break;
      case 'create_table':
        result = handleCreateTable(args?.query);
        break;
      default:
        return res.status(400).json({ success: false, error: `未知工具: ${toolName}` });
    }

    console.log(`✅ 工具执行成功: ${toolName}`, JSON.stringify(result).slice(0, 200));
    res.json({ success: true, toolName, result });
  } catch (err) {
    console.error(`❌ 工具执行失败: ${toolName}`, err.message);
    res.status(500).json({ success: false, toolName, error: err.message });
  }
});

// ========== 工具处理函数 ==========

function getTableNames() {
  const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  const rows = result[0]?.values || [];
  return rows.map((r) => r[0]);
}

function handleListTables() {
  const tables = getTableNames();
  return { tables, count: tables.length };
}

function handleDescribeTable(tableName) {
  if (!tableName) throw new Error('缺少 table_name 参数');
  const result = db.exec(`PRAGMA table_info('${tableName.replace(/'/g, "''")}')`);
  if (!result[0]) throw new Error(`表 "${tableName}" 不存在`);
  const columns = result[0].values.map((row) => ({
    cid: row[0],
    name: row[1],
    type: row[2],
    notnull: row[3] === 1,
    default: row[4],
    pk: row[5] === 1,
  }));
  return { table: tableName, columns, columnCount: columns.length };
}

function handleReadQuery(query) {
  if (!query) throw new Error('缺少 query 参数');
  // 安全检查：只允许 SELECT
  const trimmed = query.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('PRAGMA') && !trimmed.startsWith('EXPLAIN')) {
    throw new Error('read_query 只允许执行 SELECT / PRAGMA 查询');
  }

  const result = db.exec(query);
  if (result.length === 0) {
    return { columns: [], rows: [], rowCount: 0, message: '查询无返回结果（可能是非 SELECT 语句）' };
  }

  const formatted = result.map((r) => ({
    columns: r.columns,
    rows: r.values,
    rowCount: r.values.length,
  }));

  return formatted.length === 1 ? formatted[0] : formatted;
}

function handleWriteQuery(query) {
  if (!query) throw new Error('缺少 query 参数');
  // 安全检查：禁止 SELECT
  const trimmed = query.trim().toUpperCase();
  if (trimmed.startsWith('SELECT')) {
    throw new Error('write_query 不允许执行 SELECT 语句，请使用 read_query');
  }

  db.run(query);
  const changes = db.getRowsModified();
  saveDatabase();
  return { changes, message: `操作成功，${changes} 行受影响` };
}

function handleCreateTable(query) {
  if (!query) throw new Error('缺少 query 参数');
  const trimmed = query.trim().toUpperCase();
  if (!trimmed.startsWith('CREATE TABLE')) {
    throw new Error('只允许 CREATE TABLE 语句');
  }
  db.run(query);
  saveDatabase();
  return { message: '表创建成功' };
}

// ========== 启动服务 ==========
async function startServer() {
  try {
    await loadDatabase();

    app.listen(PORT, () => {
      console.log(`\n🚀 MCP SQLite 代理服务已启动`);
      console.log(`   📍 地址:      http://localhost:${PORT}`);
      console.log(`   ❤️  健康检查:  http://localhost:${PORT}/api/mcp/health`);
      console.log(`   🔧 工具列表:  http://localhost:${PORT}/api/mcp/tools`);
      console.log(`   ⚡ 工具调用:  POST http://localhost:${PORT}/api/mcp/call`);
      console.log(`   📊 数据库:    ${DB_PATH}`);
      console.log(`   📋 可用工具:  ${TOOLS.map((t) => t.name).join(', ')}\n`);
    });
  } catch (err) {
    console.error('❌ 启动失败:', err);
    process.exit(1);
  }
}

startServer();
