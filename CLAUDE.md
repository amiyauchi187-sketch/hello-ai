# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A zero-dependency Node.js task-management CLI. All code lives in `todo.js`; there is no `package.json`, build step, linter, or test suite. The README and all user-facing output (messages, errors, help text) are in Japanese. Keep new output and code comments in Japanese to match.

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

Tasks are stored in `tasks.json` next to `todo.js` (resolved via `__dirname`, not the cwd). The file is the user's personal data and is gitignored. Running the CLI to test a change writes to that real file, so back it up first (or restore it afterward) rather than adding junk tasks or overwriting it.

## Architecture notes

- **Flow:** each command is load → mutate → save. `loadTasks()` reads the whole JSON array and `saveTasks()` rewrites it. There is no locking or partial update.
- **Task shape:** `{ id, title, done, createdAt, due?, priority?, doneAt? }`. `priority` is `high` / `medium` / `low` and is omitted when unset. `tags` is an array of names stored without the leading `#`, deduplicated, and omitted when empty. `due` is a normalized `YYYY-MM-DD` string and is omitted entirely when unset (`due ... none` deletes the key). `id` is `max(existing ids) + 1`, so ids are never reused unless the highest one is removed.
- **Dates:** `parseDue()` accepts `YYYY-M-D`, rejects impossible dates by round-tripping through `Date`, and zero-pads the result. Because of that padding, `list` can sort by plain string comparison. `daysUntil()` uses local-time midnight, so the "あと◯日 / 今日まで / ◯日超過" labels depend on the machine's timezone.
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