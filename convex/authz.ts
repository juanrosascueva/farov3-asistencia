import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getUserFromToken } from "./authHelper";

export interface UserScope {
  role: Doc<"users">["role"];
  campusId?: string;
  ministryId?: string;
  groupId?: string;
}

export interface EffectiveAccess {
  user: Doc<"users">;
  scopes: UserScope[];
  isGlobal: boolean;
  accessibleCampusIds: string[];
  accessibleMinistryIds: string[];
  accessibleGroupIds: string[];
}

const ROLE_HIERARCHY: Record<string, number> = {
  admin: 120,
  pastor: 100,
  director: 80,
  coordinador: 60,
  leader: 40,
  helper: 20,
};

export async function getEffectiveAccess(
  ctx: QueryCtx,
  token: string | undefined | null
): Promise<EffectiveAccess | null> {
  const user = await getUserFromToken(ctx, token);
  if (!user) return null;

  const scopesDocs = await ctx.db
    .query("userScopes")
    .withIndex("by_userId", q => q.eq("userId", user._id))
    .collect();

  const scopes: UserScope[] = scopesDocs.map(s => ({
    role: s.role,
    campusId: s.campusId,
    ministryId: s.ministryId,
    groupId: s.groupId,
  }));

  // If no explicit scopes, use the user's base role as global
  if (scopes.length === 0) {
    const isGlobal = user.role === "admin" || user.role === "pastor" || user.role === "director";
    return {
      user,
      scopes: [],
      isGlobal,
      accessibleCampusIds: [],
      accessibleMinistryIds: [],
      accessibleGroupIds: [],
    };
  }

  const campusIds = [...new Set(scopes.filter(s => s.campusId).map(s => s.campusId!))];
  const ministryIds = [...new Set(scopes.filter(s => s.ministryId).map(s => s.ministryId!))];
  const groupIds = [...new Set(scopes.filter(s => s.groupId).map(s => s.groupId!))];

  const isGlobal = user.role === "admin" || user.role === "pastor" || user.role === "director";

  return {
    user,
    scopes,
    isGlobal,
    accessibleCampusIds: campusIds,
    accessibleMinistryIds: ministryIds,
    accessibleGroupIds: groupIds,
  };
}

export async function requireAccess(
  ctx: QueryCtx,
  token: string | undefined | null,
  minRole: Doc<"users">["role"]
): Promise<EffectiveAccess> {
  const access = await getEffectiveAccess(ctx, token);
  if (!access) throw new Error("No autenticado");

  let userLevel = ROLE_HIERARCHY[access.user.role] || 0;
  if (userLevel === 0) {
    // Si no está en la jerarquía fija, buscar en customRoles
    const customRole = await ctx.db
      .query("customRoles")
      .withIndex("by_name", (q: any) => q.eq("name", access.user.role))
      .first();
    if (customRole) {
      userLevel = 20; // Nivel helper por defecto para roles personalizados
    }
  }

  const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
  if (userLevel < requiredLevel) {
    throw new Error(`Se requiere rol "${minRole}" o superior. Tu rol: ${access.user.role}`);
  }
  return access;
}

export function canAccessTeen(
  access: EffectiveAccess,
  teen: { campusId?: any; ministryId?: any; groupId?: any }
): boolean {
  if (access.isGlobal) return true;

  if (teen.groupId && access.accessibleGroupIds.length > 0) {
    return access.accessibleGroupIds.includes(teen.groupId.toString());
  }
  if (teen.ministryId && access.accessibleMinistryIds.length > 0) {
    return access.accessibleMinistryIds.includes(teen.ministryId.toString());
  }
  if (teen.campusId && access.accessibleCampusIds.length > 0) {
    return access.accessibleCampusIds.includes(teen.campusId.toString());
  }

  return false;
}

export function filterTeensByScope<T extends { campusId?: any; ministryId?: any; groupId?: any }>(
  access: EffectiveAccess,
  teens: T[]
): T[] {
  if (access.isGlobal) return teens;
  return teens.filter(t => canAccessTeen(access, t as any));
}
