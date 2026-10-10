#!/usr/bin/env node
// シンプルなタスク管理CLI: add / due / priority / tag / untag / list / done
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

// 優先度: 保存値 → 表示名と並び順
const PRIORITIES = {
  high: { label: '高', rank: 0 },
  medium: { label: '中', rank: 1 },
  low: { label: '低', rank: 2 },
};

// "高/中/低" (または high/medium/low, h/m/l) を検証して保存値を返す。不正なら終了する
function parsePriority(str) {
  const aliases = { 高: 'high', 中: 'medium', 低: 'low', h: 'high', m: 'medium', l: 'low' };
  // hasOwn で判定し、toString などプロトタイプ上の名前を受け付けないようにする
  const key = Object.hasOwn(PRIORITIES, str) ? str : Object.hasOwn(aliases, str) ? aliases[str] : undefined;
  if (!key) {
    console.error(`エラー: 優先度は 高・中・低 のいずれかで指定してください (指定値: ${str ?? 'なし'})`);
    process.exit(1);
  }
  return key;
}

// 並び替え用の順位 (優先度なしは最後)
function priorityRank(t) {
  return t.priority ? PRIORITIES[t.priority].rank : Object.keys(PRIORITIES).length;
}

// 期限の比較 (近い順、期限なしは最後)。YYYY-MM-DD に揃えてあるので文字列比較でよい
function compareDue(a, b) {
  if (a.due === b.due) return 0;
  if (!a.due) return 1;
  if (!b.due) return -1;
  return a.due < b.due ? -1 : 1;
}

function formatPriority(t) {
  return t.priority ? `[${PRIORITIES[t.priority].label}] ` : '';
}

// "#転職" または "転職" を検証し、先頭の # を除いたタグ名を返す。不正なら終了する
function parseTag(str) {
  const name = (str || '').replace(/^#/, '');
  if (!name || /\s/.test(name)) {
    console.error(`エラー: タグは空白を含まない文字列で指定してください (指定値: ${str ?? 'なし'})`);
    process.exit(1);
  }
  return name;
}

// タスクにタグを追加する (重複は追加しない)
function addTags(task, tags) {
  const merged = [...new Set([...(task.tags || []), ...tags])];
  if (merged.length > 0) task.tags = merged;
}

// タスクから指定のタグを外す (空になったらキーごと削除)
function removeTags(task, tags) {
  const rest = (task.tags || []).filter((name) => !tags.includes(name));
  if (rest.length > 0) task.tags = rest;
  else delete task.tags;
}

// 指定したタグをすべて持っているか
function hasAllTags(t, tags) {
  return tags.every((name) => (t.tags || []).includes(name));
}

function formatTags(t) {
  return t.tags ? ' ' + t.tags.map((name) => `#${name}`).join(' ') : '';
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
  let priority;
  const tags = [];
  const words = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--due' || args[i] === '-d') due = parseDue(args[++i]);
    else if (args[i] === '--priority' || args[i] === '-p') priority = parsePriority(args[++i]);
    else if (args[i] === '--tag' || args[i] === '-t') tags.push(parseTag(args[++i]));
    else if (args[i].startsWith('#')) tags.push(parseTag(args[i]));
    else words.push(args[i]);
  }
  const title = words.join(' ').trim();
  if (!title) {
    console.error('エラー: タスク名を指定してください。例: node todo.js add "牛乳を買う" --due 2026-10-15 --priority 高 --tag 買い物');
    process.exit(1);
  }
  const tasks = loadTasks();
  const id = tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;
  const task = { id, title, done: false, createdAt: new Date().toISOString() };
  if (due) task.due = due;
  if (priority) task.priority = priority;
  addTags(task, tags);
  tasks.push(task);
  saveTasks(tasks);
  console.log(`追加しました: [${id}] ${formatPriority(task)}${title}${formatTags(task)}${formatDue(task)}`);
}

// タグ指定の引数 (1つ以上) をタグ名の配列にする
function parseTagArgs(tagArgs) {
  if (tagArgs.length === 0) {
    console.error('エラー: タグを1つ以上指定してください。例: node todo.js tag 1 転職 学習');
    process.exit(1);
  }
  return tagArgs.map(parseTag);
}

