import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../hooks/useAuth";
import ResponsiveSheet from "./ResponsiveSheet";

export default function AccessControl() {
  const { user, token, canManageUsers } = useAuth();
  if (!user || !canManageUsers) return null;

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-10">
      <div>
        <p className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
          Administración
        </p>
        <h1 className="font-display text-2xl font-bold mt-0.5">Accesos y Roles</h1>
        <p className="text-sm text-ink/60 mt-1">
          Gestiona permisos, usuarios y la estructura organizacional.
        </p>
      </div>
      
      <div className="bg-card rounded-card shadow-soft p-5 space-y-4">
      <UserManager />
      <CampusManager />
    </div>
    </div>
  );
}

function UserManager() {
  const { token, user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("leader");
  const [editingUser, setEditingUser] = useState<any | null>(null);

  const users = useQuery(api.users.listUsers, token ? { token } : "skip");
  const register = useMutation(api.users.register);
  const migrateEmails = useMutation(api.users.migrateEmailsToLowerCase);
  const updateUser = useMutation(api.users.updateUser);
  const [migrating, setMigrating] = useState(false);

  const handleCreate = async () => {
    if (!email.trim() || !password.trim() || !name.trim()) return;
    setSubmitting(true);
    try {
      await register({ email: email.trim().toLowerCase(), password, name: name.trim(), role: role as any, token: token ?? undefined });
      setEmail("");
      setPassword("");
      setName("");
      setRole("leader");
      setShowForm(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const res = await migrateEmails();
      alert(`Correos normalizados con éxito. Usuarios actualizados: ${res.migratedCount}`);
    } catch (err: any) {
      alert(`Error al normalizar correos: ${err.message}`);
    } finally {
      setMigrating(false);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    if (!token) return;
    try {
      await updateUser({
        token,
        userId: userId as any,
        isActive: !currentActive,
      });
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
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="text-[11px] font-semibold text-teal-700 hover:text-teal-600 transition flex items-center gap-1 bg-teal-50 dark:bg-teal-950/20 px-2.5 py-1 rounded-lg border border-teal-200/50 dark:border-teal-900/40 disabled:opacity-50 pressable"
            title="Convierte todos los correos registrados a minúsculas para evitar problemas de inicio de sesión"
          >
            {migrating ? "Normalizando..." : "Normalizar correos"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs font-semibold text-teal-700 hover:text-teal-600 transition flex items-center gap-1 pressable"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            {showForm ? "Cancelar" : "Nuevo usuario"}
          </button>
        </div>
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
              <option value="admin">Administrador</option>
            </select>
          </div>
           <button
            onClick={handleCreate}
            disabled={submitting}
            className="w-full bg-ink text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50 pressable flex items-center justify-center gap-1.5"
          >
            {submitting && (
              <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {submitting ? "Creando..." : "Crear usuario"}
          </button>
        </div>
      )}

      <div className="space-y-1">
        {(users || []).map((u: any) => (
          <div key={u._id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-ink/[0.02] border border-ink/5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${u.isActive ? "bg-green-500" : "bg-red-400"}`} />
            <span className="flex-1 text-sm font-medium min-w-0 truncate">{u.name}</span>
            <span className="text-[10px] capitalize text-ink/40 mr-1">{u.role}</span>
            
            {/* Botón de Aprobar / Desactivar */}
            {!u.isActive && (
              <button
                onClick={() => handleToggleActive(u._id, u.isActive)}
                className="px-2 py-0.5 text-[10px] font-semibold bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/40 rounded-lg hover:bg-green-100 transition shrink-0 pressable"
                title="Aprobar acceso del usuario"
              >
                Aprobar
              </button>
            )}
            {u.isActive && u._id !== user?._id && u.role !== "pastor" && (
              <button
                onClick={() => handleToggleActive(u._id, u.isActive)}
                className="px-2 py-0.5 text-[10px] font-semibold bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-lg hover:bg-red-100 transition shrink-0 pressable"
                title="Desactivar acceso del usuario"
              >
                Desactivar
              </button>
            )}

            {u.role !== "pastor" && (
              <button
                onClick={() => setEditingUser(u)}
                className="w-7 h-7 rounded-full bg-ink/5 flex items-center justify-center text-ink/40 hover:text-teal-600 hover:bg-teal-50 transition shrink-0"
                title="Gestionar permisos y accesos"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                </svg>
              </button>
            )}
          </div>
        ))}
        {(!users || users.length === 0) && (
          <p className="text-xs text-ink/30 py-2">No hay usuarios registrados</p>
        )}
      </div>

      {editingUser && (
        (() => {
          const currentEditingUser = users?.find((u: any) => u._id === editingUser._id);
          if (!currentEditingUser) return null;
          return (
            <ResponsiveSheet title={`Accesos: ${currentEditingUser.name}`} onClose={() => setEditingUser(null)} desktopMaxWidthClass="sm:max-w-2xl">
              <UserPermissionsManager user={currentEditingUser} />
              <UserScopesManager userId={currentEditingUser._id} />
            </ResponsiveSheet>
          );
        })()
      )}
    </div>
  );
}

function CampusManager() {
  const { token, user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const campuses = useQuery(api.campus.list, user && token ? { token } : "skip");
  const createCampus = useMutation(api.campus.create);
  const updateCampus = useMutation(api.campus.update);
  const deleteCampus = useMutation(api.campus.remove);

  const [selectedCampus, setSelectedCampus] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await createCampus({ token: token!, name: name.trim(), address: address.trim() || undefined });
      setName(""); setAddress(""); setShowForm(false);
    } catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  const handleUpdate = async (id: string) => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await updateCampus({ token: token!, id: id as any, name: name.trim(), address: address.trim() || undefined });
      setName(""); setAddress(""); setEditingId(null); setShowForm(false);
    } catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
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
          <button
            onClick={editingId ? () => handleUpdate(editingId) : handleCreate}
            disabled={submitting}
            className="w-full bg-ink text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50 pressable flex items-center justify-center gap-1.5"
          >
            {submitting && (
              <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {submitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear sede"}
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
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");

  const ministries = useQuery(api.ministry.list, token ? { token, campusId: campusId as any } : "skip");
  const createMinistry = useMutation(api.ministry.create);
  const deleteMinistry = useMutation(api.ministry.remove);

  const [selectedMinistry, setSelectedMinistry] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await createMinistry({ token: token!, campusId: campusId as any, name: name.trim() });
      setName(""); setShowForm(false);
    } catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
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
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="w-full bg-ink text-white rounded-xl py-1.5 text-xs font-semibold disabled:opacity-50 pressable flex items-center justify-center gap-1.5"
          >
            {submitting && (
              <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {submitting ? "Creando..." : "Crear ministerio"}
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
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");

  const groups = useQuery(api.group.list, token ? { token, ministryId: ministryId as any } : "skip");
  const createGroup = useMutation(api.group.create);
  const deleteGroup = useMutation(api.group.remove);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await createGroup({ token: token!, ministryId: ministryId as any, name: name.trim() });
      setName(""); setShowForm(false);
    } catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
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
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="w-full bg-ink text-white rounded-lg py-1 text-[11px] font-semibold disabled:opacity-50 pressable flex items-center justify-center gap-1.5"
          >
            {submitting && (
              <svg className="animate-spin h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {submitting ? "Creando..." : "Crear grupo"}
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

interface UserScopesManagerProps {
  userId: string;
}

const PERMISSION_DEFS = [
  { id: "manage_users", label: "Administrar usuarios", desc: "Crear usuarios y modificar permisos" },
  { id: "manage_settings", label: "Ajustes globales", desc: "Ver pestaña Ajustes y configuración" },
  { id: "write_teens", label: "Editar adolescentes", desc: "Agregar o modificar perfiles" },
  { id: "delete_teens", label: "Eliminar adolescentes", desc: "Permiso destructivo de borrado" },
  { id: "view_reports", label: "Ver reportes", desc: "Acceso a las métricas del ministerio" },
  { id: "use_ai", label: "Usar IA Pastoral", desc: "Acceso al análisis de asistencia y chats" },
];

function UserPermissionsManager({ user }: { user: any }) {
  const { token } = useAuth();
  const updateUser = useMutation(api.users.updateUser);
  const userPerms = user.permissions || [];
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    setEditName(user.name);
    setEditEmail(user.email);
  }, [user]);

  const togglePermission = async (permId: string) => {
    if (!token) return;
    const hasPerm = userPerms.includes(permId);
    const newPerms = hasPerm ? userPerms.filter((p: string) => p !== permId) : [...userPerms, permId];
    try {
      await updateUser({
        token,
        userId: user._id,
        permissions: newPerms,
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!token) return;
    try {
      await updateUser({
        token,
        userId: user._id,
        role: e.target.value as any,
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveEdit = async () => {
    if (!token) return;
    if (!editName.trim() || !editEmail.trim()) {
      alert("El nombre y el correo son obligatorios.");
      return;
    }
    setSavingEdit(true);
    try {
      await updateUser({
        token,
        userId: user._id,
        name: editName.trim(),
        email: editEmail.trim(),
      });
      setIsEditing(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="p-5 border-b border-ink/5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <input 
                type="text" 
                value={editName} 
                onChange={(e) => setEditName(e.target.value)} 
                className="w-full text-sm font-semibold bg-white border border-ink/20 rounded px-2 py-1"
                placeholder="Nombre completo"
              />
              <input 
                type="email" 
                value={editEmail} 
                onChange={(e) => setEditEmail(e.target.value)} 
                className="w-full text-xs text-ink/70 bg-white border border-ink/20 rounded px-2 py-1"
                placeholder="Correo electrónico"
              />
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} disabled={savingEdit} className="text-[10px] bg-teal-600 text-white px-2 py-1 rounded">
                  {savingEdit ? "Guardando..." : "Guardar"}
                </button>
                <button onClick={() => { setIsEditing(false); setEditName(user.name); setEditEmail(user.email); }} className="text-[10px] bg-ink/10 text-ink px-2 py-1 rounded">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="relative pr-8">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-ink/50">{user.email}</p>
              <button 
                onClick={() => setIsEditing(true)} 
                className="absolute top-1/2 right-0 -translate-y-1/2 p-1 text-teal-600 hover:text-teal-700 bg-teal-50 dark:bg-teal-950/20 rounded-full w-6 h-6 flex items-center justify-center transition-colors shadow-sm"
                title="Editar nombre y correo"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
              </button>
            </div>
          )}
        </div>
        <select
          value={user.role}
          onChange={handleRoleChange}
          className="bg-ink/5 border-none rounded-xl px-3 py-1.5 text-xs font-semibold capitalize"
        >
          <option value="leader">Líder</option>
          <option value="helper">Ayudante</option>
          <option value="coordinador">Coordinador</option>
          <option value="director">Director</option>
          <option value="pastor">Pastor</option>
          <option value="admin">Administrador</option>
        </select>
      </div>

      <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-3">
        Permisos específicos
      </p>
      
      <div className="space-y-3">
        {PERMISSION_DEFS.map(perm => (
          <label key={perm.id} className="flex items-start gap-3 cursor-pointer group">
            <div className="mt-0.5">
              <input
                type="checkbox"
                checked={userPerms.includes(perm.id)}
                onChange={() => togglePermission(perm.id)}
                className="w-4 h-4 rounded border-ink/20 text-teal-600 focus:ring-teal-600/30"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium group-hover:text-teal-700 transition">{perm.label}</p>
              <p className="text-[11px] text-ink/50">{perm.desc}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function UserScopesManager({ userId }: UserScopesManagerProps) {
  const { token, user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<string>("leader");
  const [selectedCampusId, setSelectedCampusId] = useState<string>("");
  const [selectedMinistryId, setSelectedMinistryId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const scopes = useQuery(api.userScopes.list, user && token ? { token, userId: userId as any } : "skip");
  const campuses = useQuery(api.campus.list, user && token ? { token } : "skip");
  const ministries = useQuery(
    api.ministry.list,
    user && token && selectedCampusId ? { token, campusId: selectedCampusId as any } : "skip"
  );
  const groups = useQuery(
    api.group.list,
    user && token && selectedMinistryId ? { token, ministryId: selectedMinistryId as any } : "skip"
  );

  const createScope = useMutation(api.userScopes.create);
  const removeScope = useMutation(api.userScopes.remove);

  const handleAddScope = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await createScope({
        token,
        userId: userId as any,
        role: selectedRole as any,
        campusId: selectedCampusId ? (selectedCampusId as any) : undefined,
        ministryId: selectedMinistryId ? (selectedMinistryId as any) : undefined,
        groupId: selectedGroupId ? (selectedGroupId as any) : undefined,
      });
      setSelectedCampusId("");
      setSelectedMinistryId("");
      setSelectedGroupId("");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveScope = async (id: string) => {
    if (!token) return;
    try {
      await removeScope({ token, id: id as any });
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-2">
          Ámbitos de acceso asignados
        </p>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {scopes && scopes.length > 0 ? (
            scopes.map((s) => (
              <ScopeRow key={s._id} scope={s} onDelete={() => handleRemoveScope(s._id)} />
            ))
          ) : (
            <p className="text-xs text-ink/30 italic py-2 text-center">
              Sin ámbitos asignados. Este usuario no podrá acceder a ningún adolescente.
            </p>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-ink/5 space-y-3">
        <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">
          Asignar nuevo ámbito
        </p>
        <div className="space-y-2 bg-ink/[0.01] border border-ink/5 rounded-xl p-3">
          <div>
            <label className="text-[11px] font-semibold text-ink/50 mb-1 block">Rol en este ámbito</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-card border border-ink/10 rounded-xl px-3 py-1.5 text-xs"
            >
              <option value="leader">Líder</option>
              <option value="helper">Ayudante</option>
              <option value="coordinador">Coordinador</option>
              <option value="director">Director</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-ink/50 mb-1 block">Sede / Campus (opcional)</label>
            <select
              value={selectedCampusId}
              onChange={(e) => {
                setSelectedCampusId(e.target.value);
                setSelectedMinistryId("");
                setSelectedGroupId("");
              }}
              className="w-full bg-card border border-ink/10 rounded-xl px-3 py-1.5 text-xs"
            >
              <option value="">-- Toda la iglesia --</option>
              {(campuses || []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-ink/50 mb-1 block">Ministerio (opcional)</label>
            <select
              value={selectedMinistryId}
              onChange={(e) => {
                setSelectedMinistryId(e.target.value);
                setSelectedGroupId("");
              }}
              disabled={!selectedCampusId}
              className="w-full bg-card border border-ink/10 rounded-xl px-3 py-1.5 text-xs disabled:opacity-50"
            >
              <option value="">-- Todo el campus --</option>
              {selectedCampusId &&
                (ministries || []).map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-ink/50 mb-1 block">Grupo (opcional)</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              disabled={!selectedMinistryId}
              className="w-full bg-card border border-ink/10 rounded-xl px-3 py-1.5 text-xs disabled:opacity-50"
            >
              <option value="">-- Todo el ministerio --</option>
              {selectedMinistryId &&
                (groups || []).map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.name}
                  </option>
                ))}
            </select>
          </div>

          <button
            onClick={handleAddScope}
            disabled={submitting}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl py-2 text-xs font-semibold mt-2 transition disabled:opacity-50 pressable flex items-center justify-center gap-1.5"
          >
            {submitting && (
              <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {submitting ? "Guardando..." : "Agregar acceso"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScopeRow({ scope, onDelete }: { scope: any; onDelete: () => void }) {
  const { token } = useAuth();
  const campus = useQuery(api.campus.get, token && scope.campusId ? { token, id: scope.campusId } : "skip");
  const ministry = useQuery(api.ministry.get, token && scope.ministryId ? { token, id: scope.ministryId } : "skip");
  const group = useQuery(api.group.get, token && scope.groupId ? { token, id: scope.groupId } : "skip");

  const getLabel = () => {
    const roleMap: Record<string, string> = {
      pastor: "Pastor",
      director: "Director",
      coordinador: "Coordinador",
      leader: "Líder",
      helper: "Ayudante",
    };
    const roleLabel = roleMap[scope.role] || scope.role;

    if (scope.groupId) {
      return `${roleLabel} en Grupo: ${group ? group.name : "..."} (${ministry ? ministry.name : "..."})`;
    }
    if (scope.ministryId) {
      return `${roleLabel} en Ministerio: ${ministry ? ministry.name : "..."} (${campus ? campus.name : "..."})`;
    }
    if (scope.campusId) {
      return `${roleLabel} en Sede: ${campus ? campus.name : "..."}`;
    }
    return `${roleLabel} Global`;
  };

  return (
    <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-ink/[0.02] border border-ink/5">
      <span className="font-medium text-ink/70 truncate flex-1 mr-2">{getLabel()}</span>
      <button
        onClick={onDelete}
        className="w-5 h-5 rounded-full bg-ink/5 flex items-center justify-center text-ink/30 hover:text-coral-600 hover:bg-coral-50 transition shrink-0"
        title="Eliminar ámbito"
      >
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
