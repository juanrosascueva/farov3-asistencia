import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import Modal from "./Modal";

interface PublicRegistrationLinkModalProps {
  token: string | null;
  scope: {
    campusId?: string;
    ministryId?: string;
    groupId?: string;
    label: string;
  };
  onClose: () => void;
}

export default function PublicRegistrationLinkModal({ token, scope, onClose }: PublicRegistrationLinkModalProps) {
  const createLink = useMutation(api.teens.createPublicRegistrationLink);
  const [publicToken, setPublicToken] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const publicUrl = useMemo(() => {
    if (!publicToken) return "";
    return `${window.location.origin}/registro-adolescente?t=${encodeURIComponent(publicToken)}`;
  }, [publicToken]);

  useEffect(() => {
    if (!publicUrl) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(publicUrl, { width: 220, margin: 2, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [publicUrl]);

  const handleCreate = async () => {
    if (!token || creating) return;
    setCreating(true);
    setError("");
    try {
      const result = await createLink({
        token,
        campusId: scope.campusId as any,
        ministryId: scope.ministryId as any,
        groupId: scope.groupId as any,
      });
      setPublicToken(result.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el enlace.");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard?.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Modal title="Registro por link o QR" onClose={onClose} panelClassName="sm:max-w-lg">
      <div className="p-4 sm:p-5 space-y-4">
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Este enlace permite registrar visitantes sin iniciar sesión. La ficha queda incompleta y asociada a: <strong>{scope.label}</strong>.
        </div>

        {error && <div className="rounded-xl border border-coral-100 bg-coral-50 px-3 py-2 text-sm font-medium text-coral-700">{error}</div>}

        {!publicToken ? (
          <button onClick={handleCreate} disabled={!token || creating} className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
            {creating ? "Creando enlace..." : "Crear enlace público"}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center rounded-2xl bg-white p-4 border border-ink/5">
              {qrDataUrl ? <img src={qrDataUrl} alt="QR de registro público" className="h-[220px] w-[220px]" /> : <div className="h-[220px] w-[220px] bg-ink/5 rounded-xl animate-pulse" />}
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-ink/45">Enlace público</label>
              <div className="mt-1 flex gap-2">
                <input readOnly value={publicUrl} className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-card px-3 py-2 text-xs text-ink/70" />
                <button onClick={copyLink} className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white">
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>

            <p className="text-xs text-ink/45">
              Puedes imprimir este QR o enviarlo por WhatsApp. No lo publiques fuera del grupo donde quieras recibir registros.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
