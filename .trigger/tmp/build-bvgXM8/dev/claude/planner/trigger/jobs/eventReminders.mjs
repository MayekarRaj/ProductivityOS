import {
  and,
  db,
  eq,
  events,
  getTelegramChatId,
  lte,
  sendMessage
} from "../../../../../chunk-NM5LSGJY.mjs";
import {
  schedules_exports
} from "../../../../../chunk-KZ52IAF7.mjs";
import "../../../../../chunk-C5DL5I2P.mjs";
import {
  init_esm
} from "../../../../../chunk-SKOTX2MW.mjs";

// trigger/jobs/eventReminders.ts
init_esm();
var eventReminderJob = schedules_exports.task({
  id: "event-reminders",
  // Run every minute
  cron: "* * * * *",
  run: async () => {
    const chatId = await getTelegramChatId();
    if (!chatId) return { skipped: "no telegram linked" };
    const pending = await db.select().from(events).where(
      and(
        lte(events.remindAt, /* @__PURE__ */ new Date()),
        eq(events.reminded, false)
      )
    );
    if (pending.length === 0) return { sent: 0 };
    for (const event of pending) {
      const now = /* @__PURE__ */ new Date();
      const startsAt = new Date(event.startsAt);
      const minsUntil = Math.round((startsAt.getTime() - now.getTime()) / 6e4);
      let message;
      if (minsUntil <= 0) {
        message = `🔔 *${event.title}* is starting now!`;
      } else if (minsUntil <= 60) {
        message = `🔔 *${event.title}* starts in ${minsUntil} min`;
      } else {
        message = `🔔 Reminder: *${event.title}*`;
      }
      await sendMessage(chatId, message, "Markdown");
      await db.update(events).set({ reminded: true }).where(eq(events.id, event.id));
    }
    return { sent: pending.length };
  }
});
export {
  eventReminderJob
};
//# sourceMappingURL=eventReminders.mjs.map