function tag(idArg, tagArgs) {
  const tasks = loadTasks();
  const task = findTask(tasks, idArg);
  addTags(task, parseTagArgs(tagArgs));
  saveTasks(tasks);
  console.log(`タグを付けました: [${task.id}] ${task.title}${formatTags(task)}`);
}

function untag(idArg, tagArgs) {
  const tasks = loadTasks();
  const task = findTask(tasks, idArg);
  if (tagArgs.length === 1 && tagArgs[0] === 'all') delete task.tags;
  else removeTags(task, parseTagArgs(tagArgs));
  saveTasks(tasks);
  console.log(`タグを外しました: [${task.id}] ${task.title}${formatTags(task)}`);
}

function setPriority(idArg, priorityArg) {
  const tasks = loadTasks();
  const task = findTask(tasks, idArg);
  if (priorityArg === 'none') {
    delete task.priority;
    saveTasks(tasks);
    console.log(`優先度を解除しました: [${task.id}] ${task.title}`);
    return;
  }
  task.priority = parsePriority(priorityArg);
  saveTasks(tasks);
  console.log(`優先度を設定しました: [${task.id}] ${formatPriority(task)}${task.title}`);
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

// list の引数を { showAll, tags } にする。知らない引数があれば終了する
function parseListArgs(args) {
  const opts = { showAll: false, tags: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--all' || args[i] === '-a') opts.showAll = true;
    else if (args[i] === '--tag' || args[i] === '-t') opts.tags.push(parseTag(args[++i]));
    else if (args[i].startsWith('#')) opts.tags.push(parseTag(args[i]));
    else {
      console.error(`エラー: list の引数が正しくありません (指定値: ${args[i]})。タグで絞り込むときは --tag <タグ> を使ってください。`);
      process.exit(1);
    }
  }
  return opts;
}

// 一覧が空のときのメッセージ
function emptyListMessage({ showAll, tags }) {
  const target = showAll ? 'タスク' : '未完了のタスク';
  if (tags.length === 0) return `${target}はありません。`;
  return `${tags.map((name) => `#${name}`).join(' ')} の付いた${target}はありません。`;
}

function list(args) {
  const opts = parseListArgs(args);
  const shown = loadTasks().filter((t) => (opts.showAll || !t.done) && hasAllTags(t, opts.tags));
  if (shown.length === 0) {
    console.log(emptyListMessage(opts));
    return;
  }
  // 優先度順 (高→中→低→なし)、同じ優先度なら期限が近い順 (期限なしは最後)、さらに番号順
  shown.sort((a, b) => priorityRank(a) - priorityRank(b) || compareDue(a, b) || a.id - b.id);
  for (const t of shown) {
    console.log(`${t.done ? '[x]' : '[ ]'} ${t.id}. ${formatPriority(t)}${t.title}${formatTags(t)}${formatDue(t)}`);
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
  node todo.js add <タスク名> [--due YYYY-MM-DD] [--priority 高|中|低] [--tag <タグ>]...
                                                 タスクを追加 (期限・優先度・タグは任意)
  node todo.js due <番号> <YYYY-MM-DD|none>      期限を設定 / none で解除
  node todo.js priority <番号> <高|中|低|none>   優先度を設定 / none で解除
  node todo.js tag <番号> <タグ>...              タグを付ける
  node todo.js untag <番号> <タグ...|all>        タグを外す / all ですべて外す
  node todo.js list [--all] [--tag <タグ>]...    未完了タスクを優先度順・期限が近い順に一覧
                                                 (--all で完了済みも表示、--tag でタグを持つものに絞り込み)
  node todo.js done <番号>                       タスクを完了にする

  タグは "#転職" のように # 付きでも指定できます (シェルのコメント扱いを避けるため引用符で囲んでください)`);
}

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case 'add':
    add(args);
    break;
  case 'due':
    setDue(args[0], args[1]);
    break;
  case 'priority':
  case 'pri':
    setPriority(args[0], args[1]);
    break;
  case 'list':
  case 'ls':
    list(args);
    break;
  case 'tag':
    tag(args[0], args.slice(1));
    break;
  case 'untag':
    untag(args[0], args.slice(1));
    break;
  case 'done':
    done(args[0]);
    break;
  default:
    help();
    if (cmd && cmd !== 'help') process.exit(1);
}
