import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.weekly(
  "recalculate-ppp-weekly",
  { dayOfWeek: "monday", hourUTC: 8, minuteUTC: 0 }, // Lunes 8:00 AM UTC
  api.ppp.calculateAllPpp
);

export default crons;
