#!/usr/bin/env node
// シンプルなタスク管理CLI: add / list / done
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'tasks.json');

function loadTasks() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error(`エラー: ${DATA_FILE} の読み込みに失敗しました (${e.message})`);
    process.exit(1);
  }
}

function saveTasks(tasks) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2) + '\n', 'utf8');
}

// "YYYY-MM-DD" を検証して返す。不正なら終了する
function parseDue(str) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str || '');
  const d = m && new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!d || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) {
    console.error(`エラー: 期限日は YYYY-MM-DD 形式で指定してください (指定値: ${str ?? 'なし'})`);
    process.exit(1);
  }
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

// 今日から期限日までの日数 (過ぎていれば負)
function daysUntil(due) {
  const [y, mo, d] = due.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, mo - 1, d) - today) / 86400000);
}

function formatDue(t) {
  if (!t.due) return '';
  if (t.done) return ` (期限: ${t.due})`;
  const n = daysUntil(t.due);
  const note = n < 0 ? `${-n}日超過` : n === 0 ? '今日まで' : `あと${n}日`;
  return ` (期限: ${t.due}, ${note})`;
}

function add(args) {
  let due;
  const words = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--due' || args[i] === '-d') due = parseDue(args[++i]);
    else words.push(args[i]);
  }
  const title = words.join(' ').trim();
  if (!title) {
    console.error('エラー: タスク名を指定してください。例: node todo.js add "牛乳を買う" --due 2026-10-15');
    process.exit(1);
  }
  const tasks = loadTasks();
  const id = tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;
  const task = { id, title, done: false, createdAt: new Date().toISOString() };
  if (due) task.due = due;
  tasks.push(task);
  saveTasks(tasks);
  console.log(`追加しました: [${id}] ${title}${formatDue(task)}`);
}

function setDue(idArg, dateArg) {
  const tasks = loadTasks();
  const task = findTask(tasks, idArg);
  if (dateArg === 'none') {
    delete task.due;
    saveTasks(tasks);
    console.log(`期限を解除しました: [${task.id}] ${task.title}`);
    return;
  }
  task.due = parseDue(dateArg);
  saveTasks(tasks);
  console.log(`期限を設定しました: [${task.id}] ${task.title}${formatDue(task)}`);
}

function list(showAll) {
  const tasks = loadTasks();
  const shown = showAll ? tasks : tasks.filter((t) => !t.done);
  if (shown.length === 0) {
    console.log(showAll ? 'タスクはありません。' : '未完了のタスクはありません。');
    return;
  }
  // 期限が近い順。期限なしは最後、同じ期限なら番号順
  shown.sort((a, b) => {
    if (a.due !== b.due) {
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due < b.due ? -1 : 1;
    }
    return a.id - b.id;
  });
  for (const t of shown) {
    console.log(`${t.done ? '[x]' : '[ ]'} ${t.id}. ${t.title}${formatDue(t)}`);
  }
}

function findTask(tasks, idArg) {
  const id = Number(idArg);
  if (!Number.isInteger(id)) {
    console.error('エラー: タスク番号を指定してください。');
    process.exit(1);
  }
  const task = tasks.find((t) => t.id === id);
  if (!task) {
    console.error(`エラー: 番号 ${id} のタスクは見つかりません。`);
    process.exit(1);
  }
  return task;
}

function done(idArg) {
  const tasks = loadTasks();
  const task = findTask(tasks, idArg);
  if (task.done) {
    console.log(`既に完了済みです: [${task.id}] ${task.title}`);
    return;
  }
  task.done = true;
  task.doneAt = new Date().toISOString();
  saveTasks(tasks);
  console.log(`完了にしました: [${task.id}] ${task.title}`);
}

function help() {
  console.log(`使い方:
  node todo.js add <タスク名> [--due YYYY-MM-DD]  タスクを追加 (期限は任意)
  node todo.js due <番号> <YYYY-MM-DD|none>      期限を設定 / none で解除
  node todo.js list [--all]                      未完了タスクを期限が近い順に一覧 (--all で完了済みも表示)
  node todo.js done <番号>                       タスクを完了にする`);
}

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case 'add':
    add(args);
    break;
  case 'due':
    setDue(args[0], args[1]);
    break;
  case 'list':
  case 'ls':
    list(args.includes('--all') || args.includes('-a'));
    break;
  case 'done':
    done(args[0]);
    break;
  default:
    help();
    if (cmd && cmd !== 'help') process.exit(1);
}
