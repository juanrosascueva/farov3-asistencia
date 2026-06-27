export interface Template {
  label: string;
  message: string;
  emoji: string;
}

function fill(template: string, nombre: string): string {
  return template.replace(/\{nombre\}/g, nombre);
}

export function getTemplates(
  level: string,
  nombre: string,
  consecutives: number
): Template[] {
  const name = nombre;

  if (level === "teal" || level === "check") {
    return [
      {
        label: "Seguimiento",
        emoji: "🟡",
        message: fill(
          `¡Hola {nombre}! 💙\n\nTe escribimos porque te extrañamos el domingo. Queríamos saber cómo estás y si todo está bien. Recuerda que aquí estamos para ti, y nos encantaría verte este próximo domingo. ¡Te esperamos con mucho cariño! 🙏✨`,
          name
        ),
      },
      {
        label: "Alternativo (familia)",
        emoji: "🟡",
        message: fill(
          `Hola, somos del ministerio de adolescentes Faro. Queríamos saber cómo está {nombre}, lo extrañamos el domingo. ¿Hay algo en que podamos ayudar? 🙏`,
          name
        ),
      },
    ];
  }

  if (level === "amber" || level === "urgent") {
    return [
      {
        label: "Dos faltas",
        emoji: "🟠",
        message: fill(
          `¡Hola {nombre}! Te extrañamos un montón en las últimas dos reuniones. Queríamos saber cómo estás y si podemos apoyarte en algo o acompañarte en oración esta semana. ¡Un abrazo fuerte! 🙏🏼✨`,
          name
        ),
      },
      {
        label: "Alternativo (familia)",
        emoji: "🟠",
        message: fill(
          `Hola, somos del ministerio Faro. {nombre} ha faltado dos semanas seguidas y queremos saber cómo está. ¿Podemos comunicarnos con él/ella o hay algo que debamos saber? Gracias 🙏`,
          name
        ),
      },
    ];
  }

  // critical / coral
  return [
    {
      label: "Alerta crítica",
      emoji: "🔴",
      message: fill(
        `¡Hola {nombre}! 🙏 Hace varias semanas que no te vemos y estamos preocupados por ti. Queremos que sepas que te apreciamos mucho y que aquí hay una comunidad que te ama y te extraña. ¿Podemos visitarte, conversar contigo o apoyarte en algo? Eres importante para nosotros. 💙✨`,
        name
      ),
    },
    {
      label: "Alternativo (familia)",
      emoji: "🔴",
      message: fill(
        `Hola, somos del ministerio de adolescentes Faro. Estamos preocupados porque {nombre} lleva ${consecutives} semanas sin asistir. Nos encantaría hacer una visita o conversar con ustedes para saber cómo está y en qué podemos apoyar. ¿Podemos coordinar? 🙏`,
        name
      ),
    },
    {
      label: "Visita pastoral",
      emoji: "🔴",
      message: fill(
        `Hola {nombre}, te escribimos con mucho cariño. Sabemos que has estado ausente y queremos que sepas que siempre tienes un lugar aquí. ¿Te gustaría que pasemos a verte o conversar? Queremos lo mejor para ti. ¡Te esperamos! 💙🙏✨`,
        name
      ),
    },
  ];
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
