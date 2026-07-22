export function isAuthenticationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("No autenticado") || message.includes("Usuario desactivado");
}
