/**
 * AI 智能体工作台 — MCP BFF 代理服务
 *
 * 对外暴露 3 类 MCP 工具：
 *   🗄️ SQLite   — 数据库查询（list_tables, read_query, write_query...）
 *   📁 文件系统  — 文件读写/搜索（fs_read_file, fs_list_directory...）
 *   🧠 RAG      — 知识库索引/检索（rag_index_path, rag_search...）
 *   🐙 GitHub   — 仓库操作（github_get_file...）
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
import { glob } from 'glob';
import { RAGEngine } from './rag-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, 'test.db');
const PORT = 3001;

// ========== 加载 API Key（.env.local） ==========
let ZHIPU_API_KEY = '';
try {
  const envPath = path.resolve(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/VITE_AI_API_KEY\s*=\s*(.+)/);
    if (match) ZHIPU_API_KEY = match[1].trim();
  }
} catch { /* 忽略 */ }

// ========== Express ==========
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ========== SQLite ==========
let db = null;
async function loadDatabase() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log('📂 已加载数据库');
  } else {
    db = new SQL.Database();
    console.log('🆕 创建新数据库');
  }
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT NOT NULL, department TEXT DEFAULT '技术部', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  db.run('CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL, price REAL NOT NULL, stock INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL, total_amount REAL NOT NULL, sale_date DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run("CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, status TEXT DEFAULT 'pending', assignee TEXT, priority TEXT DEFAULT 'normal', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  console.log('✅ 数据库表已就绪');
}
function saveDatabase() { fs.writeFileSync(DB_PATH, Buffer.from(db.export())); }

// ========== RAG Engine ==========
const rag = new RAGEngine(ZHIPU_API_KEY);

// ========== 工具定义 ==========
const SQLITE_TOOLS = [
  { name: 'list_tables', description: '列出数据库中所有表名称', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'describe_table', description: '查看指定表的列名、数据类型等结构信息', inputSchema: { type: 'object', properties: { table_name: { type: 'string', description: '表名' } }, required: ['table_name'] } },
  { name: 'read_query', description: '执行 SELECT 只读查询', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'SELECT 语句' } }, required: ['query'] } },
  { name: 'write_query', description: '执行 INSERT/UPDATE/DELETE 写入操作', inputSchema: { type: 'object', properties: { query: { type: 'string', description: '写入 SQL 语句' } }, required: ['query'] } },
  { name: 'create_table', description: '创建新数据库表', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'CREATE TABLE 语句' } }, required: ['query'] } },
];

const FS_TOOLS = [
  { name: 'fs_read_file', description: '读取本地文件内容。支持代码文件(.ts/.tsx/.js)、文档(.md/.txt)、配置(.json)等文本文件。项目根目录为当前工作目录。', inputSchema: { type: 'object', properties: { path: { type: 'string', description: '文件相对路径，如 src/App.tsx 或 README.md' } }, required: ['path'] } },
  { name: 'fs_list_directory', description: '列出目录中的文件和子目录。用于浏览项目结构。', inputSchema: { type: 'object', properties: { path: { type: 'string', description: '目录路径，默认为项目根目录（.）' } }, required: [] } },
  { name: 'fs_search_files', description: '按文件名模式搜索文件（支持 glob 通配符，如 **/*.tsx 匹配所有 TSX 文件）', inputSchema: { type: 'object', properties: { pattern: { type: 'string', description: 'glob 搜索模式，如 src/**/*.ts' }, path: { type: 'string', description: '搜索起始目录，默认为项目根目录' } }, required: ['pattern'] } },
  { name: 'fs_write_file', description: '写入/创建本地文件。用于生成代码、保存配置等。需谨慎使用。', inputSchema: { type: 'object', properties: { path: { type: 'string', description: '文件路径' }, content: { type: 'string', description: '要写入的内容' } }, required: ['path', 'content'] } },
];

const RAG_TOOLS = [
  { name: 'rag_index_path', description: '索引指定目录下的所有文本文件，建立 RAG 知识库。支持 .md/.txt/.ts/.tsx/.js/.jsx/.json/.css/.html 格式。索引后的文件可通过 rag_search 语义检索。', inputSchema: { type: 'object', properties: { path: { type: 'string', description: '要索引的目录路径，如 ./src 或 ./docs' }, pattern: { type: 'string', description: '可选的文件匹配模式，默认 **/*.{md,txt,ts,tsx,js,jsx,json,css,html}' } }, required: ['path'] } },
  { name: 'rag_search', description: '在已索引的 RAG 知识库中语义搜索。返回最相关的文档片段及其来源文件和相似度评分。用于回答项目相关问题。', inputSchema: { type: 'object', properties: { query: { type: 'string', description: '搜索查询，用自然语言描述你想查找的内容' }, topK: { type: 'number', description: '返回结果数量，默认 5' } }, required: ['query'] } },
  { name: 'rag_list_indexed', description: '列出当前 RAG 知识库中已索引的所有文件及其分块统计。', inputSchema: { type: 'object', properties: {}, required: [] } },
];

