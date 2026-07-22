export const emailError = (value) => {
  const email = value.trim();
  if (!email) return "Ingresa tu correo electrónico.";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Ingresa un correo electrónico válido.";
};

export const passwordError = (value) => {
  if (!value) return "Ingresa una contraseña.";
  return value.length >= 8 ? "" : "La contraseña debe tener al menos 8 caracteres.";
};
