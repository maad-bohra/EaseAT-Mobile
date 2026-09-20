import * as SQLite from 'expo-sqlite';

/** Opens the on-device database and adapts expo-sqlite to the four-call driver shape. */
export async function openExpoDriver(name = 'easeat.db') {
  const sqlite = await SQLite.openDatabaseAsync(name);
  await sqlite.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  return {
    all: (sql, params) => sqlite.getAllAsync(sql, params),
    get: (sql, params) => sqlite.getFirstAsync(sql, params),
    run: async (sql, params) => {
      const result = await sqlite.runAsync(sql, params);
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
    },
    exec: (sql) => sqlite.execAsync(sql),
  };
}
