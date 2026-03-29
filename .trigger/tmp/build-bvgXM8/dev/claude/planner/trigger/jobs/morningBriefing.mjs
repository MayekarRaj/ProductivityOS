import {
  DEFAULT_USER_ID,
  and,
  days,
  db,
  eq,
  events,
  getTelegramChatId,
  sendMessage,
  tasks
} from "../../../../../chunk-JQK5DW6I.mjs";
import {
  schedules_exports
} from "../../../../../chunk-FXXSWH2I.mjs";
import {
  init_esm
} from "../../../../../chunk-SKOTX2MW.mjs";

// trigger/jobs/morningBriefing.ts
init_esm();
function getTodayIST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(/* @__PURE__ */ new Date());
}
function formatTimeIST(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}
var morningBriefingJob = schedules_exports.task({
  id: "morning-briefing",
  // 2:30am UTC = 8:00am IST
  cron: "30 2 * * *",
  run: async () => {
    const chatId = await getTelegramChatId();
    if (!chatId) return { skipped: "no telegram linked" };
    const todayStr = getTodayIST();
    const [day] = await db.select().from(days).where(and(eq(days.userId, DEFAULT_USER_ID), eq(days.date, todayStr)));
    if (!day) {
      await sendMessage(chatId, `☀️ Good morning! No plan set up for today yet.

Open the app or send me tasks to get started.`);
      return { sent: true };
    }
    const [todayTasks, todayEvents] = await Promise.all([
      db.select().from(tasks).where(and(eq(tasks.dayId, day.id), eq(tasks.done, false))),
      db.select().from(events).where(eq(events.dayId, day.id)).orderBy(events.startsAt)
    ]);
    const lines = [`☀️ *Good morning! Here's your day:*`];
    if (todayEvents.length > 0) {
      lines.push("\n🗓 *Schedule*");
      for (const event of todayEvents) {
        const time = formatTimeIST(new Date(event.startsAt));
        const end = event.endsAt ? ` → ${formatTimeIST(new Date(event.endsAt))}` : "";
        lines.push(`  ${time}${end} — ${event.title}`);
      }
    }
    if (todayTasks.length > 0) {
      lines.push("\n📋 *Tasks*");
      for (const task of todayTasks) lines.push(`  • ${task.text}`);
    }
    if (todayEvents.length === 0 && todayTasks.length === 0) {
      lines.push("\nNothing scheduled yet. Send me tasks to plan your day!");
    }
    lines.push("\nHave a great day! 💪");
    await sendMessage(chatId, lines.join("\n"), "Markdown");
    return { sent: true, tasks: todayTasks.length, events: todayEvents.length };
  }
});
export {
  morningBriefingJob
};
//# sourceMappingURL=morningBriefing.mjs.map