const GITHUB_TOOLS = [
  { name: 'github_get_file', description: '从公开 GitHub 仓库获取文件内容。无需认证即可读取公开仓库。', inputSchema: { type: 'object', properties: { owner: { type: 'string', description: '仓库所有者，如 facebook' }, repo: { type: 'string', description: '仓库名，如 react' }, path: { type: 'string', description: '文件路径，如 README.md' }, branch: { type: 'string', description: '分支名，默认 main' } }, required: ['owner', 'repo', 'path'] } },
];

const ALL_TOOLS = [...SQLITE_TOOLS, ...FS_TOOLS, ...RAG_TOOLS, ...GITHUB_TOOLS];

// ========== HTTP API ==========

app.get('/api/mcp/health', (_req, res) => {
  res.json({
    status: 'ok',
    dbPath: DB_PATH,
    tables: getTableNames(),
    ragIndexed: rag.listIndexed(),
    tools: ALL_TOOLS.map(t => t.name),
    toolCategories: { sqlite: SQLITE_TOOLS.map(t => t.name), filesystem: FS_TOOLS.map(t => t.name), rag: RAG_TOOLS.map(t => t.name), github: GITHUB_TOOLS.map(t => t.name) },
  });
});

app.get('/api/mcp/tools', (_req, res) => {
  res.json({ tools: ALL_TOOLS });
});

app.post('/api/mcp/call', async (req, res) => {
  const { toolName, args } = req.body;
  if (!toolName) return res.status(400).json({ success: false, error: '缺少 toolName' });

  try {
    console.log(`🔧 ${toolName}`, JSON.stringify(args).slice(0, 300));
    let result;

    // ====== SQLite ======
    if (toolName === 'list_tables') result = { tables: getTableNames(), count: getTableNames().length };
    else if (toolName === 'describe_table') result = describeTable(args?.table_name);
    else if (toolName === 'read_query') result = readQuery(args?.query);
    else if (toolName === 'write_query') result = writeQuery(args?.query);
    else if (toolName === 'create_table') result = createTable(args?.query);

    // ====== 文件系统 ======
    else if (toolName === 'fs_read_file') result = fsReadFile(args?.path);
    else if (toolName === 'fs_list_directory') result = fsListDir(args?.path || '.');
    else if (toolName === 'fs_search_files') result = fsSearchFiles(args?.pattern, args?.path || '.');
    else if (toolName === 'fs_write_file') result = fsWriteFile(args?.path, args?.content);

    // ====== RAG ======
    else if (toolName === 'rag_index_path') result = await rag.indexPath(args?.path, args?.pattern);
    else if (toolName === 'rag_search') result = await rag.search(args?.query, args?.topK || 5);
    else if (toolName === 'rag_list_indexed') result = rag.listIndexed();

    // ====== GitHub ======
    else if (toolName === 'github_get_file') result = await githubGetFile(args?.owner, args?.repo, args?.path, args?.branch || 'main');

    else return res.status(400).json({ success: false, error: `未知工具: ${toolName}` });

    console.log(`✅ ${toolName}`, JSON.stringify(result).slice(0, 200));
    res.json({ success: true, toolName, result });
  } catch (err) {
    console.error(`❌ ${toolName}`, err.message);
    res.status(500).json({ success: false, toolName, error: err.message });
  }
});

