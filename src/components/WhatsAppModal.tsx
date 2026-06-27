import { useState } from "react";
import type { Template } from "../lib/templates";
import { whatsAppUrl } from "../lib/templates";
import Modal from "./Modal";

interface WhatsAppModalProps {
  nombre: string;
  telefono: string;
  telefonoPadre: string;
  templates: Template[];
  onClose: () => void;
}

export default function WhatsAppModal({
  nombre,
  telefono,
  telefonoPadre,
  templates,
  onClose,
}: WhatsAppModalProps) {
  const [selected, setSelected] = useState<Template>(templates[0]);
  const [target, setTarget] = useState<"teen" | "parent">(
    telefono ? "teen" : "parent"
  );

  const phone = target === "teen" ? telefono : telefonoPadre;
  const url = phone ? whatsAppUrl(phone, selected.message) : "#";

  return (
    <Modal title={`Contactar a ${nombre}`} onClose={onClose}>
      <div className="p-5 space-y-4">
        {telefono && telefonoPadre && (
          <div className="flex gap-2">
            <button
              onClick={() => setTarget("teen")}
              className={`flex-1 text-xs font-semibold rounded-xl py-2 border transition ${
                target === "teen"
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-ink/60 border-ink/10"
              }`}
            >
              {telefono}
              <span className="block text-[10px] opacity-70 font-normal">
                Adolescente
              </span>
            </button>
            <button
              onClick={() => setTarget("parent")}
              className={`flex-1 text-xs font-semibold rounded-xl py-2 border transition ${
                target === "parent"
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-ink/60 border-ink/10"
              }`}
            >
              {telefonoPadre}
              <span className="block text-[10px] opacity-70 font-normal">
                Encargado
              </span>
            </button>
          </div>
        )}

        <div className="space-y-2">
          {templates.map((t) => (
            <button
              key={t.label}
              onClick={() => setSelected(t)}
              className={`w-full text-left p-3 rounded-xl border text-sm transition ${
                selected.label === t.label
                  ? "bg-teal-50 border-teal-200 text-teal-800"
                  : "bg-white border-ink/10 text-ink/70 hover:border-ink/20"
              }`}
            >
              <span className="font-semibold">
                {t.emoji} {t.label}
              </span>
            </button>
          ))}
        </div>

        <div className="bg-ink/5 rounded-xl p-3.5 text-sm text-ink/80 whitespace-pre-line leading-relaxed">
          {selected.message}
        </div>

        {phone ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 transition"
          >
            <span className="flex items-center justify-center gap-2">
              <WhatsAppIcon />
              Abrir WhatsApp
            </span>
          </a>
        ) : (
          <p className="text-xs text-ink/40 text-center">
            No hay número disponible
          </p>
        )}
      </div>
    </Modal>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
