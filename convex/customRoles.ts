import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserFromToken } from "./authHelper";

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) return [];
    return await ctx.db.query("customRoles").collect();
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "admin" && user.role !== "pastor")) {
      throw new Error("No autorizado. Solo administradores o pastores pueden crear roles personalizados.");
    }
    const cleanName = args.name.trim();
    if (!cleanName) throw new Error("El nombre del rol es requerido.");

    // Validar nombre duplicado
    const existing = await ctx.db
      .query("customRoles")
      .withIndex("by_name", (q) => q.eq("name", cleanName))
      .first();
    if (existing) throw new Error("Ya existe un rol con ese nombre.");

    return await ctx.db.insert("customRoles", {
      name: cleanName,
      permissions: args.permissions,
      createdAt: new Date().toISOString(),
    });
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("customRoles"),
    name: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "admin" && user.role !== "pastor")) {
      throw new Error("No autorizado. Solo administradores o pastores pueden editar roles personalizados.");
    }
    const cleanName = args.name.trim();
    if (!cleanName) throw new Error("El nombre del rol es requerido.");

    const roleDoc = await ctx.db.get(args.id);
    if (!roleDoc) throw new Error("Rol no encontrado.");

    const isSystemRole = roleDoc.name === "Administrador" || roleDoc.name === "Pastor";
    if (isSystemRole && cleanName !== roleDoc.name) {
      throw new Error("No se permite cambiar el nombre del rol del sistema (" + roleDoc.name + ").");
    }

    // Validar duplicado excluyendo sí mismo
    const existing = await ctx.db
      .query("customRoles")
      .withIndex("by_name", (q) => q.eq("name", cleanName))
      .first();
    if (existing && existing._id !== args.id) {
      throw new Error("Ya existe otro rol con ese nombre.");
    }

    await ctx.db.patch(args.id, {
      name: cleanName,
      permissions: args.permissions,
    });
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("customRoles") },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "admin" && user.role !== "pastor")) {
      throw new Error("No autorizado. Solo administradores o pastores pueden eliminar roles personalizados.");
    }
    
    const roleDoc = await ctx.db.get(args.id);
    if (!roleDoc) return;

    if (roleDoc.name === "Administrador" || roleDoc.name === "Pastor") {
      throw new Error("No se permite eliminar el rol del sistema (" + roleDoc.name + ").");
    }
    
    await ctx.db.delete(args.id);
  },
});
