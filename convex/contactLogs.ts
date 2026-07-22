import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { canAccessTeen, requireAccess } from "./authz";
import { logAudit } from "./auditLog";

const channel = v.union(v.literal("whatsapp"), v.literal("call"), v.literal("visit"), v.literal("other"));
const outcome = v.union(v.literal("prepared"), v.literal("contacted"), v.literal("no_response"), v.literal("rescheduled"), v.literal("not_applicable"));

async function getTeen(ctx: any, token: string, teenId: any) {
  const access = await requireAccess(ctx, token, "helper");
  const teen = await ctx.db.get(teenId);
  if (!teen || !canAccessTeen(access, teen)) throw new Error("No tienes acceso a este adolescente.");
  return { access, teen };
}

export const listByTeen = query({
  args: { token: v.string(), teenId: v.id("teens") },
  handler: async (ctx, args) => {
    await getTeen(ctx, args.token, args.teenId);
    return await ctx.db.query("contactLogs").withIndex("by_teenId", q => q.eq("teenId", args.teenId)).order("desc").collect();
  },
});

export const getContactContext = query({
  args: { token: v.string(), teenId: v.id("teens") },
  handler: async (ctx, args) => {
    const { teen } = await getTeen(ctx, args.token, args.teenId);
    const guardians = await ctx.db.query("guardians").withIndex("by_teenId", q => q.eq("teenId", args.teenId)).collect();
    return {
      teen: { phone: teen.telefono || "", permitsMessages: teen.permiteMensajes === true },
      guardians: guardians.map(g => ({ _id: g._id, name: g.name, phone: g.phone || "", permitsMessages: g.canReceiveMessages === true })),
    };
  },
});

export const create = mutation({
  args: { token: v.string(), teenId: v.id("teens"), guardianId: v.optional(v.id("guardians")), channel, outcome, contactDate: v.string(), notes: v.optional(v.string()), nextAction: v.optional(v.string()), relatedTaskId: v.optional(v.id("pastoralTasks")) },
  handler: async (ctx, args) => {
    const { access, teen } = await getTeen(ctx, args.token, args.teenId);
    let guardian: any = null;
    if (args.guardianId) {
      guardian = await ctx.db.get(args.guardianId);
      if (!guardian || guardian.teenId !== args.teenId) throw new Error("El apoderado no corresponde al adolescente.");
    }
    if (args.channel === "whatsapp" && !(guardian ? guardian.canReceiveMessages : teen.permiteMensajes)) {
      throw new Error("No hay consentimiento para proponer contacto por WhatsApp. Registra solo el seguimiento interno.");
    }
    const now = new Date().toISOString();
    const id = await ctx.db.insert("contactLogs", { ...args, notes: args.notes?.trim() || undefined, nextAction: args.nextAction?.trim() || undefined, createdByUserId: access.user._id, createdAt: now });
    await logAudit(ctx, { token: args.token, action: "contact_log.created", entityType: "contactLog", entityId: String(id), newValue: { teenId: args.teenId, channel: args.channel, outcome: args.outcome, contactDate: args.contactDate }, sensitivityLevel: "pastoral" });
    return id;
  },
});
