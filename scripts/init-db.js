/**
 * 初始化 SQLite 测试数据库
 * 使用 sql.js（纯 JavaScript/WASM，无需原生编译）
 * 运行方式：node scripts/init-db.js
 */
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = path.resolve('test.db');

async function main() {
  // 初始化 sql.js（加载 WebAssembly）
  const SQL = await initSqlJs();

  // 如果已有数据库文件，加载它；否则创建新的
  let db;
  if (fs.existsSync(DB_PATH)) {
    console.log('📂 加载现有数据库:', DB_PATH);
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    console.log('🆕 创建新数据库:', DB_PATH);
    db = new SQL.Database();
  }

  // ========== 建表 ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT DEFAULT '技术部',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      assignee TEXT,
      priority TEXT DEFAULT 'normal',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ========== 检查是否已有数据，避免重复插入 ==========
  const userCount = db.exec('SELECT COUNT(*) as cnt FROM users')[0]?.values[0][0] || 0;

  if (userCount === 0) {
    console.log('📝 插入测试数据...');

    // 用户数据
    db.run("INSERT INTO users (name, role, department) VALUES ('张三', '管理员', '技术部')");
    db.run("INSERT INTO users (name, role, department) VALUES ('李四', '开发者', '技术部')");
    db.run("INSERT INTO users (name, role, department) VALUES ('王五', '产品经理', '产品部')");
    db.run("INSERT INTO users (name, role, department) VALUES ('赵六', '设计师', '设计部')");
    db.run("INSERT INTO users (name, role, department) VALUES ('孙七', '测试工程师', '质量部')");

    // 产品数据
    db.run("INSERT INTO products (name, category, price, stock) VALUES ('机械键盘 Pro', '外设', 499, 100)");
    db.run("INSERT INTO products (name, category, price, stock) VALUES ('4K 显示器', '显示设备', 2499, 50)");
    db.run("INSERT INTO products (name, category, price, stock) VALUES ('人体工学鼠标', '外设', 199, 200)");
    db.run("INSERT INTO products (name, category, price, stock) VALUES ('Type-C 扩展坞', '配件', 299, 150)");
    db.run("INSERT INTO products (name, category, price, stock) VALUES ('降噪耳机', '音频设备', 899, 80)");

    // 销售数据
    db.run("INSERT INTO sales (product_id, quantity, total_amount) VALUES (1, 3, 1497)");
    db.run("INSERT INTO sales (product_id, quantity, total_amount) VALUES (2, 1, 2499)");
    db.run("INSERT INTO sales (product_id, quantity, total_amount) VALUES (1, 2, 998)");
    db.run("INSERT INTO sales (product_id, quantity, total_amount) VALUES (3, 5, 995)");
    db.run("INSERT INTO sales (product_id, quantity, total_amount) VALUES (4, 2, 598)");
    db.run("INSERT INTO sales (product_id, quantity, total_amount) VALUES (5, 1, 899)");
    db.run("INSERT INTO sales (product_id, quantity, total_amount) VALUES (2, 2, 4998)");

    // 任务数据
    db.run("INSERT INTO tasks (title, status, assignee, priority) VALUES ('修复登录页面 bug', 'done', '张三', 'high')");
    db.run("INSERT INTO tasks (title, status, assignee, priority) VALUES ('重构用户模块', 'in_progress', '李四', 'high')");
    db.run("INSERT INTO tasks (title, status, assignee, priority) VALUES ('编写单元测试', 'pending', '孙七', 'normal')");
    db.run("INSERT INTO tasks (title, status, assignee, priority) VALUES ('设计新版首页', 'in_progress', '赵六', 'normal')");
    db.run("INSERT INTO tasks (title, status, assignee, priority) VALUES ('产品需求评审', 'pending', '王五', 'high')");

    console.log('✅ 测试数据插入完成');
  } else {
    console.log('ℹ️  数据库已有数据，跳过初始化');
  }

  // ========== 保存到文件 ==========
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  console.log('💾 数据库已保存到:', DB_PATH);

  // 打印统计
  const tables = ['users', 'products', 'sales', 'tasks'];
  for (const table of tables) {
    const result = db.exec(`SELECT COUNT(*) as cnt FROM ${table}`);
    const count = result[0]?.values[0][0] || 0;
    console.log(`  📊 ${table}: ${count} 条记录`);
  }

  db.close();
  console.log('✅ 数据库初始化完成！');
}

main().catch((err) => {
  console.error('❌ 初始化失败:', err);
  process.exit(1);
});
