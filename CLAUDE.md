# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A zero-dependency Node.js task-management CLI backed by the built-in SQLite module. All code lives in `todo.js`; there is no `package.json`, build step, linter, or test suite. The README and all user-facing output (messages, errors, help text) are in Japanese. Keep new output and code comments in Japanese to match.

## Running

```sh
node todo.js add <title> [--due|-d YYYY-MM-DD] [--priority|-p 高|中|低] [--tag|-t <tag>]... ["#tag"]...
node todo.js due <id> <YYYY-MM-DD|none>
node todo.js priority <id> <高|中|低|none>   # alias: pri
node todo.js tag <id> <tag>...
node todo.js untag <id> <tag...|all>
node todo.js list [--all|-a] [--tag|-t <tag>]...   # alias: ls; multiple tags = AND
node todo.js done <id>
node todo.js help                # any unknown command prints help and exits 1
```

There are no automated tests. Verify changes by running the commands above.

## Data file caution

Tasks are stored in the SQLite database `tasks.db` next to `todo.js` (resolved via `__dirname`, not the cwd). The legacy `tasks.json` in the same folder is the pre-SQLite data. Both are the user's personal data and are gitignored. Running the CLI to test a change writes to the real `tasks.db`, so test on a copy instead: copy `todo.js` (and a copy of `tasks.json` if you want to test migration) into a scratch directory and run it there.

## Architecture notes

- **Storage:** uses Node's built-in `node:sqlite` (`DatabaseSync`, needs Node 22.13+), so there are still no npm dependencies. Tables: `tasks` (snake_case columns, `done` as 0/1) and `task_tags` (`task_id`, `name`, `pos` for tag order). `openDb()` creates the schema lazily.
- **Migration:** when `tasks.db` does not exist and `tasks.json` does, `openDb()` imports the JSON in one transaction. `tasks.json` is only read, never modified. If the JSON is unreadable, the half-created DB is removed so migration can be retried.
- **Flow:** each command is load → mutate → save. `loadTasks()` reads every task into the same plain-object shape as before (`rowToTask()`), commands mutate one task, and `saveTask()` upserts that row and rewrites its tags inside a transaction. `insertTask()` assigns the id.
- **Task shape:** `{ id, title, done, createdAt, due?, priority?, tags?, doneAt? }`. `priority` is `high` / `medium` / `low` and is omitted when unset. `tags` is an array of names stored without the leading `#`, deduplicated, and omitted when empty. `due` is a normalized `YYYY-MM-DD` string and is omitted entirely when unset (`due ... none` deletes the key). `id` is `max(existing ids) + 1`, so ids are never reused unless the highest one is removed.
- **Dates:** `parseDue()` accepts `YYYY-M-D`, rejects impossible dates by round-tripping through `Date`, and zero-pads the result. Because of that padding, `list` can sort by plain string comparison. `daysUntil()` uses local-time midnight, so the "あと◯日 / 今日 / ◯日超過" labels depend on the machine's timezone.
- **Errors:** helpers such as `parseDue()` and `findTask()` print a Japanese error and call `process.exit(1)` directly instead of throwing.
- **List order:** by priority (high → medium → low → none), then due date ascending with tasks without a due date last, then id.

## コーディング規約
- コメントとエラーメッセージは日本語で書く
- 関数は小さく分け、1つの関数には1つの仕事だけをさせる
- 新しい機能を足したら、READMEの使い方も更新する

## 作業の進め方
- 大きな変更の前に、方針を3行で説明してから着手する
- 変更後は、実際にコマンドを動かして結果を確認する

## 禁止事項
- 外部のライブラリ（npmパッケージ）を勝手に追加しない。必要なら先に提案する
- タスクの保存データ（JSONファイル）を削除・上書きしない
- git push は私が指示したときだけ行う