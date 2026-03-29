import {
  DEFAULT_USER_ID,
  and,
  db,
  eq,
  getTelegramChatId,
  habitLogs,
  habits,
  sendMessage
} from "../../../../../chunk-NM5LSGJY.mjs";
import {
  schedules_exports
} from "../../../../../chunk-KZ52IAF7.mjs";
import "../../../../../chunk-C5DL5I2P.mjs";
import {
  init_esm
} from "../../../../../chunk-SKOTX2MW.mjs";

// trigger/jobs/habitReminder.ts
init_esm();
function getTodayIST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(/* @__PURE__ */ new Date());
}
function getWeekdayIST() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short"
  }).format(/* @__PURE__ */ new Date());
}
function isDueToday(frequency, customDays, weekday) {
  switch (frequency) {
    case "daily":
      return true;
    case "weekdays":
      return !["Sat", "Sun"].includes(weekday);
    case "3x":
      return ["Mon", "Wed", "Fri"].includes(weekday);
    case "custom":
      return (customDays ?? []).includes(weekday);
    default:
      return false;
  }
}
var habitReminderJob = schedules_exports.task({
  id: "habit-reminder",
  // 3:30pm UTC = 9:00pm IST
  cron: "30 15 * * *",
  run: async () => {
    const chatId = await getTelegramChatId();
    if (!chatId) return { skipped: "no telegram linked" };
    const todayStr = getTodayIST();
    const weekday = getWeekdayIST();
    const allHabits = await db.select().from(habits).where(and(eq(habits.userId, DEFAULT_USER_ID), eq(habits.archived, false)));
    const dueToday = allHabits.filter(
      (h) => isDueToday(h.frequency, h.customDays ?? null, weekday)
    );
    if (dueToday.length === 0) return { skipped: "no habits due today" };
    const todayLogs = await db.select().from(habitLogs).where(eq(habitLogs.date, todayStr));
    const loggedHabitIds = new Set(todayLogs.map((l) => l.habitId));
    const pending = dueToday.filter((h) => !loggedHabitIds.has(h.id));
    if (pending.length === 0) {
      await sendMessage(chatId, `✅ All habits done for today! Great work.`);
      return { allDone: true };
    }
    const lines = [`🔁 *${pending.length} habit${pending.length > 1 ? "s" : ""} left for today:*`];
    for (const habit of pending) lines.push(`  • ${habit.name}`);
    lines.push("\nOpen the app to log them!");
    await sendMessage(chatId, lines.join("\n"), "Markdown");
    return { sent: true, pending: pending.length };
  }
});
export {
  habitReminderJob
};
//# sourceMappingURL=habitReminder.mjs.map
