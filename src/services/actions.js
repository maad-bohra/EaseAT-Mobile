import { notifyReschedule } from './notification.service.js';
import { rescheduleSession } from './session.service.js';

/**
 * Moves a class and records a "moved" notification. Kept apart from the
 * session service so sessions and notifications never import each other.
 */
export async function rescheduleClass(sessionId, details) {
  const result = await rescheduleSession(sessionId, details);
  await notifyReschedule({
    subjectName: result.replacement.subject.name,
    from: `${result.original.date} ${result.original.startTime}`,
    to: `${result.replacement.date} ${result.replacement.startTime}`,
  });
  return result;
}
