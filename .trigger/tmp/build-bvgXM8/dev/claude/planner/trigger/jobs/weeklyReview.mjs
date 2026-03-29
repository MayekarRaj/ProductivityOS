import {
  getTelegramChatId,
  sendMessage
} from "../../../../../chunk-JQK5DW6I.mjs";
import {
  schedules_exports
} from "../../../../../chunk-FXXSWH2I.mjs";
import {
  init_esm
} from "../../../../../chunk-SKOTX2MW.mjs";

// trigger/jobs/weeklyReview.ts
init_esm();
var weeklyReviewJob = schedules_exports.task({
  id: "weekly-review",
  // 1:30pm UTC on Sundays = 7:00pm IST on Sundays
  cron: "30 13 * * 0",
  run: async () => {
    const chatId = await getTelegramChatId();
    if (!chatId) return { skipped: "no telegram linked" };
    await sendMessage(
      chatId,
      `📝 *Sunday Review time!*

Take 10 minutes to reflect on the week:
• What were the most important things you did?
• What shifted or got delayed?
• What's your fitness plan for next week?

Open the app → Week tab to fill in your review.`,
      "Markdown"
    );
    return { sent: true };
  }
});
export {
  weeklyReviewJob
};
//# sourceMappingURL=weeklyReview.mjs.map
