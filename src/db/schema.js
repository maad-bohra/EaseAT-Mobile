/**
 * On-device schema. It mirrors the original server schema, minus everything
 * that only existed for accounts (users, passwords) or for uploaded PDFs.
 * There is one student per phone, so there is no user_id anywhere; the single
 * `settings` row holds the profile and the default attendance requirement.
 *
 * Dates are "YYYY-MM-DD" text and times are "HH:mm" text.
 */

const V1 = `
CREATE TABLE settings (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  name                TEXT,
  college_name        TEXT,
  semester            INTEGER,
  year                INTEGER,
  required_attendance REAL NOT NULL DEFAULT 75
);
INSERT INTO settings (id) VALUES (1);

CREATE TABLE subjects (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE COLLATE NOCASE,
  code                TEXT,
  faculty             TEXT,
  credits             INTEGER,
  color               TEXT NOT NULL DEFAULT '#2F6F4E',
  required_attendance REAL,
  archived            INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE timetable_entries (
  id             TEXT PRIMARY KEY,
  subject_id     TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  day_of_week    INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time     TEXT NOT NULL,
  end_time       TEXT NOT NULL,
  classroom      TEXT,
  faculty        TEXT,
  active         INTEGER NOT NULL DEFAULT 1,
  effective_from TEXT,
  effective_to   TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX idx_timetable_day ON timetable_entries(day_of_week);

CREATE TABLE attendance_sessions (
  id                 TEXT PRIMARY KEY,
  subject_id         TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  timetable_entry_id TEXT REFERENCES timetable_entries(id) ON DELETE SET NULL,
  date               TEXT NOT NULL,
  start_time         TEXT NOT NULL,
  end_time           TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','PRESENT','ABSENT','CANCELLED','NO_CLASS')),
  notes              TEXT,
  is_rescheduled     INTEGER NOT NULL DEFAULT 0,
  marked_at          TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (subject_id, date, start_time)
);
CREATE INDEX idx_sessions_date ON attendance_sessions(date);
CREATE INDEX idx_sessions_subject_status ON attendance_sessions(subject_id, status);

CREATE TABLE rescheduled_classes (
  id                  TEXT PRIMARY KEY,
  original_session_id TEXT NOT NULL UNIQUE REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  new_session_id      TEXT NOT NULL UNIQUE REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  reason              TEXT,
  created_at          TEXT NOT NULL
);

CREATE TABLE academic_calendar (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL,
  type        TEXT NOT NULL
              CHECK (type IN ('HOLIDAY','WORKING_DAY','EXAM','VACATION','SEMESTER_START','SEMESTER_END','OTHER')),
  title       TEXT,
  description TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_calendar_date ON academic_calendar(date);

CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  is_read    INTEGER NOT NULL DEFAULT 0,
  meta       TEXT,
  dedupe_key TEXT UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_notifications_read ON notifications(is_read, created_at);
`;

/** Append new migrations to the end; never edit one that has shipped. */
export const MIGRATIONS = [V1];

export async function migrate(db) {
  const row = await db.get('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  for (let index = version; index < MIGRATIONS.length; index += 1) {
    await db.transaction(async (tx) => {
      await tx.exec(MIGRATIONS[index]);
      await tx.exec(`PRAGMA user_version = ${index + 1}`);
    });
  }
  return MIGRATIONS.length;
}
