import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Visitor conversations are kept for 30 days, then deleted.
crons.daily(
  "delete old chat messages",
  { hourUTC: 8, minuteUTC: 30 },
  internal.chat.deleteOldMessages,
  {},
);

export default crons;
