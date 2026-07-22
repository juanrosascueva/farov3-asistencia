import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../hooks/useAuth";
import {
  AuthIllustration,
  AuthInput,
  AuthLayout,
  ChurchLogo,
  FaithMotto,
  PasswordInput,
  PrimaryButton,
  SecondaryButton,
  SocialLoginButton,
  StatusMessage,
} from "./auth/AuthComponents";
import { emailError, passwordError } from "./auth/validation";
import "./auth/auth.css";

type View = "login" | "register" | "success";

function friendlyAuthError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : "";
  if (raw.includes("Credenciales inválidas")) return "Correo o contraseña incorrectos.";
  if (raw.includes("pendiente de aprobación")) return "Tu cuenta todavía está pendiente de aprobación por el pastor.";
  if (raw.includes("email ya está registrado")) return "Ya existe una cuenta con este correo electrónico.";
  if (raw.includes("Ya existe un usuario")) return "La congregación ya tiene una cuenta inicial. Crea una solicitud de acceso.";
  return fallback;
}

export default function LoginPage() {
  const { login, register, loading } = useAuth();
  const setupFirstUser = useMutation(api.users.setupFirstUser);
  const hasUsers = useQuery(api.users.hasAnyUser);
  const [view, setView] = useState<View>("login");
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);

  const isRegister = view === "register";
  const currentEmailError = emailError(email);
  const currentPasswordError = passwordError(password);
  const confirmError = !confirmPassword
    ? "Confirma tu contraseña."
    : confirmPassword !== password
      ? "Las contraseñas no coinciden."
      : "";
  const loginValid = !currentEmailError && Boolean(password);
  const registerValid = loginValid && !currentPasswordError && !confirmError;

  const resetView = (nextView: View) => {
    setView(nextView);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setTouched({});
    setMessage(null);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched({ email: true, password: true });
    if (!loginValid) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await login(email, password);
    } catch (error) {
      setMessage({
        type: "error",
        text: friendlyAuthError(error, "No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched({ email: true, password: true, confirmPassword: true });
    if (!registerValid) return;
    setSubmitting(true);
    setMessage(null);
    const generatedName = email.split("@")[0].replace(/[._-]+/g, " ").trim() || "Nuevo miembro";
    try {
      if (hasUsers === false) {
        await setupFirstUser({ email: email.trim(), password, name: generatedName });
      } else {
        await register(email, password, generatedName, "helper");
      }
      setView("success");
    } catch (error) {
      setMessage({
        type: "error",
        text: friendlyAuthError(error, "No pudimos crear tu cuenta. Inténtalo de nuevo."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout variant="login">
        <div className="auth-loading" role="status" aria-live="polite">
          <span className="auth-spinner auth-spinner--large" aria-hidden="true" />
          <p>Preparando tu espacio…</p>
        </div>
      </AuthLayout>
    );
  }

  if (view === "success") {
    return (
      <AuthLayout variant="register">
        <main className="auth-success" aria-labelledby="success-title">
          <span className="auth-success__icon" aria-hidden="true"><CheckCircle2 /></span>
          <h1 id="success-title">¡Cuenta creada!</h1>
          <p>
            {hasUsers === false
              ? "Tu cuenta de pastor está lista. Ya puedes iniciar sesión."
              : "Recibimos tu solicitud. El pastor debe aprobarla antes de que puedas ingresar."}
          </p>
          <PrimaryButton type="button" onClick={() => resetView("login")}>Ir a iniciar sesión</PrimaryButton>
        </main>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout variant={isRegister ? "register" : "login"} onBack={isRegister ? () => resetView("login") : undefined}>
      {!isRegister && (
        <>
          <header className="auth-brand auth-brand--top">
            <ChurchLogo size="small" />
            <span>Congregación<br /><strong>Cristo Vive</strong></span>
          </header>
          <AuthIllustration />
        </>
      )}

      <main className={`auth-content ${isRegister ? "auth-content--register" : ""}`}>
        {isRegister && <ChurchLogo size="large" circular />}
        <div className="auth-heading">
          <h1>{isRegister ? "Crea tu cuenta" : "Bienvenido"}</h1>
          <span className="auth-heading__line" aria-hidden="true" />
          <p>{isRegister ? "Únete a nuestra comunidad" : <>Nos alegra tenerte <strong>de vuelta</strong></>}</p>
        </div>

        <form className="auth-form" onSubmit={isRegister ? handleRegister : handleLogin} noValidate>
          <AuthInput
            id={isRegister ? "register-email" : "login-email"}
            label="Correo electrónico"
            type="email"
            autoComplete={isRegister ? "email" : "username"}
            value={email}
            onChange={(event) => { setEmail(event.target.value); setMessage(null); }}
            onBlur={() => setTouched((state) => ({ ...state, email: true }))}
            error={touched.email ? currentEmailError : ""}
          />
          <PasswordInput
            id={isRegister ? "register-password" : "login-password"}
            label="Contraseña"
            autoComplete={isRegister ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => { setPassword(event.target.value); setMessage(null); }}
            onBlur={() => setTouched((state) => ({ ...state, password: true }))}
            error={touched.password ? (isRegister ? currentPasswordError : (!password ? "Ingresa tu contraseña." : "")) : ""}
          />
          {isRegister && (
            <PasswordInput
              id="confirm-password"
              label="Confirmar contraseña"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => { setConfirmPassword(event.target.value); setMessage(null); }}
              onBlur={() => setTouched((state) => ({ ...state, confirmPassword: true }))}
              error={touched.confirmPassword ? confirmError : ""}
            />
          )}

          {!isRegister && (
            <button
              className="auth-text-button"
              type="button"
              onClick={() => setMessage({ type: "info", text: "Pide al administrador de tu congregación que restablezca tu contraseña." })}
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {message && <StatusMessage type={message.type}>{message.text}</StatusMessage>}

          <PrimaryButton type="submit" loading={submitting} disabled={submitting || (isRegister ? !registerValid : !loginValid)}>
            {isRegister ? "Crear cuenta" : "Iniciar sesión"}
          </PrimaryButton>

          {isRegister ? (
            <>
              <div className="auth-divider"><span>o</span></div>
              <SocialLoginButton
                type="button"
                onClick={() => setMessage({ type: "info", text: "El acceso con Google estará disponible próximamente. Usa tu correo por ahora." })}
              >
                Continuar con Google
              </SocialLoginButton>
            </>
          ) : (
            <SecondaryButton type="button" onClick={() => resetView("register")}>Crear cuenta</SecondaryButton>
          )}
        </form>
      </main>

      {isRegister ? (
        <footer className="auth-brand auth-brand--bottom">
          <ChurchLogo size="small" />
          <span>Congregación<br /><strong>Cristo Vive</strong></span>
        </footer>
      ) : (
        <footer><FaithMotto /></footer>
      )}
    </AuthLayout>
  );
}
