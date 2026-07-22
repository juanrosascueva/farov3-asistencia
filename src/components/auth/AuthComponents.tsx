import { useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Heart, Info, LockKeyhole, Mail } from "lucide-react";

export function ChurchLogo({ size = "small", circular = false }: { size?: "small" | "large"; circular?: boolean }) {
  return (
    <span className={`church-logo church-logo--${size}${circular ? " church-logo--circular" : ""}`} aria-hidden="true">
      <img src="/logo.svg" alt="" />
    </span>
  );
}

export function DecorativeBackground({ variant }: { variant: "login" | "register" }) {
  return (
    <div className={`auth-decoration auth-decoration--${variant}`} aria-hidden="true">
      <span className="auth-decoration__orb" />
      <span className="auth-decoration__wave" />
      <span className="auth-decoration__dot-grid" />
    </div>
  );
}

export function AuthLayout({ children, variant, onBack }: { children: ReactNode; variant: "login" | "register"; onBack?: () => void }) {
  return (
    <div className="auth-page">
      <section className={`auth-shell auth-shell--${variant}`} aria-label={variant === "login" ? "Inicio de sesión" : "Creación de cuenta"}>
        <DecorativeBackground variant={variant} />
        {onBack && (
          <button className="auth-back" type="button" onClick={onBack} aria-label="Volver al inicio de sesión">
            <ArrowLeft aria-hidden="true" />
          </button>
        )}
        {children}
      </section>
    </div>
  );
}

export function AuthIllustration() {
  return (
    <figure className="auth-illustration">
      <img src="/auth/community-hero.png" alt="Comunidad cristiana joven reunida frente a una iglesia" />
    </figure>
  );
}

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string };

export function AuthInput({ id, label, error, type = "text", ...props }: AuthInputProps) {
  const describedBy = error ? `${id}-error` : undefined;
  return (
    <div className={`auth-field${error ? " auth-field--error" : ""}`}>
      <label className="auth-sr-only" htmlFor={id}>{label}</label>
      <span className="auth-field__icon" aria-hidden="true">{type === "email" ? <Mail /> : <LockKeyhole />}</span>
      <input id={id} type={type} placeholder={label} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
      {error && <p className="auth-field__error" id={describedBy}><AlertCircle aria-hidden="true" />{error}</p>}
    </div>
  );
}

export function PasswordInput(props: Omit<AuthInputProps, "type">) {
  const [visible, setVisible] = useState(false);
  const { id, label, error, ...inputProps } = props;
  const describedBy = error ? `${id}-error` : undefined;
  return (
    <div className={`auth-field auth-field--password${error ? " auth-field--error" : ""}`}>
      <label className="auth-sr-only" htmlFor={id}>{label}</label>
      <span className="auth-field__icon" aria-hidden="true"><LockKeyhole /></span>
      <input id={id} type={visible ? "text" : "password"} placeholder={label} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...inputProps} />
      <button className="auth-field__toggle" type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} aria-pressed={visible}>
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
      {error && <p className="auth-field__error" id={describedBy}><AlertCircle aria-hidden="true" />{error}</p>}
    </div>
  );
}

type AuthButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean };

export function PrimaryButton({ children, loading, ...props }: AuthButtonProps) {
  return <button className="auth-button auth-button--primary" {...props}>{loading && <span className="auth-spinner" aria-hidden="true" />}<span>{loading ? "Procesando…" : children}</span></button>;
}

export function SecondaryButton(props: AuthButtonProps) {
  return <button className="auth-button auth-button--secondary" {...props} />;
}

export function SocialLoginButton({ children, ...props }: AuthButtonProps) {
  return <button className="auth-button auth-button--social" {...props}><img src="/auth/google.svg" alt="" aria-hidden="true" />{children}</button>;
}

export function StatusMessage({ type, children }: { type: "error" | "info" | "success"; children: ReactNode }) {
  const Icon = type === "error" ? AlertCircle : type === "success" ? CheckCircle2 : Info;
  return <div className={`auth-status auth-status--${type}`} role={type === "error" ? "alert" : "status"}><Icon aria-hidden="true" />{children}</div>;
}

export function FaithMotto() {
  return <span className="auth-motto"><Heart aria-hidden="true" />Creciendo juntos en fe, esperanza y amor.</span>;
}
