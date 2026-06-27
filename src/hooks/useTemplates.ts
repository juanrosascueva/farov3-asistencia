import { useState, useCallback } from "react";
import type { MessageTemplate } from "../lib/types";

const TEMPLATES_KEY = "cristovive_templates_v1";

function seedTemplates(): MessageTemplate[] {
  return [
    { id: "t1", name: "Una falta", category: "absence", recipient: "teen", emoji: "🟡", text: "¡Hola {nombre}! Te extrañamos este fin de semana en la reunión del ministerio. Espero que todo esté súper bien por ahí. ¿Cómo te ha ido esta semana? Te mandamos un fuerte abrazo." },
    { id: "t2", name: "Dos faltas", category: "absence", recipient: "teen", emoji: "🟠", text: "¡Hola {nombre}! Pasaba a saludarte y ver cómo has estado. Notamos que no pudiste venir las últimas {faltas} semanas y queríamos asegurarnos de que estés bien. Si necesitas hablar o que oremos por algo especial, ¡aquí estamos siempre!" },
    { id: "t3", name: "Alerta crítica (tutor)", category: "absence", recipient: "parent", emoji: "🔴", text: "Estimado tutor, le saludamos del Ministerio de Adolescentes de la Iglesia. Hemos extrañado a {nombre} {apellido} en nuestras últimas actividades y reuniones de las últimas semanas. Queríamos ponernos a su disposición por si hay alguna necesidad familiar o pastoral en la que podamos acompañarles u orar por ustedes. ¡Un saludo y bendiciones!" },
    { id: "t4", name: "Visita pastoral", category: "absence", recipient: "teen", emoji: "🔴", text: "¡Hola {nombre}! 🙏 Hace varias semanas que no te vemos y estamos preocupados por ti. Queremos que sepas que te apreciamos mucho y que aquí hay una comunidad que te ama y te extraña. ¿Podemos visitarte, conversar contigo o apoyarte en algo? Eres importante para nosotros. 💙✨" },
    { id: "t5", name: "Felicitación por racha", category: "streak", recipient: "teen", emoji: "🔥", text: "¡Qué grande, {nombre}! Qué alegría ver tu constancia y tu racha de 🔥 {racha} semanas consecutivas viniendo al grupo. Eres de muchísima bendición y un ejemplo hermoso para todos tus compañeros. ¡Nos vemos este domingo!" },
    { id: "t6", name: "Cumpleaños", category: "birthday", recipient: "teen", emoji: "🎉", text: "¡Feliz cumpleaños, {nombre}! 🥳🎂 Esperamos que pases un día increíble lleno de la bendición de Dios. Estamos sumamente agradecidos por tu vida en nuestro ministerio de jóvenes. ¡Te mandamos un súper abrazo!" },
    { id: "t7", name: "Saludo general", category: "general", recipient: "teen", emoji: "💬", text: "¡Hola {nombre}! 💙 Solo queríamos saludarte y recordarte que eres importante para nosotros. Esperamos que tengas una semana súper bendecida. ¡Nos vemos este domingo! 🙏✨" },
  ];
}

function loadTemplates(): MessageTemplate[] {
  try {
    const data = localStorage.getItem(TEMPLATES_KEY);
    if (data) return JSON.parse(data);
  } catch {}
  const defaults = seedTemplates();
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(defaults));
  return defaults;
}

export function useTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>(loadTemplates);

  const saveTemplates = useCallback((next: MessageTemplate[]) => {
    setTemplates(next);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
  }, []);

  const addTemplate = useCallback(
    (tpl: Omit<MessageTemplate, "id">) => {
      const newTpl: MessageTemplate = { id: "t_" + Date.now(), ...tpl };
      saveTemplates([...templates, newTpl]);
    },
    [templates, saveTemplates]
  );

  const updateTemplate = useCallback(
    (id: string, patch: Partial<MessageTemplate>) => {
      saveTemplates(
        templates.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
    },
    [templates, saveTemplates]
  );

  const deleteTemplate = useCallback(
    (id: string) => {
      saveTemplates(templates.filter((t) => t.id !== id));
    },
    [templates, saveTemplates]
  );

  const resetTemplates = useCallback(() => {
    saveTemplates(seedTemplates());
  }, [saveTemplates]);

  return {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    resetTemplates,
  };
}
