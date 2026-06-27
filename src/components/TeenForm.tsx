import { useState, FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
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

  const createTeen = useMutation(api.teens.create);
  const updateTeen = useMutation(api.teens.update);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (teen) {
      await updateTeen({ id: teen._id, ...form });
    } else {
      await createTeen({ ...form });
    }
    onSuccess();
  };

  const set = (key: string) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <Modal
      title={teen ? "Editar adolescente" : "Agregar adolescente"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
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
        <div className="grid grid-cols-2 gap-3">
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
