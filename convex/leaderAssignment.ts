import { logAudit } from "./auditLog";

export const OPEN_TASK_STATUSES = new Set(["pending", "in_progress", "rescheduled", "escalated"]);

export async function resolveEffectiveLeader(ctx: any, teen: any) {
  if (teen?.liderPrincipalId) return { userId: teen.liderPrincipalId, source: "individual" as const };
  if (teen?.groupId) {
    const group = await ctx.db.get(teen.groupId);
    if (group?.leaderId) return { userId: group.leaderId, source: "group" as const };
  }
  return { userId: undefined, source: "unassigned" as const };
}

export async function reassignOpenTasksForTeen(ctx: any, args: { teenId: any; assignedToUserId?: any; token?: string; reason: string }) {
  const tasks = await ctx.db.query("pastoralTasks").withIndex("by_teenId", (q: any) => q.eq("teenId", args.teenId)).collect();
  const updatedAt = new Date().toISOString();
  for (const task of tasks) {
    if (!OPEN_TASK_STATUSES.has(task.status) || String(task.assignedToUserId || "") === String(args.assignedToUserId || "")) continue;
    const patch = { assignedToUserId: args.assignedToUserId, updatedAt };
    await ctx.db.patch(task._id, patch);
    await logAudit(ctx, {
      token: args.token,
      action: "pastoral_task.reassigned_automatically",
      entityType: "pastoralTask",
      entityId: String(task._id),
      previousValue: task,
      newValue: { ...task, ...patch },
      details: args.reason,
    });
  }
}
