import { DatabaseSync } from 'node:sqlite';
import { createDatabase, setDb } from '../src/db/database.js';
import { migrate } from '../src/db/schema.js';

/** In-memory SQLite behind the same driver shape the app uses on the phone. */
function nodeDriver() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  return {
    all: (sql, params = []) => sqlite.prepare(sql).all(...params),
    get: (sql, params = []) => sqlite.prepare(sql).get(...params),
    run: (sql, params = []) => {
      const result = sqlite.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    exec: (sql) => sqlite.exec(sql),
  };
}

export async function freshDb() {
  const db = createDatabase(nodeDriver());
  setDb(db);
  await migrate(db);
  return db;
}

export function fmt(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
