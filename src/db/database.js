/**
 * A tiny wrapper around whichever SQLite driver is in use (expo-sqlite on the
 * phone, node:sqlite in the tests). It does two things:
 *
 *  1. Gives every service the same four calls: all, get, run, exec.
 *  2. Runs every call one at a time. expo-sqlite's own transaction helper lets
 *     other queries slip in mid-transaction, and this app loads several screens
 *     while writing, so a simple lock keeps multi-step writes intact.
 *
 * Inside `transaction(fn)` use the `tx` object that is passed in, never the
 * outer database, otherwise the call waits for a lock it already holds.
 */

let current = null;

export function setDb(db) {
  current = db;
}

export function getDb() {
  if (!current) throw new Error('The database is not ready yet');
  return current;
}

const clean = (params = []) => params.map((value) => (value === undefined ? null : value));

/**
 * @param raw driver with all(sql, params), get(sql, params), run(sql, params)
 *            and exec(sql). Each may return a value or a promise.
 */
export function createDatabase(raw) {
  let tail = Promise.resolve();

  function locked(task) {
    const result = tail.then(task);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  const direct = {
    all: async (sql, params) => raw.all(sql, clean(params)),
    get: async (sql, params) => (await raw.get(sql, clean(params))) ?? null,
    run: async (sql, params) => raw.run(sql, clean(params)),
    exec: async (sql) => raw.exec(sql),
  };

  return {
    all: (sql, params) => locked(() => direct.all(sql, params)),
    get: (sql, params) => locked(() => direct.get(sql, params)),
    run: (sql, params) => locked(() => direct.run(sql, params)),
    exec: (sql) => locked(() => direct.exec(sql)),
    transaction: (fn) =>
      locked(async () => {
        await raw.exec('BEGIN');
        try {
          const result = await fn(direct);
          await raw.exec('COMMIT');
          return result;
        } catch (error) {
          try {
            await raw.exec('ROLLBACK');
          } catch {
            // The original error is the useful one.
          }
          throw error;
        }
      }),
  };
}
