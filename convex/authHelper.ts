import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

function randomHex(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" } as any,
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSalt(): string {
  return randomHex(16);
}

export function generateToken(): string {
  return "sess_" + randomHex(24) + "_" + Date.now().toString(36);
}

export function isSessionExpired(expiresAt: string, now = Date.now()): boolean {
  return Date.parse(expiresAt) < now;
}

export async function getSession(
  ctx: QueryCtx | MutationCtx,
  token: string | undefined | null
) {
  if (!token) return null;
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", q => q.eq("token", token))
    .first();
  if (!session) return null;
  if (isSessionExpired(session.expiresAt)) return null;
  return session;
}

export async function getUserFromToken(
  ctx: QueryCtx,
  token: string | undefined | null
): Promise<Doc<"users"> | null> {
  const session = await getSession(ctx, token);
  if (!session) return null;
  const user = await ctx.db.get(session.userId);
  return user ?? null;
}

export async function cleanExpiredSession(
  ctx: MutationCtx,
  token: string
): Promise<void> {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", q => q.eq("token", token))
    .first();
  if (session && isSessionExpired(session.expiresAt)) {
    await ctx.db.delete(session._id);
  }
}

export async function assertAuth(
  ctx: QueryCtx,
  token: string | undefined | null
): Promise<Doc<"users">> {
  const user = await getUserFromToken(ctx, token);
  if (!user) throw new Error("No autenticado");
  if (!user.isActive) throw new Error("Usuario desactivado");
  return user;
}

export async function assertRole(
  ctx: QueryCtx,
  token: string | undefined | null,
  allowedRoles: Doc<"users">["role"][]
): Promise<Doc<"users">> {
  const user = await assertAuth(ctx, token);
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`Rol ${user.role} no autorizado. Requerido: ${allowedRoles.join(", ")}`);
  }
  return user;
}

export const SESSION_TTL_DAYS = 30;
