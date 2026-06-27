import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const getPppData = internalQuery({
  handler: async (ctx) => {
    const teens = await ctx.db.query("teens").collect();
    const analyses = await ctx.db.query("journalAnalysis").collect();
    const attendance = await ctx.db.query("attendance").collect();
    const journal = await ctx.db.query("journal").collect();
    const contacts = await ctx.db.query("contacts").collect();
    const dropoutPredictions = await ctx.db.query("dropoutPredictions").collect();
    const now = new Date().toISOString().slice(0, 10);

    return teens.map((t) => {
      const teenAttendance = attendance.filter((a) => a.teenId === t._id);
      const total = teenAttendance.length;
      const present = teenAttendance.filter((a) => a.status === "present").length;
      const pct = total ? Math.round((present / total) * 100) : 0;
      const sorted = [...teenAttendance].sort((a, b) => b.date.localeCompare(a.date));
      let consecAbsences = 0;
      for (const r of sorted) { if (r.status === "absent") consecAbsences++; else break; }

      const teenAnalyses = analyses.filter((a) => a.teenId === t._id);
      const highRiskCount = teenAnalyses.filter((a) => a.riskLevel === "high").length;
      const crisisCount = teenAnalyses.filter((a) => a.isCrisis).length;

      const teenJournal = journal.filter((j) => j.teenId === t._id);
      const lastJournalDate = teenJournal.length > 0 ? teenJournal[0].entryDate : null;
      const daysSinceLastJournal = lastJournalDate
        ? Math.max(0, Math.round((new Date(now).getTime() - new Date(lastJournalDate).getTime()) / 86400000))
        : 99;

      const teenContacts = contacts.filter((c) => c.teenId === t._id);
      const lastContacted = teenContacts.find((c) => c.status === "contacted");
      const daysWithoutContact = lastContacted?.contactedAt
        ? Math.max(0, Math.round((new Date(now).getTime() - new Date(lastContacted.contactedAt).getTime()) / 86400000))
        : 99;

      const dropout = dropoutPredictions.find((d) => d.teenId === t._id);
      const dropoutRisk = dropout ? dropout.probability / 100 : 0;

      const vulnerabilityLevel = Math.min(1, (highRiskCount * 0.3 + crisisCount * 0.4 + (teenAnalyses.length > 0 ? 0.3 : 0)));

      const ppp = Math.round(
        dropoutRisk * 30 +
        vulnerabilityLevel * 25 +
        Math.min(1, daysWithoutContact / 14) * 20 +
        Math.min(1, consecAbsences / 4) * 15 +
        Math.min(1, daysSinceLastJournal / 30) * 10
      );

      return {
        teenId: t._id,
        ppp: Math.min(100, Math.max(0, ppp)),
        dropoutRisk: Math.round(dropoutRisk * 100),
        vulnerabilityLevel: Math.round(vulnerabilityLevel * 100),
        daysWithoutContact,
        consecutiveAbsences: consecAbsences,
        daysSinceLastJournal,
      };
    });
  },
});

export const storePpp = internalMutation({
  args: {
    teenId: v.id("teens"),
    ppp: v.number(),
    dropoutRisk: v.number(),
    vulnerabilityLevel: v.number(),
    daysWithoutContact: v.number(),
    consecutiveAbsences: v.number(),
    daysSinceLastJournal: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teenPpp")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .first();
    const data = { ...args, calculatedAt: new Date().toISOString() };
    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("teenPpp", data);
    }
  },
});

export const calculateAllPpp = action({
  handler: async (ctx) => {
    const list = await ctx.runQuery(internal.ppp.getPppData);
    for (const item of list) {
      await ctx.runMutation(internal.ppp.storePpp, item);
    }
    return { success: true, count: list.length };
  },
});

export const getPppRanking = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("teenPpp")
      .withIndex("by_ppp")
      .order("desc")
      .collect();
  },
});

export const getTeenPpp = query({
  args: { teenId: v.id("teens") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teenPpp")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .first();
  },
});
