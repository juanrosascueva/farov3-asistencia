export interface Template {
  label: string;
  message: string;
  emoji: string;
  category: "absence" | "streak" | "birthday" | "general";
}

export interface Vars {
  nombre: string;
  apellido: string;
  racha: number;
  faltas: number;
  telefonoPadre: string;
}

export function fill(t: string, v: Vars): string {
  return t
    .replace(/\{nombre\}/g, v.nombre)
    .replace(/\{apellido\}/g, v.apellido)
    .replace(/\{racha\}/g, String(v.racha))
    .replace(/\{faltas\}/g, String(v.faltas))
    .replace(/\{telefono_padre\}/g, v.telefonoPadre);
}

const RAW: { category: Template["category"]; emoji: string; label: string; message: string }[] = [
  // ── Ausencias ──
  {
    category: "absence",
    emoji: "🟡",
    label: "Una falta",
    message:
      "¡Hola {nombre}! Te extrañamos este fin de semana en la reunión del ministerio. Espero que todo esté súper bien por ahí. ¿Cómo te ha ido esta semana? Te mandamos un fuerte abrazo.",
  },
  {
    category: "absence",
    emoji: "🟠",
    label: "Dos faltas",
    message:
      "¡Hola {nombre}! Pasaba a saludarte y ver cómo has estado. Notamos que no pudiste venir las últimas {faltas} semanas y queríamos asegurarnos de que estés bien. Si necesitas hablar o que oremos por algo especial, ¡aquí estamos siempre!",
  },
  {
    category: "absence",
    emoji: "🔴",
    label: "Alerta crítica",
    message:
      "Estimado tutor, le saludamos del Ministerio de Adolescentes de la Iglesia. Hemos extrañado a {nombre} {apellido} en nuestras últimas actividades y reuniones de las últimas semanas. Queríamos ponernos a su disposición por si hay alguna necesidad familiar o pastoral en la que podamos acompañarles u orar por ustedes. ¡Un saludo y bendiciones!",
  },
  {
    category: "absence",
    emoji: "🔴",
    label: "Visita pastoral",
    message:
      "¡Hola {nombre}! 🙏 Hace varias semanas que no te vemos y estamos preocupados por ti. Queremos que sepas que te apreciamos mucho y que aquí hay una comunidad que te ama y te extraña. ¿Podemos visitarte, conversar contigo o apoyarte en algo? Eres importante para nosotros. 💙✨",
  },
  // ── Racha ──
  {
    category: "streak",
    emoji: "🔥",
    label: "Felicitación por racha",
    message:
      "¡Qué grande, {nombre}! Qué alegría ver tu constancia y tu racha de 🔥 {racha} semanas consecutivas viniendo al grupo. Eres de muchísima bendición y un ejemplo hermoso para todos tus compañeros. ¡Nos vemos este domingo!",
  },
  // ── Cumpleaños ──
  {
    category: "birthday",
    emoji: "🎉",
    label: "Cumpleaños",
    message:
      "¡Feliz cumpleaños, {nombre}! 🥳🎂 Esperamos que pases un día increíble lleno de la bendición de Dios. Estamos sumamente agradecidos por tu vida en nuestro ministerio de jóvenes. ¡Te mandamos un súper abrazo!",
  },
  // ── General ──
  {
    category: "general",
    emoji: "💬",
    label: "Saludo general",
    message:
      "¡Hola {nombre}! 💙 Solo queríamos saludarte y recordarte que eres importante para nosotros. Esperamos que tengas una semana súper bendecida. ¡Nos vemos este domingo! 🙏✨",
  },
];

export function getTemplates(
  level: string,
  nombre: string,
  consecutives: number,
  apellido = "",
  racha = 0,
  telefonoPadre = ""
): Template[] {
  const v: Vars = { nombre, apellido, racha, faltas: consecutives, telefonoPadre };

  if (level === "teal" || level === "check") {
    return [
      { ...RAW[0], message: fill(RAW[0].message, v) },
      {
        category: "absence",
        emoji: "🟡",
        label: "Alternativo (familia)",
        message: fill(
          `Hola, somos del ministerio de adolescentes Faro. Queríamos saber cómo está {nombre}, lo extrañamos el domingo. ¿Hay algo en que podamos ayudar? 🙏`,
          v
        ),
      },
    ];
  }

  if (level === "amber" || level === "urgent") {
    return [
      { ...RAW[1], message: fill(RAW[1].message, v) },
      {
        category: "absence",
        emoji: "🟠",
        label: "Alternativo (familia)",
        message: fill(
          `Hola, somos del ministerio Faro. {nombre} ha faltado dos semanas seguidas y queremos saber cómo está. ¿Podemos comunicarnos con él/ella o hay algo que debamos saber? Gracias 🙏`,
          v
        ),
      },
    ];
  }

  return [
    { ...RAW[2], message: fill(RAW[2].message, v) },
    { ...RAW[3], message: fill(RAW[3].message, v) },
    {
      category: "absence",
      emoji: "🔴",
      label: "Alternativo (familia)",
      message: fill(
        `Hola, somos del ministerio de adolescentes Faro. Estamos preocupados porque {nombre} lleva {faltas} semanas sin asistir. Nos encantaría hacer una visita o conversar con ustedes para saber cómo está y en qué podemos apoyar. ¿Podemos coordinar? 🙏`,
        v
      ),
    },
  ];
}

export function getAllTemplates(
  nombre: string,
  apellido: string,
  racha: number,
  faltas: number,
  telefonoPadre: string
): Template[] {
  const v: Vars = { nombre, apellido, racha, faltas, telefonoPadre };
  return RAW.map((r) => ({ ...r, message: fill(r.message, v) }));
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 11 && digits.startsWith("0")) {
    return "58" + digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith("58")) {
    return digits;
  }
  return digits;
}

export function whatsAppUrl(phone: string, text: string): string {
  const clean = formatPhone(phone);
  const encoded = encodeURIComponent(text);
  return `https://wa.me/${clean}?text=${encoded}`;
}
