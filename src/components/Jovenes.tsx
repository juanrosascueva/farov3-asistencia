import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { AlertTriangle, Cake, FileWarning, Grid2X2, List, MoreHorizontal, Plus, QrCode, RefreshCw, Search, SlidersHorizontal, Upload, Users, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap, TeenStatus } from "../lib/types";
import { ageFromDOB, daysToNextBirthday, esc, getTeenStatus, riskScore, statsFor, teenProfileCompleteness, TEEN_STATUS_META } from "../lib/utils";
import { Avatar } from "./Layout";
import TeenForm from "./TeenForm";
import TeenImportModal from "./TeenImportModal";
import { useAuth } from "../hooks/useAuth";
import { useScope } from "../hooks/useScope";
import PublicRegistrationLinkModal from "./PublicRegistrationLinkModal";

interface JovenesProps {
  teens: Doc<"teens">[];
  attendanceMap: AttendanceMap;
  onOpenProfile: (id: string) => void;
}

type SortMode = "nombre" | "riesgo" | "prioridad" | "responsable";
type ViewMode = "cards" | "list";
type QuickView = "all" | "mine" | "action" | "unassigned" | "incomplete" | "visitors";
type PastoralFilter = "all" | 0 | 1 | 2 | 3 | 4 | 5;
type AgeFilter = "all" | "12-13" | "14-15" | "16-17" | "18+";
type StatusFilter = "all" | TeenStatus;
type IntegrationFilter = "all" | "nuevo" | "en_proceso" | "integrado" | "necesita_acompañamiento";
type ResponsibleFilter = "all" | "mine" | "unassigned";
type CompletenessFilter = "all" | "incomplete";

const VIEW_KEY = "teens_list_view";
const sortLabels: Record<SortMode, string> = { prioridad: "Prioridad pastoral", riesgo: "Nivel de riesgo", nombre: "Nombre (A-Z)", responsable: "Responsable" };
const quickViews: Array<{ id: QuickView; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "mine", label: "Mis adolescentes" },
  { id: "action", label: "Requieren acción" },
  { id: "unassigned", label: "Sin responsable" },
  { id: "incomplete", label: "Fichas incompletas" },
  { id: "visitors", label: "Visitantes" },
];

function sourceLabel(source?: string) {
  if (source === "individual") return "Asignación individual";
  if (source === "group") return "Líder del grupo";
  return "Sin responsable";
}

function statusMeta(status: string) {
  return TEEN_STATUS_META[status as TeenStatus];
}