// ========== SQLite 处理器 ==========
function getTableNames() {
  const r = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  return (r[0]?.values || []).map(row => row[0]);
}
function describeTable(name) {
  if (!name) throw new Error('缺少 table_name');
  const r = db.exec(`PRAGMA table_info('${name.replace(/'/g, "''")}')`);
  if (!r[0]) throw new Error(`表 "${name}" 不存在`);
  return { table: name, columns: r[0].values.map(row => ({ cid: row[0], name: row[1], type: row[2], notnull: row[3] === 1, default: row[4], pk: row[5] === 1 })) };
}
function readQuery(q) {
  if (!q) throw new Error('缺少 query');
  if (!q.trim().toUpperCase().startsWith('SELECT') && !q.trim().toUpperCase().startsWith('PRAGMA') && !q.trim().toUpperCase().startsWith('EXPLAIN')) throw new Error('仅允许 SELECT/PRAGMA');
  const r = db.exec(q);
  if (!r.length) return { columns: [], rows: [], rowCount: 0 };
  const f = r.map(rr => ({ columns: rr.columns, rows: rr.values, rowCount: rr.values.length }));
  return f.length === 1 ? f[0] : f;
}
function writeQuery(q) {
  if (!q) throw new Error('缺少 query');
  if (q.trim().toUpperCase().startsWith('SELECT')) throw new Error('write_query 不支持 SELECT');
  db.run(q);
  const n = db.getRowsModified();
  saveDatabase();
  return { changes: n, message: `${n} 行受影响` };
}
function createTable(q) {
  if (!q) throw new Error('缺少 query');
  if (!q.trim().toUpperCase().startsWith('CREATE TABLE')) throw new Error('仅允许 CREATE TABLE');
  db.run(q);
  saveDatabase();
  return { message: '表创建成功' };
}

// ========== 文件系统处理器 ==========
const PROJECT_ROOT = path.resolve(__dirname);

function safePath(inputPath) {
  const resolved = path.resolve(PROJECT_ROOT, inputPath || '.');
  // 安全检查：不允许访问项目目录之外的文件
  if (!resolved.startsWith(PROJECT_ROOT) && !inputPath.startsWith(PROJECT_ROOT)) {
    throw new Error('安全限制：不允许访问项目目录之外的文件');
  }
  return resolved;
}

function fsReadFile(inputPath) {
  const fullPath = safePath(inputPath);
  if (!fs.existsSync(fullPath)) throw new Error(`文件不存在: ${inputPath}`);
  if (fs.statSync(fullPath).isDirectory()) throw new Error(`${inputPath} 是目录`);
  // 限制文件大小（最大 100KB）
  if (fs.statSync(fullPath).size > 100 * 1024) throw new Error('文件过大（>100KB），请使用其他方式查看');
  const content = fs.readFileSync(fullPath, 'utf-8');
  return { path: inputPath, size: content.length, content };
}

function fsListDir(inputPath) {
  const fullPath = safePath(inputPath);
  if (!fs.existsSync(fullPath)) throw new Error(`目录不存在: ${inputPath}`);
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  const items = entries.map(e => ({
    name: e.name,
    type: e.isDirectory() ? 'directory' : 'file',
    size: e.isFile() ? fs.statSync(path.join(fullPath, e.name)).size : undefined,
  }));
  return { path: inputPath, count: items.length, items };
}

function fsSearchFiles(pattern, basePath) {
  const fullPath = safePath(basePath);
  // 使用 glob.sync 简化
  const files = glob.sync(pattern, {
    cwd: fullPath,
    ignore: ['node_modules/**', 'dist/**', '.git/**', '*.db'],
    nodir: true,
    maxDepth: 10,
  });
  return { pattern, basePath, matches: files.length, files: files.slice(0, 100) };
}

function fsWriteFile(inputPath, content) {
  const fullPath = safePath(inputPath);
  // 安全检查：禁止覆盖关键文件
  const basename = path.basename(fullPath);
  if (['.env', '.env.local', 'package-lock.json'].includes(basename)) {
    throw new Error('安全限制：不允许修改此文件');
  }
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  return { path: inputPath, size: content.length, message: '文件写入成功' };
}

// ========== GitHub 处理器 ==========
async function githubGetFile(owner, repo, filePath, branch) {
  if (!owner || !repo || !filePath) throw new Error('缺少 owner/repo/path 参数');
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`GitHub 请求失败: ${res.status} ${res.statusText}`);
  const content = await res.text();
  if (content.length > 50 * 1024) return { owner, repo, path: filePath, branch, size: content.length, content: content.slice(0, 50000) + '\n...(内容过长已截断)', truncated: true };
  return { owner, repo, path: filePath, branch, size: content.length, content };
}

// ========== 启动 ==========
async function startServer() {
  await loadDatabase();

  app.listen(PORT, () => {
    console.log(`\n🚀 MCP 代理服务已启动  http://localhost:${PORT}`);
    console.log(`   🗄️  SQLite : ${SQLITE_TOOLS.length} 个工具`);
    console.log(`   📁 文件系统: ${FS_TOOLS.length} 个工具`);
    console.log(`   🧠 RAG    : ${RAG_TOOLS.length} 个工具 (Embedding: ${ZHIPU_API_KEY ? '✅ 已配置' : '⚠️ 未配置 API Key'})`);
    console.log(`   🐙 GitHub : ${GITHUB_TOOLS.length} 个工具\n`);
  });
}

startServer();
