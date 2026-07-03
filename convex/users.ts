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
import { logAudit } from "./auditLog";

export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    role: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requester = await getUserFromToken(ctx, args.token);
    const isSelfRegistration = !requester;

    const canManageUsers = requester && (requester.role === "pastor" || requester.role === "admin" || (requester.permissions && requester.permissions.includes("manage_users")));
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

    const id = await ctx.db.insert("users", {
      email: emailNormalized,
      name: args.name,
      role: args.role,
      hashedPassword,
      salt,
      isActive: !isSelfRegistration,
      createdAt: new Date().toISOString(),
    });
    await logAudit(ctx, {
      token: args.token,
      action: "user.created",
      entityType: "user",
      entityId: String(id),
      newValue: { email: emailNormalized, name: args.name, role: args.role, isActive: !isSelfRegistration },
      details: isSelfRegistration ? "Solicitud de registro creada." : "Usuario creado por administrador.",
    });

    return { success: true };
  },
});

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkAndSeedRoles(ctx);
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
      userAgent: args.userAgent,
      createdAt: new Date().toISOString(),
    });

    return {
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: await getEffectivePermissions(ctx, user.role, user.permissions),
        avatar: user.avatarStorageId ? (await ctx.storage.getUrl(user.avatarStorageId)) || undefined : user.avatar,
        phone: user.phone,
        birthDate: user.birthDate,
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
    await checkAndSeedRoles(ctx);
    const user = await getUserFromToken(ctx, args.token);
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: await getEffectivePermissions(ctx, user.role, user.permissions),
      avatar: user.avatarStorageId ? (await ctx.storage.getUrl(user.avatarStorageId)) || undefined : user.avatar,
      phone: user.phone,
      birthDate: user.birthDate,
    };
  },
});

export const listUsers = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    const canManageUsers = user && (user.role === "pastor" || user.role === "admin" || (user.permissions && user.permissions.includes("manage_users")));
    if (!canManageUsers) {
      throw new Error("No autorizado");
    }
    const users = await ctx.db.query("users").collect();
    const resolvedUsers = [];
    for (const u of users) {
      resolvedUsers.push({
        _id: u._id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        permissions: await getEffectivePermissions(ctx, u.role, u.permissions),
        avatar: u.avatarStorageId ? (await ctx.storage.getUrl(u.avatarStorageId)) || undefined : u.avatar,
        phone: u.phone,
        birthDate: u.birthDate,
      });
    }
    return resolvedUsers;
  },
});

export const updateUser = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    password: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
    avatarStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const requester = await getUserFromToken(ctx, args.token);
    const canManageUsers = requester && (requester.role === "pastor" || requester.role === "admin" || (requester.permissions && requester.permissions.includes("manage_users")));
    if (!canManageUsers) {
      throw new Error("No autorizado");
    }

    const current = await ctx.db.get(args.userId);
    if (!current) throw new Error("Usuario no encontrado");

    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    
    if (args.email !== undefined) {
      const emailNormalized = args.email.trim().toLowerCase();
      if (emailNormalized) {
        const existing = await ctx.db
          .query("users")
          .withIndex("by_email", q => q.eq("email", emailNormalized))
          .first();
        if (existing && existing._id !== args.userId) {
          throw new Error("Este correo electrónico ya está en uso por otro usuario.");
        }
        patch.email = emailNormalized;
      }
    }

    if (args.role !== undefined) patch.role = args.role;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.permissions !== undefined) patch.permissions = args.permissions;
    if (args.avatarStorageId !== undefined) patch.avatarStorageId = args.avatarStorageId;
    if (args.password) {
      const salt = generateSalt();
      patch.salt = salt;
      patch.hashedPassword = await hashPassword(args.password, salt);
    }

    await ctx.db.patch(args.userId, patch);
    const action =
      args.permissions !== undefined ? "user.permission_changed" :
      args.role !== undefined ? "user.role_changed" :
      "user.updated";
    await logAudit(ctx, {
      token: args.token,
      action,
      entityType: "user",
      entityId: String(args.userId),
      previousValue: {
        name: current.name,
        email: current.email,
        role: current.role,
        isActive: current.isActive,
        permissions: current.permissions,
      },
      newValue: {
        name: patch.name ?? current.name,
        email: patch.email ?? current.email,
        role: patch.role ?? current.role,
        isActive: patch.isActive ?? current.isActive,
        permissions: patch.permissions ?? current.permissions,
      },
      details: `Usuario actualizado: ${current.email}`,
    });
  },
});

