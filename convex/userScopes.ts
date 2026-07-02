import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserFromToken } from "./authHelper";
import { logAudit } from "./auditLog";

export const list = query({
  args: { token: v.string(), userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) return [];
    const targetId = args.userId || user._id;
    return await ctx.db
      .query("userScopes")
      .withIndex("by_userId", q => q.eq("userId", targetId))
      .collect();
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    role: v.string(),
    campusId: v.optional(v.id("campus")),
    ministryId: v.optional(v.id("ministry")),
    groupId: v.optional(v.id("group")),
  },
  handler: async (ctx, args) => {
    const requester = await getUserFromToken(ctx, args.token);
    if (!requester || (requester.role !== "pastor" && requester.role !== "admin")) {
      throw new Error("No autorizado");
    }
    const id = await ctx.db.insert("userScopes", {
      userId: args.userId,
      role: args.role,
      campusId: args.campusId,
      ministryId: args.ministryId,
      groupId: args.groupId,
      assignedBy: requester._id,
      createdAt: new Date().toISOString(),
    });
    await logAudit(ctx, {
      token: args.token,
      action: "user.scope_assigned",
      entityType: "userScope",
      entityId: String(id),
      newValue: {
        userId: args.userId,
        role: args.role,
        campusId: args.campusId,
        ministryId: args.ministryId,
        groupId: args.groupId,
      },
      details: `Ambito asignado por ${requester.name}.`,
    });
    return id;
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("userScopes") },
  handler: async (ctx, args) => {
    const requester = await getUserFromToken(ctx, args.token);
    if (!requester || (requester.role !== "pastor" && requester.role !== "admin")) {
      throw new Error("No autorizado");
    }
    const current = await ctx.db.get(args.id);
    await ctx.db.delete(args.id);
    await logAudit(ctx, {
      token: args.token,
      action: "user.scope_removed",
      entityType: "userScope",
      entityId: String(args.id),
      previousValue: current,
      details: "Ambito de usuario removido.",
    });
  },
});

export const myScopes = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) return [];

    const scopes = await ctx.db
      .query("userScopes")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    // Enriquecer scopes con los nombres de sedes, ministerios y grupos
    return Promise.all(
      scopes.map(async (s) => {
        let campusName, ministryName, groupName;
        if (s.campusId) {
          const c = await ctx.db.get(s.campusId);
          campusName = c?.name;
        }
        if (s.ministryId) {
          const m = await ctx.db.get(s.ministryId);
          ministryName = m?.name;
        }
        if (s.groupId) {
          const g = await ctx.db.get(s.groupId);
          groupName = g?.name;
        }
        return {
          ...s,
          campusName,
          ministryName,
          groupName,
        };
      })
    );
  },
});

export const assignMe = mutation({
  args: {
    token: v.string(),
    campusId: v.optional(v.id("campus")),
    ministryId: v.optional(v.id("ministry")),
    groupId: v.optional(v.id("group")),
    role: v.union(
      v.literal("pastor"),
      v.literal("director"),
      v.literal("coordinador"),
      v.literal("leader"),
      v.literal("helper")
    ),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) throw new Error("No autorizado");

    const permissions = (user.permissions && user.permissions.length > 0) ? user.permissions : ((user.role === "pastor" || user.role === "admin") ? ["manage_users"] : []);
    if (!permissions.includes("manage_users")) {
      throw new Error("No tienes permisos suficientes para auto-asignarte ministerios.");
    }

    if (!args.campusId && !args.ministryId && !args.groupId) {
      throw new Error("Debe seleccionar al menos un ámbito (sede, ministerio o grupo).");
    }

    const id = await ctx.db.insert("userScopes", {
      userId: user._id,
      role: args.role,
      campusId: args.campusId,
      ministryId: args.ministryId,
      groupId: args.groupId,
      assignedBy: user._id,
      createdAt: new Date().toISOString(),
    });
    await logAudit(ctx, {
      token: args.token,
      action: "user.scope_assigned",
      entityType: "userScope",
      entityId: String(id),
      newValue: {
        userId: user._id,
        role: args.role,
        campusId: args.campusId,
        ministryId: args.ministryId,
        groupId: args.groupId,
      },
      details: "Autoasignacion de ambito.",
    });
  },
});
