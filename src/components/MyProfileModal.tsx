import { useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import ResponsiveSheet from "./ResponsiveSheet";
import ImageUploader from "./ImageUploader";

export default function MyProfileModal({ onClose }: { onClose: () => void }) {
  const { user, token } = useAuth();
  const updateMe = useMutation(api.users.updateMe);
  const myScopes = useQuery(api.userScopes.myScopes, token ? { token } : "skip");
  
  const [view, setView] = useState<"main" | "personal" | "security" | "ministries">("main");
  
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [birthDate, setBirthDate] = useState(user?.birthDate || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [avatarStorageId, setAvatarStorageId] = useState<string>("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleSavePersonal = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await updateMe({
        token,
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        birthDate: birthDate.trim() || undefined,
        avatarStorageId: avatarStorageId || undefined,
      });
      alert("Información personal actualizada.");
      setView("main");
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecurity = async () => {
    if (!token) return;
    if (!password) {
      alert("Debes escribir una nueva contraseña.");
      return;
    }
    setSaving(true);
    try {
      await updateMe({ token, password });
      alert("Contraseña actualizada con éxito.");
      setPassword("");
      setView("main");
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const initials = ((user.name?.[0] || "") + (user.name?.split(" ")[1]?.[0] || "")).toUpperCase();
  const displayAvatar = avatar || null;

  // Components for settings list
  const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-[11px] font-bold text-teal-800/60 uppercase tracking-widest px-4 mb-2 mt-6">
      {children}
    </h3>
  );

  const ListItem = ({ icon, title, value, onClick, isLast = false, isDestructive = false }: any) => (
    <button 
      onClick={onClick}
      className={`w-full flex items-center bg-white px-4 py-3.5 transition-colors pressable ${!isLast ? 'border-b border-ink/5' : ''}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mr-3 ${isDestructive ? 'bg-red-50 text-red-500' : 'bg-ink/5 text-ink/70'}`}>
        {icon}
      </div>
      <div className="flex-1 text-left">
        <p className={`text-sm font-semibold ${isDestructive ? 'text-red-500' : 'text-ink/90'}`}>{title}</p>
      </div>
      {value && <span className="text-xs text-ink/40 mr-2">{value}</span>}
      {!isDestructive && (
        <svg className="w-4 h-4 text-ink/30 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      )}
    </button>
  );

  return (
    <ResponsiveSheet title={view === "main" ? "Configuración" : view === "personal" ? "Información Personal" : view === "security" ? "Contraseña y Seguridad" : "Mis Ministerios"} onClose={view === "main" ? onClose : () => setView("main")} desktopMaxWidthClass="sm:max-w-md">
      <div className="flex flex-col h-full bg-[#F9FAFB] pb-8">
        
        {view === "main" && (
          <div className="animate-fade-in">
            {/* Profile Card */}
            <div className="bg-white rounded-3xl mx-4 mt-4 p-6 shadow-sm border border-ink/5 flex flex-col items-center">
              <div className="relative mb-3">
                <ImageUploader 
                  currentImageUrl={displayAvatar || undefined}
                  onUploadComplete={async (storageId, url) => {
                    setAvatarStorageId(storageId);
                    setAvatar(url);
                    if (token) {
                      try {
                        await updateMe({ token, avatarStorageId: storageId });
                      } catch (err: any) {
                        console.error("Error al guardar avatar inmediatamente:", err);
                      }
                    }
                  }}
                  label="Foto de Perfil"
                />
              </div>
              
              <h2 className="text-xl font-bold text-ink/90">{user.name}</h2>
              <p className="text-sm font-semibold text-teal-600 capitalize mt-0.5 tracking-wide">{user.role}</p>
              
              <button 
                onClick={() => setView("personal")}
                className="mt-4 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-ink/80 text-xs font-bold py-2.5 px-6 rounded-full transition-colors"
              >
                Editar Perfil
              </button>
            </div>

            {/* Sections */}
            <div className="mt-2">
              <SectionHeader>Cuenta</SectionHeader>
              <div className="mx-4 bg-white rounded-2xl shadow-sm border border-ink/5 overflow-hidden">
                <ListItem 
                  icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
                  title="Información Personal"
                  onClick={() => setView("personal")}
                />
                <ListItem 
                  icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>}
                  title="Contraseña y Seguridad"
                  onClick={() => setView("security")}
                  isLast={true}
                />
              </div>

              <SectionHeader>Organización</SectionHeader>
              <div className="mx-4 bg-white rounded-2xl shadow-sm border border-ink/5 overflow-hidden">
                <ListItem 
                  icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>}
                  title="Mis Ministerios Asignados"
                  value={myScopes ? `${myScopes.length} áreas` : "..."}
                  onClick={() => setView("ministries")}
                  isLast={true}
                />
              </div>

              {/* Assuming logout is handled by the parent layout, we can just close modal or we could trigger a logout if we passed it in */}
              <div className="mt-8 px-4">
                <button
                  onClick={onClose}
                  className="w-full bg-white border border-ink/10 hover:bg-red-50 text-red-500 font-bold py-3.5 rounded-2xl shadow-sm transition-colors"
                >
                  Cerrar Ventana
                </button>
              </div>
            </div>
          </div>
        )}

        {view === "personal" && (
          <div className="p-5 animate-slide-in-right">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink/60 uppercase tracking-wide mb-1.5 ml-1">Nombre Completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-ink/10 focus:ring-2 focus:ring-teal-600/30 rounded-xl px-4 py-3 text-sm font-medium text-ink transition-shadow shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink/60 uppercase tracking-wide mb-1.5 ml-1">Teléfono</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+51 999 999 999"
                  className="w-full bg-white border border-ink/10 focus:ring-2 focus:ring-teal-600/30 rounded-xl px-4 py-3 text-sm font-medium text-ink transition-shadow shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink/60 uppercase tracking-wide mb-1.5 ml-1">Fecha de Nacimiento</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full bg-white border border-ink/10 focus:ring-2 focus:ring-teal-600/30 rounded-xl px-4 py-3 text-sm font-medium text-ink transition-shadow shadow-sm"
                />
              </div>
              
              <button
                onClick={handleSavePersonal}
                disabled={saving}
                className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-bold rounded-xl py-3.5 text-sm shadow-md transition-all mt-4"
              >
                {saving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        )}

        {view === "security" && (
          <div className="p-5 animate-slide-in-right">
            <div className="space-y-4">
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  <div>
                    <h4 className="text-sm font-bold text-orange-800">Actualizar Credenciales</h4>
                    <p className="text-xs text-orange-700/80 mt-1">Si cambias tu contraseña, asegúrate de guardarla en un lugar seguro. Tu sesión actual se mantendrá activa.</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink/60 uppercase tracking-wide mb-1.5 ml-1">Nueva Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="*********"
                  className="w-full bg-white border border-ink/10 focus:ring-2 focus:ring-teal-600/30 rounded-xl px-4 py-3 text-sm font-medium text-ink transition-shadow shadow-sm"
                />
              </div>
              
              <button
                onClick={handleSaveSecurity}
                disabled={saving || !password}
                className="w-full bg-ink hover:bg-ink/80 disabled:bg-ink/30 text-white font-bold rounded-xl py-3.5 text-sm shadow-md transition-all mt-4"
              >
                {saving ? "Actualizando..." : "Cambiar Contraseña"}
              </button>
            </div>
          </div>
        )}

        {view === "ministries" && (
          <div className="p-5 animate-slide-in-right">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-ink/90">Mis Ministerios</h3>
              {user.role === "pastor" && (
                <button className="text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1.5 rounded-full hover:bg-teal-100 transition-colors">
                  + Asignar Nuevo
                </button>
              )}
            </div>
            
            {!myScopes ? (
              <div className="text-center py-8">
                <div className="animate-spin w-6 h-6 text-teal-600 mx-auto" />
              </div>
            ) : myScopes.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-ink/5 shadow-sm">
                <div className="w-12 h-12 bg-ink/5 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-ink/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
                <p className="text-sm text-ink/60 font-medium">Aún no tienes áreas asignadas.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myScopes.map((scope) => (
                  <div key={scope._id} className="bg-white border border-ink/5 rounded-2xl p-4 shadow-sm flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink/90 capitalize">{scope.role}</p>
                      <p className="text-[13px] text-ink/60 mt-1 leading-relaxed">
                        {scope.campusName ? <span className="block"><strong className="font-semibold text-ink/70">Sede:</strong> {scope.campusName}</span> : <span className="block font-semibold">Toda la iglesia</span>}
                        {scope.ministryName && <span className="block"><strong className="font-semibold text-ink/70">Min:</strong> {scope.ministryName}</span>}
                        {scope.groupName && <span className="block"><strong className="font-semibold text-ink/70">Grupo:</strong> {scope.groupName}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </ResponsiveSheet>
  );
}