export default function Jovenes({ teens, attendanceMap, onOpenProfile }: JovenesProps) {
  const { token, user } = useAuth();
  const { scope, scopeLabel } = useScope();
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showQuickVisitor, setShowQuickVisitor] = useState(false);
  const [showPublicLink, setShowPublicLink] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("prioridad");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => sessionStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards");
  const [quickView, setQuickView] = useState<QuickView>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [filtroPastoral, setFiltroPastoral] = useState<PastoralFilter>("all");
  const [filtroEdad, setFiltroEdad] = useState<AgeFilter>("all");
  const [filtroEstado, setFiltroEstado] = useState<StatusFilter>("all");
  const [filtroIntegracion, setFiltroIntegracion] = useState<IntegrationFilter>("all");
  const [filtroResponsable, setFiltroResponsable] = useState<ResponsibleFilter>("all");
  const [filtroFicha, setFiltroFicha] = useState<CompletenessFilter>("all");
  const [selectedTeenIds, setSelectedTeenIds] = useState<string[]>([]);
  const [bulkLeaderId, setBulkLeaderId] = useState("");
  const [pppRecalculating, setPppRecalculating] = useState(false);

  const scopeArgs = { campusId: scope.campusId as any, ministryId: scope.ministryId as any, groupId: scope.groupId as any };
  const leaderAssignments = useQuery(api.teens.listLeaderAssignments, token ? { token } : "skip") ?? [];
  const followUpQueue = useQuery(api.followUp.getQueue, token ? { token, ...scopeArgs } : "skip") ?? [];
  const assignableUsers = useQuery(api.pastoralTasks.listAssignableUsers, token ? { token } : "skip") ?? [];
  const bulkAssignLeader = useMutation(api.teens.bulkAssignLeader);
  const recalcPpp = useAction(api.ppp.calculateAllPpp as any);
  const canAssignLeaders = ["admin", "pastor", "director", "coordinador"].includes(user?.role || "");

  useEffect(() => {
    sessionStorage.setItem(VIEW_KEY, viewMode);
    if (viewMode === "cards") setSelectedTeenIds([]);
  }, [viewMode]);

  const leaderByTeenId = useMemo(() => new Map(leaderAssignments.map((item: any) => [String(item.teenId), item])), [leaderAssignments]);
  const queueByTeenId = useMemo(() => {
    const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const next = new Map<string, any>();
    for (const item of followUpQueue as any[]) {
      const id = String(item.teenId);
      const previous = next.get(id);
      if (!previous || (rank[item.priority] || 0) > (rank[previous.priority] || 0)) next.set(id, item);
    }
    return next;
  }, [followUpQueue]);

  const allTeenData = useMemo(() => teens.map((t) => {
    const stats = statsFor(t._id, attendanceMap);
    const risk = riskScore(stats);
    const leader = leaderByTeenId.get(String(t._id));
    const queueItem = queueByTeenId.get(String(t._id));
    const incomplete = (t as any).fichaCompleta === false || (t as any).registroRapido;
    const requiresAction = Boolean(queueItem) || risk.score >= 2;
    const latest = stats.history.length ? stats.history[stats.history.length - 1] : undefined;
    const notice = queueItem?.kind === "crisis"
      ? { label: "Crisis activa", detail: queueItem.detail, className: "bg-danger-50 text-danger-700 border-danger-200" }
      : queueItem?.kind === "task"
      ? { label: queueItem.status === "escalated" ? "Tarea escalada" : "Tarea pastoral", detail: queueItem.title, className: "bg-primary-50 text-primary-700 border-primary-200" }
      : queueItem?.kind === "signal"
      ? { label: "Señal de asistencia", detail: queueItem.detail, className: "bg-warning-50 text-warning-700 border-warning-200" }
      : risk.score >= 4
      ? { label: risk.score === 5 ? "Crisis" : "Riesgo crítico", detail: risk.label, className: "bg-danger-50 text-danger-700 border-danger-200" }
      : risk.score >= 2
      ? { label: "Requiere atención", detail: risk.label, className: "bg-warning-50 text-warning-700 border-warning-200" }
      : incomplete
      ? { label: "Ficha incompleta", detail: "Completar datos básicos", className: "bg-warning-50 text-warning-700 border-warning-200" }
      : { label: "Sin alertas", detail: "Sin acciones abiertas", className: "bg-success-50 text-success-700 border-success-100" };
    return { t, stats, risk, leader, queueItem, incomplete, requiresAction, age: ageFromDOB(t.nacimiento), completeness: teenProfileCompleteness(t), latest, notice, status: getTeenStatus(t) };
  }), [attendanceMap, leaderByTeenId, queueByTeenId, teens]);

  const activeFilterCount = [filtroPastoral, filtroEdad, filtroEstado, filtroIntegracion, filtroResponsable, filtroFicha].filter((value) => value !== "all").length;
  const teenData = useMemo(() => allTeenData
    .filter(({ t, leader, requiresAction, incomplete, status }) => {
      const normalizedQuery = query.trim().toLowerCase();
      if (normalizedQuery && !`${t.nombre} ${t.apellido}`.toLowerCase().includes(normalizedQuery)) return false;
      if (quickView === "mine" && String(leader?.userId || "") !== String(user?._id || "")) return false;
      if (quickView === "action" && !requiresAction) return false;
      if (quickView === "unassigned" && leader?.source !== "unassigned") return false;
      if (quickView === "incomplete" && !incomplete) return false;
      if (quickView === "visitors" && status !== "visitante") return false;
      return true;
    })
    .filter(({ t, age, risk, leader, incomplete, status }) => {
      if (filtroPastoral !== "all" && risk.score !== filtroPastoral) return false;
      if (filtroEdad !== "all") {
        if (age === null) return false;
        if (filtroEdad === "18+") return age >= 18;
        const [minimum, maximum] = filtroEdad.split("-").map(Number);
        if (age < minimum || age > maximum) return false;
      }
      if (filtroEstado !== "all" && status !== filtroEstado) return false;
      if (filtroIntegracion !== "all" && (t as any).nivelIntegracion !== filtroIntegracion) return false;
      if (filtroResponsable === "mine" && String(leader?.userId || "") !== String(user?._id || "")) return false;
      if (filtroResponsable === "unassigned" && leader?.source !== "unassigned") return false;
      if (filtroFicha === "incomplete" && !incomplete) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortMode === "nombre") return `${a.t.nombre}${a.t.apellido}`.localeCompare(`${b.t.nombre}${b.t.apellido}`);
      if (sortMode === "riesgo") return b.risk.score - a.risk.score;
      if (sortMode === "responsable") return (a.leader?.userName || "Sin responsable").localeCompare(b.leader?.userName || "Sin responsable");
      const aPriority = (a.queueItem ? 10 : 0) + a.risk.score;
      const bPriority = (b.queueItem ? 10 : 0) + b.risk.score;
      return bPriority - aPriority;
    }), [allTeenData, filtroEdad, filtroEstado, filtroFicha, filtroIntegracion, filtroPastoral, filtroResponsable, query, quickView, sortMode, user?._id]);

  const summary = {
    active: allTeenData.filter((item) => item.status === "activo").length,
    action: allTeenData.filter((item) => item.requiresAction).length,
    unassigned: allTeenData.filter((item) => item.leader?.source === "unassigned").length,
    incomplete: allTeenData.filter((item) => item.incomplete).length,
  };
  const upcoming = allTeenData.map(({ t }) => ({ t, days: daysToNextBirthday(t.nacimiento) })).filter((item): item is { t: Doc<"teens">; days: number } => item.days !== null && item.days <= 21).sort((a, b) => a.days - b.days);

  const clearFilters = () => {
    setFiltroPastoral("all"); setFiltroEdad("all"); setFiltroEstado("all"); setFiltroIntegracion("all"); setFiltroResponsable("all"); setFiltroFicha("all");
  };
  const selectedAllVisible = teenData.length > 0 && teenData.every((item) => selectedTeenIds.includes(String(item.t._id)));
  const toggleVisibleSelection = () => setSelectedTeenIds(selectedAllVisible ? [] : teenData.map((item) => String(item.t._id)));
  const applyBulkLeader = async (useGroupLeader: boolean) => {
    if (!token || !selectedTeenIds.length || (!useGroupLeader && !bulkLeaderId)) return;
    await bulkAssignLeader({ token, teenIds: selectedTeenIds as any, liderPrincipalId: useGroupLeader ? undefined : bulkLeaderId as any, useGroupLeader });
    setSelectedTeenIds([]);
    setBulkLeaderId("");
  };

  const emptyMessage = quickView === "unassigned" ? "No hay adolescentes sin responsable en este ámbito." : quickView === "action" ? "No hay adolescentes que requieran acción en este momento." : quickView === "incomplete" ? "No hay fichas incompletas en este ámbito." : quickView === "visitors" ? "No hay visitantes registrados en este ámbito." : "No se encontraron adolescentes con estos criterios.";

  return <div className="space-y-5 overflow-hidden">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-semibold uppercase text-primary-700">Mi grupo</p><h1 className="mt-0.5 text-balance font-display text-2xl font-bold">Adolescentes</h1><p className="mt-1 text-sm text-ink/50">{scopeLabel}</p></div>
      <div className="flex flex-wrap gap-2">
        <div className="relative"><button type="button" onClick={() => setShowMoreActions((value) => !value)} className="ui-button ui-button--secondary gap-1.5"><MoreHorizontal size={16} aria-hidden="true" />Más acciones</button>{showMoreActions && <div className="absolute right-0 top-11 z-30 w-48 rounded-card border border-ink/10 bg-card p-1 shadow-soft"><button type="button" onClick={() => { setShowImport(true); setShowMoreActions(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-ink hover:bg-primary-50"><Upload size={16} aria-hidden="true" />Importar registros</button></div>}</div>
        <button type="button" onClick={() => setShowQuickVisitor(true)} className="ui-button ui-button--secondary gap-1.5"><Plus size={16} aria-hidden="true" />Visitante</button>
        <button type="button" onClick={() => setShowPublicLink(true)} className="ui-button ui-button--secondary gap-1.5"><QrCode size={16} aria-hidden="true" />Link QR</button>
        <button type="button" onClick={() => setShowForm(true)} className="ui-button ui-button--primary gap-1.5"><Plus size={16} aria-hidden="true" />Agregar adolescente</button>
      </div>
    </header>

    <section className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Resumen de adolescentes">
      {([
        ["active", "Activos", Users], ["action", "Requieren acción", AlertTriangle], ["unassigned", "Sin responsable", Users], ["incomplete", "Fichas incompletas", FileWarning],
      ] as const).map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setQuickView(id as QuickView)} className={`ui-card flex min-h-20 items-center gap-3 p-3 text-left pressable ${quickView === id ? "border-primary-300 bg-primary-50" : "hover:border-primary-200"}`}><span className={`feature-icon ${id === "action" || id === "incomplete" ? "feature-icon--warning" : "feature-icon--primary"}`}><Icon size={18} aria-hidden="true" /></span><span><strong className="block text-xl font-bold tabular-nums text-ink">{summary[id]}</strong><span className="text-xs font-semibold text-ink/55">{label}</span></span></button>)}
    </section>

    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">{quickViews.map((item) => <button key={item.id} type="button" onClick={() => setQuickView(item.id)} className={`ui-segment shrink-0 ${quickView === item.id ? "ui-segment--active" : ""}`}>{item.label}</button>)}</div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={17} aria-hidden="true" /><span className="sr-only">Buscar adolescente</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre..." className="ui-input w-full pl-10" /></label>
        <div className="flex gap-2"><div className="relative min-w-0 flex-1 sm:min-w-52"><button type="button" onClick={() => setShowSortMenu((value) => !value)} className="ui-button ui-button--secondary w-full justify-between">{sortLabels[sortMode]}<span aria-hidden="true">⌄</span></button>{showSortMenu && <div className="absolute right-0 top-11 z-30 w-full overflow-hidden rounded-card border border-ink/10 bg-card p-1 shadow-soft">{(Object.keys(sortLabels) as SortMode[]).map((mode) => <button key={mode} type="button" onClick={() => { setSortMode(mode); setShowSortMenu(false); }} className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${sortMode === mode ? "bg-primary-50 text-primary-700" : "text-ink/65 hover:bg-ink/5"}`}>{sortLabels[mode]}</button>)}</div>}</div>
          <button type="button" onClick={async () => { setPppRecalculating(true); await recalcPpp(); setPppRecalculating(false); }} disabled={pppRecalculating} className="ui-button ui-button--secondary px-3" title="Actualizar prioridades pastorales" aria-label="Actualizar prioridades pastorales"><RefreshCw size={17} className={pppRecalculating ? "animate-spin" : ""} aria-hidden="true" /></button>
          <button type="button" onClick={() => setShowFilters(true)} className="ui-button ui-button--secondary relative px-3" aria-label="Abrir filtros avanzados"><SlidersHorizontal size={17} aria-hidden="true" />{activeFilterCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-primary-600 px-1.5 text-micro font-bold text-white">{activeFilterCount}</span>}</button>
          <div className="flex rounded-lg border border-ink/10 bg-card p-1" role="group" aria-label="Modo de visualización"><button type="button" onClick={() => setViewMode("cards")} className={`size-9 rounded-md ${viewMode === "cards" ? "bg-primary-600 text-white" : "text-ink/50"}`} aria-label="Vista de tarjetas" title="Vista de tarjetas"><Grid2X2 size={17} aria-hidden="true" /></button><button type="button" onClick={() => setViewMode("list")} className={`size-9 rounded-md ${viewMode === "list" ? "bg-primary-600 text-white" : "text-ink/50"}`} aria-label="Vista de lista" title="Vista de lista"><List size={18} aria-hidden="true" /></button></div>
        </div>
      </div>
      {activeFilterCount > 0 && <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-ink/45">Filtros:</span>{filtroPastoral !== "all" && <FilterChip label={`Prioridad: ${filtroPastoral}`} onClear={() => setFiltroPastoral("all")} />}{filtroEdad !== "all" && <FilterChip label={`Edad: ${filtroEdad}`} onClear={() => setFiltroEdad("all")} />}{filtroEstado !== "all" && <FilterChip label={`Estado: ${TEEN_STATUS_META[filtroEstado].label}`} onClear={() => setFiltroEstado("all")} />}{filtroIntegracion !== "all" && <FilterChip label="Integración" onClear={() => setFiltroIntegracion("all")} />}{filtroResponsable !== "all" && <FilterChip label={filtroResponsable === "mine" ? "Mi cartera" : "Sin responsable"} onClear={() => setFiltroResponsable("all")} />}{filtroFicha !== "all" && <FilterChip label="Ficha incompleta" onClear={() => setFiltroFicha("all")} />}<button type="button" onClick={clearFilters} className="text-xs font-semibold text-primary-700 underline underline-offset-2">Limpiar filtros</button></div>}
    </div>

    {showFilters && <FilterPanel onClose={() => setShowFilters(false)} filtroPastoral={filtroPastoral} setFiltroPastoral={setFiltroPastoral} filtroEdad={filtroEdad} setFiltroEdad={setFiltroEdad} filtroEstado={filtroEstado} setFiltroEstado={setFiltroEstado} filtroIntegracion={filtroIntegracion} setFiltroIntegracion={setFiltroIntegracion} filtroResponsable={filtroResponsable} setFiltroResponsable={setFiltroResponsable} filtroFicha={filtroFicha} setFiltroFicha={setFiltroFicha} onClear={clearFilters} />}

    {upcoming.length > 0 && <section className="ui-card flex items-center gap-3 p-3"><span className="feature-icon feature-icon--warning"><Cake size={18} aria-hidden="true" /></span><div className="min-w-0"><p className="text-sm font-bold text-ink">Próximos cumpleaños</p><p className="mt-0.5 truncate text-xs text-ink/55">{upcoming.slice(0, 3).map((item) => `${item.t.nombre} (${item.days === 0 ? "hoy" : `en ${item.days}d`})`).join(" · ")}{upcoming.length > 3 ? ` · +${upcoming.length - 3}` : ""}</p></div></section>}

    {viewMode === "list" && canAssignLeaders && selectedTeenIds.length > 0 && <section className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-card border border-primary-200 bg-primary-50 p-3 shadow-soft"><strong className="text-sm text-primary-800">{selectedTeenIds.length} seleccionado{selectedTeenIds.length > 1 ? "s" : ""}</strong><select value={bulkLeaderId} onChange={(event) => setBulkLeaderId(event.target.value)} className="ui-input min-w-48 py-2 text-sm"><option value="">Elegir líder...</option>{assignableUsers.map((person: any) => <option key={person._id} value={person._id}>{person.name}</option>)}</select><button type="button" onClick={() => applyBulkLeader(false)} disabled={!bulkLeaderId} className="ui-button ui-button--primary text-sm disabled:opacity-40">Asignar líder</button><button type="button" onClick={() => applyBulkLeader(true)} className="ui-button ui-button--secondary text-sm">Usar líder del grupo</button><button type="button" onClick={() => setSelectedTeenIds([])} className="ui-button ui-button--ghost text-sm">Cancelar</button></section>}

    {teenData.length === 0 ? <div className="ui-card p-8 text-center"><Users className="mx-auto text-ink/30" size={30} aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-ink">{emptyMessage}</p><button type="button" onClick={() => { setQuickView("all"); setQuery(""); clearFilters(); }} className="mt-3 text-sm font-bold text-primary-700 underline underline-offset-2">Ver todos los adolescentes</button></div> : viewMode === "cards" ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{teenData.map((item) => <TeenCard key={item.t._id} item={item} onOpen={() => onOpenProfile(item.t._id)} />)}</div> : <TeenList items={teenData} onOpenProfile={onOpenProfile} canAssignLeaders={canAssignLeaders} selectedTeenIds={selectedTeenIds} setSelectedTeenIds={setSelectedTeenIds} selectedAllVisible={selectedAllVisible} onToggleVisible={toggleVisibleSelection} />}

    {showForm && <TeenForm onClose={() => setShowForm(false)} onSuccess={() => setShowForm(false)} />}
    {showQuickVisitor && <TeenForm quickVisitor onClose={() => setShowQuickVisitor(false)} onSuccess={() => setShowQuickVisitor(false)} />}
    {showPublicLink && <PublicRegistrationLinkModal token={token} scope={{ campusId: scope.campusId, ministryId: scope.ministryId, groupId: scope.groupId, label: scopeLabel }} onClose={() => setShowPublicLink(false)} />}
    {showImport && <TeenImportModal onClose={() => setShowImport(false)} onSuccess={() => setShowImport(false)} />}
  </div>;
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) { return <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 py-1 pl-2.5 pr-1 text-xs font-semibold text-primary-700">{label}<button type="button" onClick={onClear} className="grid size-5 place-items-center rounded-full hover:bg-primary-100" aria-label={`Quitar filtro ${label}`}><X size={13} aria-hidden="true" /></button></span>; }

function TeenCard({ item, onOpen }: { item: any; onOpen: () => void }) {
  const { t, age, status, leader, notice, completeness, latest } = item;
  const meta = statusMeta(status);
  return <button type="button" onClick={onOpen} className="ui-card min-h-56 p-4 text-left pressable hover:border-primary-200"><div className="flex items-start gap-3"><Avatar teen={t} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink">{esc(t.nombre)} {esc(t.apellido)}</p><p className="mt-1 text-xs text-ink/45">{age === null ? "Edad por registrar" : `${age} años`}</p><span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${meta.cls}`}>{meta.label}</span></div></div><div className="mt-4"><p className="text-xs font-semibold text-ink/45">Responsable</p><p className="mt-1 truncate text-sm font-semibold text-ink">{leader?.userName || "Sin responsable"}</p><p className="mt-0.5 text-xs text-ink/45">{sourceLabel(leader?.source)}</p></div><div className={`mt-3 rounded-lg border px-2.5 py-2 ${notice.className}`}><p className="text-xs font-bold">{notice.label}</p><p className="mt-0.5 truncate text-xs opacity-80">{notice.detail}</p></div><div className="mt-3"><div className="flex items-center justify-between text-xs"><span className="font-semibold text-ink/50">Ficha completa</span><span className="font-bold tabular-nums text-ink/65">{completeness.percent}%</span></div><div className="progress-track mt-1.5"><div className="progress-fill" style={{ width: `${completeness.percent}%` }} /></div></div>{latest && <p className="mt-3 truncate text-xs text-ink/45">Último registro: {latest.date} · {latest.status === "present" ? "Presente" : latest.status === "excused" ? "Justificado" : "Ausente"}</p>}</button>; }

function TeenList({ items, onOpenProfile, canAssignLeaders, selectedTeenIds, setSelectedTeenIds, selectedAllVisible, onToggleVisible }: any) { return <div className="ui-card overflow-x-auto"><table className="w-full min-w-[860px] text-left"><thead className="border-b border-ink/10 bg-ink/[0.02] text-xs uppercase text-ink/45"><tr>{canAssignLeaders && <th className="w-12 px-4 py-3"><input type="checkbox" checked={selectedAllVisible} onChange={onToggleVisible} aria-label="Seleccionar todos los adolescentes visibles" className="size-4 rounded border-ink/25 text-primary-600 focus:ring-primary-500" /></th>}<th className="px-4 py-3">Adolescente</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Responsable</th><th className="px-4 py-3">Próxima acción</th><th className="px-4 py-3">Prioridad</th><th className="px-4 py-3">Ficha</th></tr></thead><tbody>{items.map((item: any) => { const meta = statusMeta(item.status); return <tr key={item.t._id} className="border-b border-ink/5 last:border-0 hover:bg-primary-50/40">{canAssignLeaders && <td className="px-4 py-3"><input type="checkbox" checked={selectedTeenIds.includes(String(item.t._id))} onChange={(event) => setSelectedTeenIds((current: string[]) => event.target.checked ? [...current, String(item.t._id)] : current.filter((id) => id !== String(item.t._id)))} aria-label={`Seleccionar ${item.t.nombre} ${item.t.apellido}`} className="size-4 rounded border-ink/25 text-primary-600 focus:ring-primary-500" /></td>}<td className="px-4 py-3"><button type="button" onClick={() => onOpenProfile(item.t._id)} className="flex items-center gap-2 text-left"><Avatar teen={item.t} /><span><strong className="block max-w-44 truncate text-sm text-ink">{esc(item.t.nombre)} {esc(item.t.apellido)}</strong><small className="text-xs text-ink/45">{item.age === null ? "Edad por registrar" : `${item.age} años`}</small></span></button></td><td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${meta.cls}`}>{meta.label}</span></td><td className="px-4 py-3"><p className="max-w-40 truncate text-sm font-semibold text-ink">{item.leader?.userName || "Sin responsable"}</p><p className="text-xs text-ink/45">{sourceLabel(item.leader?.source)}</p></td><td className="px-4 py-3"><p className="max-w-56 truncate text-sm text-ink/70">{item.notice.detail}</p></td><td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${item.notice.className}`}>{item.notice.label}</span></td><td className="px-4 py-3"><span className="tabular-nums text-sm font-bold text-ink">{item.completeness.percent}%</span></td></tr>; })}</tbody></table></div>; }

function FilterPanel(props: any) { const { onClose, onClear } = props; return <><button type="button" className="fixed inset-0 z-40 bg-ink/20" aria-label="Cerrar filtros" onClick={onClose} /><aside className="fixed inset-x-4 top-20 z-50 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-card border border-ink/10 bg-card p-4 shadow-soft sm:left-auto sm:right-8 sm:w-[380px]"><div className="flex items-center justify-between"><div><h2 className="text-base font-bold text-ink">Filtros avanzados</h2><p className="mt-1 text-xs text-ink/50">Ajusta el listado del ámbito activo.</p></div><button type="button" onClick={onClose} className="ui-button ui-button--ghost size-10 p-0" aria-label="Cerrar filtros"><X size={18} aria-hidden="true" /></button></div><div className="mt-5 space-y-5"><FilterGroup label="Estado"><select value={props.filtroEstado} onChange={(event) => props.setFiltroEstado(event.target.value)} className="ui-input w-full"><option value="all">Todos los estados</option>{Object.entries(TEEN_STATUS_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}</select></FilterGroup><FilterGroup label="Nivel de integración"><select value={props.filtroIntegracion} onChange={(event) => props.setFiltroIntegracion(event.target.value)} className="ui-input w-full"><option value="all">Todos los niveles</option><option value="nuevo">Nuevo</option><option value="en_proceso">En proceso</option><option value="integrado">Integrado</option><option value="necesita_acompañamiento">Necesita acompañamiento</option></select></FilterGroup><FilterGroup label="Prioridad pastoral"><select value={props.filtroPastoral} onChange={(event) => props.setFiltroPastoral(event.target.value === "all" ? "all" : Number(event.target.value))} className="ui-input w-full"><option value="all">Todos los niveles</option><option value="0">Sin riesgo</option><option value="1">Seguimiento</option><option value="2">Atención</option><option value="3">Urgente</option><option value="4">Crítico</option><option value="5">Crisis</option></select></FilterGroup><FilterGroup label="Edad"><select value={props.filtroEdad} onChange={(event) => props.setFiltroEdad(event.target.value)} className="ui-input w-full"><option value="all">Todas las edades</option><option value="12-13">12-13 años</option><option value="14-15">14-15 años</option><option value="16-17">16-17 años</option><option value="18+">18 o más</option></select></FilterGroup><FilterGroup label="Responsable"><select value={props.filtroResponsable} onChange={(event) => props.setFiltroResponsable(event.target.value)} className="ui-input w-full"><option value="all">Todos</option><option value="mine">Mi cartera</option><option value="unassigned">Sin responsable</option></select></FilterGroup><FilterGroup label="Ficha"><select value={props.filtroFicha} onChange={(event) => props.setFiltroFicha(event.target.value)} className="ui-input w-full"><option value="all">Todas las fichas</option><option value="incomplete">Solo fichas incompletas</option></select></FilterGroup></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClear} className="ui-button ui-button--secondary">Limpiar</button><button type="button" onClick={onClose} className="ui-button ui-button--primary">Aplicar</button></div></aside></>; }

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-ink/55">{label}</span>{children}</label>; }
