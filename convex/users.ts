import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  hashPassword,
  generateSalt,
  generateToken,
  getUserFromToken,
  cleanExpiredSession,
  SESSION_TTL_DAYS,
} from "./authHelper";

export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("pastor"),
      v.literal("director"),
      v.literal("coordinador"),
      v.literal("leader"),
      v.literal("helper")
    ),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requester = await getUserFromToken(ctx, args.token);
    const isSelfRegistration = !requester;

    const canManageUsers = requester && (requester.role === "pastor" || (requester.permissions && requester.permissions.includes("manage_users")));
    if (requester && !canManageUsers) {
      throw new Error("No tienes permisos para registrar usuarios");
    }

    const emailNormalized = args.email.trim().toLowerCase();

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", emailNormalized))
      .first();
    if (existing) throw new Error("El email ya está registrado");

    const salt = generateSalt();
    const hashedPassword = await hashPassword(args.password, salt);

    await ctx.db.insert("users", {
      email: emailNormalized,
      name: args.name,
      role: args.role,
      hashedPassword,
      salt,
      isActive: !isSelfRegistration,
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const emailNormalized = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", emailNormalized))
      .first();
    if (!user) throw new Error("Credenciales inválidas");
    if (!user.isActive) {
      throw new Error("Tu cuenta está pendiente de aprobación por el Pastor.");
    }

    const hashed = await hashPassword(args.password, user.salt);
    if (hashed !== user.hashedPassword) throw new Error("Credenciales inválidas");

    // Clean old sessions for this user
    const oldSessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", q => q.eq("userId", user._id))
      .collect();
    for (const s of oldSessions) {
      await ctx.db.delete(s._id);
    }

    const token = generateToken();
    const expires = new Date();
    expires.setDate(expires.getDate() + SESSION_TTL_DAYS);

    await ctx.db.insert("sessions", {
      userId: user._id,
      token,
      expiresAt: expires.toISOString(),
      createdAt: new Date().toISOString(),
    });

    return {
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions || (user.role === "pastor" ? ["manage_users", "manage_settings", "write_teens", "delete_teens", "view_reports", "use_ai"] : []),
      },
    };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_token", q => q.eq("token", args.token))
      .collect();
    for (const s of sessions) {
      await ctx.db.delete(s._id);
    }
  },
});

export const getMe = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.token) return null;
    const user = await getUserFromToken(ctx, args.token);
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions || (user.role === "pastor" ? ["manage_users", "manage_settings", "write_teens", "delete_teens", "view_reports", "use_ai"] : []),
    };
  },
});

export const listUsers = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    const canManageUsers = user && (user.role === "pastor" || (user.permissions && user.permissions.includes("manage_users")));
    if (!canManageUsers) {
      throw new Error("No autorizado");
    }
    const users = await ctx.db.query("users").collect();
    return users.map(u => ({
      _id: u._id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      permissions: u.permissions || (u.role === "pastor" ? ["manage_users", "manage_settings", "write_teens", "delete_teens", "view_reports", "use_ai"] : []),
    }));
  },
});

export const updateUser = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    name: v.optional(v.string()),
    role: v.optional(v.union(
      v.literal("pastor"),
      v.literal("director"),
      v.literal("coordinador"),
      v.literal("leader"),
      v.literal("helper")
    )),
    isActive: v.optional(v.boolean()),
    password: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const requester = await getUserFromToken(ctx, args.token);
    const canManageUsers = requester && (requester.role === "pastor" || (requester.permissions && requester.permissions.includes("manage_users")));
    if (!canManageUsers) {
      throw new Error("No autorizado");
    }

    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.role !== undefined) patch.role = args.role;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.permissions !== undefined) patch.permissions = args.permissions;
    if (args.password) {
      const salt = generateSalt();
      patch.salt = salt;
      patch.hashedPassword = await hashPassword(args.password, salt);
    }

    await ctx.db.patch(args.userId, patch);
  },
});

export const updateMe = mutation({
  args: {
    token: v.string(),
    name: v.optional(v.string()),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requester = await getUserFromToken(ctx, args.token);
    if (!requester) throw new Error("No autorizado");

    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    
    if (args.password) {
      const salt = generateSalt();
      patch.salt = salt;
      patch.hashedPassword = await hashPassword(args.password, salt);
    }

    await ctx.db.patch(requester._id, patch);
  },
});

export const deleteUser = mutation({
  args: { token: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    const requester = await getUserFromToken(ctx, args.token);
    const canManageUsers = requester && (requester.role === "pastor" || (requester.permissions && requester.permissions.includes("manage_users")));
    if (!canManageUsers) {
      throw new Error("No autorizado");
    }

    // Clean sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", q => q.eq("userId", args.userId))
      .collect();
    for (const s of sessions) {
      await ctx.db.delete(s._id);
    }

    await ctx.db.delete(args.userId);
  },
});

export const setupFirstUser = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("users").first();
    if (existing) {
      throw new Error("Ya existe un usuario. Use register en su lugar.");
    }

    const emailNormalized = args.email.trim().toLowerCase();
    const salt = generateSalt();
    const hashedPassword = await hashPassword(args.password, salt);

    await ctx.db.insert("users", {
      email: emailNormalized,
      name: args.name,
      role: "pastor",
      hashedPassword,
      salt,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

export const hasAnyUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db.query("users").first();
    return user !== null;
  },
});

export const migrateEmailsToLowerCase = mutation({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let migratedCount = 0;
    for (const u of users) {
      const lowerEmail = u.email.trim().toLowerCase();
      if (u.email !== lowerEmail) {
        await ctx.db.patch(u._id, { email: lowerEmail });
        migratedCount++;
      }
    }
    return { migratedCount };
  },
});
