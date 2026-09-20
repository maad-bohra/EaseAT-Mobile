import { createDatabase, setDb } from '../db/database.js';
import { openExpoDriver } from '../db/expoAdapter.js';
import { migrate } from '../db/schema.js';
import { regenerateHorizon } from '../services/session.service.js';

/**
 * Opens the on-device database, brings the schema up to date, and creates the
 * next 60 days of classes from the timetable. With no server to run a
 * scheduler, doing this on every launch is what keeps "Today" populated.
 */
export async function bootstrap() {
  const db = createDatabase(await openExpoDriver());
  setDb(db);
  await migrate(db);
  try {
    await regenerateHorizon(60);
  } catch (error) {
    // A failed roll-forward must never stop the app from opening.
    console.warn('Could not generate upcoming classes', error);
  }
  return db;
}
