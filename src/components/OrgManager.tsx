import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../hooks/useAuth";

export default function OrgManager() {
  const { user, token } = useAuth();
  if (!user || (user.role !== "pastor" && user.role !== "director")) return null;

  return (
    <div className="bg-card rounded-card shadow-soft p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
          Administración
        </p>
        <p className="text-sm text-ink/60 mt-0.5">
          Gestiona la estructura organizacional de la iglesia.
        </p>
      </div>

      <UserManager />
      <CampusManager />
    </div>
  );
}

function UserManager() {
  const { token } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("leader");

  const users = useQuery(api.users.listUsers, token ? { token } : "skip");
  const register = useMutation(api.users.register);

  const handleCreate = async () => {
    if (!email.trim() || !password.trim() || !name.trim()) return;
    try {
      await register({ email: email.trim(), password, name: name.trim(), role: role as any, token: token ?? undefined });
      setEmail("");
      setPassword("");
      setName("");
      setRole("leader");
      setShowForm(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-3 pt-3 border-t border-ink/5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">
          Usuarios ({users?.length || 0})
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs font-semibold text-teal-700 hover:text-teal-600 transition flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          {showForm ? "Cancelar" : "Nuevo usuario"}
        </button>
      </div>

      {showForm && (
        <div className="bg-ink/[0.02] border border-ink/10 rounded-xl p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-ink/50 mb-1 block">Nombre</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Nombre del líder"
              className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/50 mb-1 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="correo@iglesia.com"
              className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/50 mb-1 block">Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/50 mb-1 block">Rol</label>
            <select value={role} onChange={e => setRole(e.target.value as any)}
              className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2 text-sm">
              <option value="leader">Líder</option>
              <option value="helper">Ayudante</option>
              <option value="coordinador">Coordinador</option>
              <option value="director">Director</option>
              <option value="pastor">Pastor</option>
            </select>
          </div>
          <button onClick={handleCreate}
            className="w-full bg-ink text-white rounded-xl py-2 text-sm font-semibold">
            Crear usuario
          </button>
        </div>
      )}

      <div className="space-y-1">
        {(users || []).map((u: any) => (
          <div key={u._id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-ink/[0.02] border border-ink/5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${u.isActive ? "bg-green-500" : "bg-red-400"}`} />
            <span className="flex-1 text-sm font-medium min-w-0 truncate">{u.name}</span>
            <span className="text-[10px] capitalize text-ink/40">{u.role}</span>
          </div>
        ))}
        {(!users || users.length === 0) && (
          <p className="text-xs text-ink/30 py-2">No hay usuarios registrados</p>
        )}
      </div>
    </div>
  );
}

function CampusManager() {
  const { token } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const campuses = useQuery(api.campus.list, token ? { token } : "skip");
  const createCampus = useMutation(api.campus.create);
  const updateCampus = useMutation(api.campus.update);
  const deleteCampus = useMutation(api.campus.remove);

  const [selectedCampus, setSelectedCampus] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createCampus({ token: token!, name: name.trim(), address: address.trim() || undefined });
      setName(""); setAddress(""); setShowForm(false);
    } catch (err: any) { alert(err.message); }
  };

  const handleUpdate = async (id: string) => {
    if (!name.trim()) return;
    try {
      await updateCampus({ token: token!, id: id as any, name: name.trim(), address: address.trim() || undefined });
      setName(""); setAddress(""); setEditingId(null);
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className="space-y-3 pt-3 border-t border-ink/5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">
          Sedes / Campuses ({campuses?.length || 0})
        </p>
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); setName(""); setAddress(""); }}
          className="text-xs font-semibold text-teal-700 hover:text-teal-600 transition flex items-center gap-1">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          {showForm ? "Cancelar" : "Nueva sede"}
        </button>
      </div>

      {showForm && (
        <div className="bg-ink/[0.02] border border-ink/10 rounded-xl p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-ink/50 mb-1 block">Nombre de la sede</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: Sede Central"
              className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/50 mb-1 block">Dirección (opcional)</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Ej: Av. Principal #123"
              className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2 text-sm" />
          </div>
          <button onClick={editingId ? () => handleUpdate(editingId) : handleCreate}
            className="w-full bg-ink text-white rounded-xl py-2 text-sm font-semibold">
            {editingId ? "Guardar cambios" : "Crear sede"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {(campuses || []).map((c: any) => (
          <div key={c._id}>
            <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-ink/[0.02] border border-ink/5">
              <span className="w-2 h-2 rounded-full shrink-0 bg-teal-500" />
              <button
                onClick={() => setSelectedCampus(selectedCampus === c._id ? null : c._id)}
                className="flex-1 text-sm font-medium text-left truncate"
              >
                {c.name}
                {c.address && <span className="text-xs text-ink/40 ml-2">· {c.address}</span>}
              </button>
              <button onClick={() => { setEditingId(c._id); setName(c.name); setAddress(c.address || ""); setShowForm(true); }}
                className="w-6 h-6 rounded-full bg-ink/5 flex items-center justify-center text-ink/30 hover:text-teal-600 hover:bg-teal-50 transition"
                title="Editar">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
              </button>
              <button onClick={() => { if (confirm(`¿Eliminar sede "${c.name}"?`)) deleteCampus({ token: token!, id: c._id }); }}
                className="w-6 h-6 rounded-full bg-ink/5 flex items-center justify-center text-ink/30 hover:text-coral-600 hover:bg-coral-50 transition"
                title="Eliminar">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            {selectedCampus === c._id && (
              <MinistryManager campusId={c._id} campusName={c.name} />
            )}
          </div>
        ))}
        {(!campuses || campuses.length === 0) && (
          <p className="text-xs text-ink/30 py-2 text-center">No hay sedes. Crea la primera.</p>
        )}
      </div>
    </div>
  );
}

function MinistryManager({ campusId, campusName }: { campusId: string; campusName: string }) {
  const { token } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");

  const ministries = useQuery(api.ministry.list, token ? { token, campusId: campusId as any } : "skip");
  const createMinistry = useMutation(api.ministry.create);
  const deleteMinistry = useMutation(api.ministry.remove);

  const [selectedMinistry, setSelectedMinistry] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createMinistry({ token: token!, campusId: campusId as any, name: name.trim() });
      setName(""); setShowForm(false);
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className="ml-5 pl-3 border-l-2 border-ink/5 mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-ink/40 uppercase tracking-wide">
          Ministerios {campusName ? `en ${campusName}` : ""}
        </p>
        <button onClick={() => setShowForm(!showForm)}
          className="text-[10px] font-semibold text-teal-600 hover:text-teal-700 transition">
          {showForm ? "Cancelar" : "+ Nuevo"}
        </button>
      </div>

      {showForm && (
        <div className="bg-ink/[0.02] border border-ink/10 rounded-xl p-3 space-y-2">
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Ej: Jóvenes, Niños, Damas..."
            className="w-full bg-card border border-ink/10 rounded-xl px-3 py-2 text-sm" />
          <button onClick={handleCreate}
            className="w-full bg-ink text-white rounded-xl py-1.5 text-xs font-semibold">
            Crear ministerio
          </button>
        </div>
      )}

      {(ministries || []).map((m: any) => (
        <div key={m._id}>
          <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-ink/[0.02] transition">
            <button
              onClick={() => setSelectedMinistry(selectedMinistry === m._id ? null : m._id)}
              className="flex-1 text-xs font-medium text-left truncate"
            >
              {m.name}
            </button>
            <button onClick={() => { if (confirm(`¿Eliminar ministerio "${m.name}"?`)) deleteMinistry({ token: token!, id: m._id }); }}
              className="w-5 h-5 rounded-full bg-ink/5 flex items-center justify-center text-ink/20 hover:text-coral-600 hover:bg-coral-50 transition"
              title="Eliminar">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          {selectedMinistry === m._id && (
            <GroupManager ministryId={m._id} ministryName={m.name} />
          )}
        </div>
      ))}
      {(!ministries || ministries.length === 0) && !showForm && (
        <p className="text-[11px] text-ink/30 py-1 text-center">Sin ministerios</p>
      )}
    </div>
  );
}

function GroupManager({ ministryId, ministryName }: { ministryId: string; ministryName: string }) {
  const { token } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");

  const groups = useQuery(api.group.list, token ? { token, ministryId: ministryId as any } : "skip");
  const createGroup = useMutation(api.group.create);
  const deleteGroup = useMutation(api.group.remove);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createGroup({ token: token!, ministryId: ministryId as any, name: name.trim() });
      setName(""); setShowForm(false);
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className="ml-5 pl-3 border-l-2 border-ink/5 mt-1 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-ink/30 uppercase tracking-wide">
          Grupos
        </p>
        <button onClick={() => setShowForm(!showForm)}
          className="text-[10px] font-semibold text-teal-500 hover:text-teal-600 transition">
          {showForm ? "Cancelar" : "+ Nuevo"}
        </button>
      </div>

      {showForm && (
        <div className="bg-ink/[0.02] border border-ink/10 rounded-xl p-2 space-y-2">
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Ej: Célula Berea"
            className="w-full bg-card border border-ink/10 rounded-lg px-3 py-1.5 text-xs" />
          <button onClick={handleCreate}
            className="w-full bg-ink text-white rounded-lg py-1 text-[11px] font-semibold">
            Crear grupo
          </button>
        </div>
      )}

      <div className="space-y-0.5">
        {(groups || []).map((g: any) => (
          <div key={g._id} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-ink/[0.02] transition">
            <svg className="w-3 h-3 shrink-0 text-ink/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            <span className="flex-1 text-[11px] truncate">{g.name}</span>
            <button onClick={() => { if (confirm(`¿Eliminar grupo "${g.name}"?`)) deleteGroup({ token: token!, id: g._id }); }}
              className="w-4 h-4 rounded-full bg-ink/5 flex items-center justify-center text-ink/20 hover:text-coral-600 hover:bg-coral-50 transition"
              title="Eliminar">
              <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
        {(!groups || groups.length === 0) && !showForm && (
          <p className="text-[10px] text-ink/20 py-1 text-center">Sin grupos</p>
        )}
      </div>
    </div>
  );
}