export const updateSessionDevice = mutation({
  args: {
    token: v.string(),
    userAgent: v.optional(v.string()),
    ip: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", q => q.eq("token", args.token))
      .first();
    if (!session) return;
    await ctx.db.patch(session._id, {
      userAgent: args.userAgent || session.userAgent,
      ip: args.ip || session.ip,
    });
  },
});

import { normalizeRole } from "./authz";

async function checkAndSeedRoles(ctx: any) {
  const existing = await ctx.db.query("customRoles").first();
  if (!existing) {
    const defaultRoles = [
      { name: "Administrador", permissions: ["manage_users", "manage_settings", "write_teens", "delete_teens", "view_reports", "use_ai", "view_sensitive_pastoral"] },
      { name: "Pastor", permissions: ["manage_users", "manage_settings", "write_teens", "delete_teens", "view_reports", "use_ai", "view_sensitive_pastoral"] },
      { name: "Director", permissions: ["write_teens", "view_reports", "use_ai", "view_sensitive_pastoral"] },
      { name: "Coordinador", permissions: ["write_teens", "view_reports", "view_sensitive_pastoral"] },
      { name: "Líder", permissions: ["write_teens"] },
      { name: "Ayudante", permissions: [] },
    ];
    for (const r of defaultRoles) {
      await ctx.db.insert("customRoles", {
        name: r.name,
        permissions: r.permissions,
        createdAt: new Date().toISOString(),
      });
    }
  }
}

export async function getEffectivePermissions(ctx: any, role: string, userPermissions?: string[]): Promise<string[]> {
  if (userPermissions && userPermissions.length > 0) {
    return userPermissions;
  }
  
  // Normalizar el rol para dar compatibilidad tanto a registros viejos (inglés) como nuevos
  const normRole = normalizeRole(role);

  // Intentar buscar primero por su nombre original en customRoles
  let customRole = await ctx.db
    .query("customRoles")
    .withIndex("by_name", (q: any) => q.eq("name", role))
    .first();

  // Si no se encuentra, intentar buscar por la forma normalizada capitalizada en español
  if (!customRole) {
    const capitalizedMap: Record<string, string> = {
      administrador: "Administrador",
      pastor: "Pastor",
      director: "Director",
      coordinador: "Coordinador",
      lider: "Líder",
      ayudante: "Ayudante",
    };
    const lookupName = capitalizedMap[normRole] || role;
    customRole = await ctx.db
      .query("customRoles")
      .withIndex("by_name", (q: any) => q.eq("name", lookupName))
      .first();
  }

  if (customRole) {
    return customRole.permissions;
  }

  // Fallback rígido por si ocurre un caso extremo
  if (normRole === "administrador" || normRole === "pastor") {
    return ["manage_users", "manage_settings", "write_teens", "delete_teens", "view_reports", "use_ai", "view_sensitive_pastoral"];
  }
  if (normRole === "director") {
    return ["write_teens", "view_reports", "use_ai", "view_sensitive_pastoral"];
  }
  if (normRole === "coordinador") {
    return ["write_teens", "view_reports", "view_sensitive_pastoral"];
  }
  if (normRole === "lider") {
    return ["write_teens"];
  }
  return [];
}

export const updateMe = mutation({
  args: {
    token: v.string(),
    name: v.optional(v.string()),
    password: v.optional(v.string()),
    avatar: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    phone: v.optional(v.string()),
    birthDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requester = await getUserFromToken(ctx, args.token);
    if (!requester) throw new Error("No autorizado");

    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.avatar !== undefined) patch.avatar = args.avatar;
    if (args.avatarStorageId !== undefined) patch.avatarStorageId = args.avatarStorageId;
    if (args.phone !== undefined) patch.phone = args.phone;
    if (args.birthDate !== undefined) patch.birthDate = args.birthDate;
    
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
    const canManageUsers = requester && (requester.role === "pastor" || requester.role === "admin" || (requester.permissions && requester.permissions.includes("manage_users")));
    if (!canManageUsers) {
      throw new Error("No autorizado");
    }

    const target = await ctx.db.get(args.userId);
    // Clean sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", q => q.eq("userId", args.userId))
      .collect();
    for (const s of sessions) {
      await ctx.db.delete(s._id);
    }

    await ctx.db.delete(args.userId);
    await logAudit(ctx, {
      token: args.token,
      action: "user.deleted",
      entityType: "user",
      entityId: String(args.userId),
      previousValue: target ? { email: target.email, name: target.name, role: target.role, isActive: target.isActive } : undefined,
      details: target ? `Usuario eliminado: ${target.email}` : "Usuario eliminado.",
    });
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
