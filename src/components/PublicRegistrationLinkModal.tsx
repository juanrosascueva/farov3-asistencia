import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Modal from "./Modal";
import { useAuth } from "../hooks/useAuth";

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
  const { user } = useAuth();
  const [shortCode, setShortCode] = useState("");
  const [scopeMode, setScopeMode] = useState<"fixed" | "general">("fixed");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedMinistryId, setSelectedMinistryId] = useState(scope.ministryId || "");
  const ministries = useQuery(
    api.ministry.list,
    token && scope.campusId ? { token, campusId: scope.campusId as any } : "skip"
  ) ?? [];

  const publicUrl = useMemo(() => {
    if (!shortCode) return "";
    return `${window.location.origin}/r/${shortCode}`;
  }, [shortCode]);
  const canCreateGeneral = ["admin", "administrador", "pastor", "director"].includes((user?.role || "").toLowerCase());
  const fixedMinistryId = selectedMinistryId || scope.ministryId;
  const canCreateFixed = Boolean(scope.campusId && fixedMinistryId);

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
        scopeMode,
        campusId: scopeMode === "fixed" ? scope.campusId as any : undefined,
        ministryId: scopeMode === "fixed" ? fixedMinistryId as any : undefined,
        groupId: scopeMode === "fixed" && fixedMinistryId === scope.ministryId ? scope.groupId as any : undefined,
      });
      setShortCode(result.shortCode);
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
        {!shortCode && (
          <>
            <div className="flex rounded-xl bg-ink/[0.03] p-1 gap-1" role="tablist" aria-label="Tipo de enlace">
              <button type="button" role="tab" aria-selected={scopeMode === "fixed"} onClick={() => setScopeMode("fixed")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${scopeMode === "fixed" ? "bg-card shadow-soft text-ink" : "text-ink/50"}`}>QR dirigido</button>
              {canCreateGeneral && <button type="button" role="tab" aria-selected={scopeMode === "general"} onClick={() => setScopeMode("general")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${scopeMode === "general" ? "bg-card shadow-soft text-ink" : "text-ink/50"}`}>QR general</button>}
            </div>
            <div className="rounded-xl border border-warning-100 bg-warning-50 px-3 py-2 text-sm text-warning-800">
              {scopeMode === "fixed" ? <>Este QR registra visitantes en <strong>{scope.label}</strong>. Selecciona el ministerio que recibirá los registros.</> : <>Este QR permite elegir sede y ministerio. Úsalo solo en actividades abiertas de la iglesia.</>}
            </div>
            {scopeMode === "fixed" && scope.campusId && <label className="block"><span className="mb-1.5 block text-xs font-bold text-ink/55">Ministerio de destino</span><select value={fixedMinistryId || ""} onChange={(event) => setSelectedMinistryId(event.target.value)} className="ui-input w-full"><option value="">Selecciona un ministerio</option>{ministries.map((ministry: any) => <option key={ministry._id} value={ministry._id}>{ministry.name}</option>)}</select>{scope.groupId && fixedMinistryId !== scope.ministryId && <p className="mt-1 text-xs text-ink/50">El grupo actual no se aplicará porque elegiste otro ministerio.</p>}</label>}
            {scopeMode === "fixed" && !scope.campusId && <p className="text-xs text-danger-700">Selecciona una sede en el selector principal para crear un QR dirigido.</p>}
            {scopeMode === "fixed" && scope.campusId && !fixedMinistryId && <p className="text-xs text-danger-700">Selecciona el ministerio de destino para crear el QR dirigido.</p>}
          </>
        )}

        {error && <div className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm font-medium text-danger-700">{error}</div>}

        {!shortCode ? (
          <button onClick={handleCreate} disabled={!token || creating || (scopeMode === "fixed" && !canCreateFixed)} className="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
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
                <button onClick={copyLink} className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white">
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
