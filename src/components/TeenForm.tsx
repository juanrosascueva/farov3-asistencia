import { useState, FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useAuth } from "../hooks/useAuth";
import Modal from "./Modal";

const empty = {
  nombre: "",
  apellido: "",
  nacimiento: "",
  telefono: "",
  telefonoPadre: "",
  gustos: "",
  notas: "",
  foto: "",
};

interface TeenFormProps {
  teen?: Doc<"teens">;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TeenForm({ teen, onClose, onSuccess }: TeenFormProps) {
  const { token } = useAuth();
  const [form, setForm] = useState(
    teen
      ? {
          nombre: teen.nombre,
          apellido: teen.apellido,
          nacimiento: teen.nacimiento,
          telefono: teen.telefono,
          telefonoPadre: teen.telefonoPadre,
          gustos: teen.gustos,
          notas: teen.notas,
          foto: teen.foto,
        }
      : { ...empty }
  );

  const [campusId, setCampusId] = useState<string>(teen?.campusId || "");
  const [ministryId, setMinistryId] = useState<string>(teen?.ministryId || "");
  const [groupId, setGroupId] = useState<string>(teen?.groupId || "");

  const campuses = useQuery(api.campus.list, token ? { token } : "skip");
  const ministries = useQuery(
    api.ministry.list,
    token && campusId ? { token, campusId: campusId as any } : "skip"
  );
  const groups = useQuery(
    api.group.list,
    token && ministryId ? { token, ministryId: ministryId as any } : "skip"
  );

  const createTeen = useMutation(api.teens.create);
  const updateTeen = useMutation(api.teens.update);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const scopeFields = campusId ? {
      campusId: campusId as any,
      ministryId: ministryId ? (ministryId as any) : undefined,
      groupId: groupId ? (groupId as any) : undefined,
    } : {};
    if (teen) {
      await updateTeen({ id: teen._id, ...form, ...scopeFields });
    } else {
      await createTeen({ ...form, ...scopeFields });
    }
    onSuccess();
  };

  const set = (key: string) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <Modal
      title={teen ? "Editar adolescente" : "Agregar adolescente"}
      onClose={onClose}
      panelClassName="sm:max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="Nombre"
            value={form.nombre}
            onChange={set("nombre")}
            required
          />
          <Field
            label="Apellido"
            value={form.apellido}
            onChange={set("apellido")}
            required
          />
        </div>
        <Field
          label="Fecha de nacimiento"
          type="date"
          value={form.nacimiento}
          onChange={set("nacimiento")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="Teléfono del adolescente"
            type="tel"
            value={form.telefono}
            onChange={set("telefono")}
          />
          <Field
            label="Teléfono del encargado"
            type="tel"
            value={form.telefonoPadre}
            onChange={set("telefonoPadre")}
          />
        </div>
        <Field
          label="Gustos e intereses"
          value={form.gustos}
          onChange={set("gustos")}
          placeholder="Ej: música, deportes, dibujo"
        />
        <TextArea
          label="Notas pastorales"
          value={form.notas}
          onChange={set("notas")}
        />

        <div className="border-t border-ink/5 pt-4">
          <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-3">
            Asignación
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">Sede</label>
              <select
                value={campusId}
                onChange={(e) => { setCampusId(e.target.value); setMinistryId(""); setGroupId(""); }}
                className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
              >
                <option value="">Sin sede</option>
                {(campuses || []).map((c: any) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            {campusId && (
              <div>
                <label className="text-xs font-semibold text-ink/50 mb-1 block">Ministerio</label>
                <select
                  value={ministryId}
                  onChange={(e) => { setMinistryId(e.target.value); setGroupId(""); }}
                  className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
                >
                  <option value="">Sin ministerio</option>
                  {(ministries || []).map((m: any) => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}
            {ministryId && (
              <div>
                <label className="text-xs font-semibold text-ink/50 mb-1 block">Grupo</label>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
                >
                  <option value="">Sin grupo</option>
                  {(groups || []).map((g: any) => (
                    <option key={g._id} value={g._id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-ink text-white rounded-xl py-3 text-sm font-semibold mt-2"
        >
          {teen ? "Guardar cambios" : "Agregar adolescente"}
        </button>
      </form>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink/50 mb-1 block">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink/50 mb-1 block">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm resize-none"
      />
    </div>
  );
}
