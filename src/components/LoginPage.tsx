import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { login, register, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupName, setSetupName] = useState("");
  const [setupError, setSetupError] = useState("");
  const [setupDone, setSetupDone] = useState(false);

  // Estados de auto-registro / solicitud de acceso
  const [showRequestAccess, setShowRequestAccess] = useState(false);
  const [requestEmail, setRequestEmail] = useState("");
  const [requestPassword, setRequestPassword] = useState("");
  const [requestName, setRequestName] = useState("");
  const [requestRole, setRequestRole] = useState<"pastor" | "director" | "coordinador" | "leader" | "helper">("leader");
  const [requestError, setRequestError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState(false);

  const setupFirstUser = useMutation(api.users.setupFirstUser);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestEmail.trim() || !requestPassword.trim() || !requestName.trim()) return;
    setSubmitting(true);
    setRequestError("");
    try {
      await register(requestEmail.trim(), requestPassword, requestName.trim(), requestRole);
      setRequestSuccess(true);
    } catch (err: any) {
      setRequestError(err.message || "Error al enviar la solicitud");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupEmail.trim() || !setupPassword.trim() || !setupName.trim()) return;
    setSubmitting(true);
    setSetupError("");
    try {
      await setupFirstUser({
        email: setupEmail.trim(),
        password: setupPassword,
        name: setupName.trim(),
      });
      setSetupDone(true);
    } catch (err: any) {
      setSetupError(err.message || "Error al configurar");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-ink/5 animate-pulse mb-3" />
          <p className="text-sm text-ink/50">Cargando...</p>
        </div>
      </div>
    );
  }

  if (requestSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="bg-card rounded-card shadow-soft p-8 max-w-sm w-full mx-4 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-teal-100 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="font-display text-xl font-bold mb-2">¡Solicitud enviada!</h1>
          <p className="text-sm text-ink/60 mb-6 leading-relaxed">
            Tu solicitud de acceso ha sido registrada. Tu cuenta se encuentra en espera de aprobación por el Pastor.
          </p>
          <button
            onClick={() => { setRequestSuccess(false); setShowRequestAccess(false); setRequestEmail(""); setRequestPassword(""); setRequestName(""); }}
            className="w-full bg-ink text-white rounded-xl py-2.5 text-sm font-semibold pressable"
          >
            Volver a inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  if (setupDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="bg-card rounded-card shadow-soft p-8 max-w-sm w-full mx-4 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-teal-100 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="font-display text-xl font-bold mb-2">¡Configuración lista!</h1>
          <p className="text-sm text-ink/60 mb-4">
            El usuario pastor fue creado. Ahora puedes iniciar sesión.
          </p>
          <button
            onClick={() => { setShowSetup(false); setSetupDone(false); }}
            className="bg-ink text-white rounded-xl py-2.5 px-6 text-sm font-semibold"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="bg-card rounded-card shadow-soft p-8 max-w-sm w-full mx-4">
        <div className="text-center mb-6">
          <img src="/logo.svg" alt="Cristo Vive" className="w-14 h-14 mx-auto mb-3" />
          <h1 className="font-display text-xl font-bold">Congregación Cristo Vive</h1>
          <p className="text-sm text-ink/50 mt-1">Control de Asistencia Pastoral</p>
        </div>

        {showRequestAccess ? (
          <form onSubmit={handleRequestAccess} className="space-y-4">
            <p className="text-sm font-semibold text-center text-teal-700">Solicitud de Acceso / Registro</p>
            <p className="text-xs text-ink/40 text-center">Registra tus datos. Tu cuenta estará inactiva hasta que sea aprobada por el Pastor.</p>
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">Nombre completo</label>
              <input
                type="text"
                value={requestName}
                onChange={e => setRequestName(e.target.value)}
                placeholder="Ej: Juan Rosas"
                required
                className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">Correo electrónico</label>
              <input
                type="email"
                value={requestEmail}
                onChange={e => setRequestEmail(e.target.value)}
                placeholder="correo@iglesia.com"
                required
                className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">Contraseña</label>
              <input
                type="password"
                value={requestPassword}
                onChange={e => setRequestPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">Rol solicitado</label>
              <select
                value={requestRole}
                onChange={e => setRequestRole(e.target.value as any)}
                className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
              >
                <option value="leader">Líder</option>
                <option value="helper">Ayudante</option>
                <option value="coordinador">Coordinador</option>
                <option value="director">Director</option>
              </select>
            </div>
            {requestError && (
              <p className="text-xs text-coral-600 bg-coral-50 rounded-lg px-3 py-2">{requestError}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-ink text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 pressable"
            >
              {submitting ? "Enviando solicitud..." : "Enviar solicitud"}
            </button>
            <button
              type="button"
              onClick={() => { setShowRequestAccess(false); setRequestError(""); }}
              className="w-full text-xs text-ink/40 hover:text-ink/60 text-center"
            >
              Volver a inicio de sesión
            </button>
          </form>
        ) : !showSetup ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="correo@iglesia.com"
                className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            {error && (
              <p className="text-xs text-coral-600 bg-coral-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-ink text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 pressable"
            >
              {submitting ? "Ingresando..." : "Iniciar sesión"}
            </button>
            
            <div className="space-y-2 pt-2 text-center">
              <button
                type="button"
                onClick={() => { setShowRequestAccess(true); setError(""); }}
                className="w-full text-xs text-teal-700 font-semibold hover:text-teal-600"
              >
                ¿No tienes cuenta? Solicitar acceso
              </button>
              <button
                type="button"
                onClick={() => { setShowSetup(true); setError(""); }}
                className="w-full text-[11px] text-ink/30 hover:text-ink/50"
              >
                ¿Primer acceso? Configurar pastor inicial
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSetup} className="space-y-4">
            <p className="text-sm font-semibold">Configurar primer usuario (Pastor)</p>
            <p className="text-xs text-ink/40">Esto solo funciona si no hay usuarios registrados.</p>
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">Nombre</label>
              <input
                type="text"
                value={setupName}
                onChange={e => setSetupName(e.target.value)}
                placeholder="Ej: Juan Rosas"
                className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">Correo</label>
              <input
                type="email"
                value={setupEmail}
                onChange={e => setSetupEmail(e.target.value)}
                placeholder="pastor@iglesia.com"
                className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">Contraseña</label>
              <input
                type="password"
                value={setupPassword}
                onChange={e => setSetupPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            {setupError && (
              <p className="text-xs text-coral-600 bg-coral-50 rounded-lg px-3 py-2">{setupError}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-ink text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 pressable"
            >
              {submitting ? "Configurando..." : "Configurar"}
            </button>
            <button
              type="button"
              onClick={() => setShowSetup(false)}
              className="w-full text-xs text-ink/40 hover:text-ink/60 text-center"
            >
              Volver a inicio de sesión
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
