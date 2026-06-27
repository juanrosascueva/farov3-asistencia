import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const run = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("teens").first();
    if (existing) {
      return { skipped: true, message: "Ya hay datos - seed ignorado" };
    }

    const teen1 = await ctx.db.insert("teens", {
      nombre: "Valentina",
      apellido: "Rojas",
      nacimiento: "2010-03-14",
      telefono: "0414-1234567",
      telefonoPadre: "0424-7654321",
      gustos: "Dibujo, K-pop, voleibol",
      notas: "",
      foto: "",
    });

    const teen2 = await ctx.db.insert("teens", {
      nombre: "Samuel",
      apellido: "Pérez",
      nacimiento: "2009-11-02",
      telefono: "0412-9988776",
      telefonoPadre: "0416-1122334",
      gustos: "Fútbol, videojuegos",
      notas: "",
      foto: "",
    });

    const teen3 = await ctx.db.insert("teens", {
      nombre: "Camila",
      apellido: "Torres",
      nacimiento: "2011-07-22",
      telefono: "",
      telefonoPadre: "0414-5566778",
      gustos: "Música, guitarra",
      notas: "Le cuesta integrarse, seguir de cerca",
      foto: "",
    });

    const ids = [teen1, teen2, teen3];
    const today = new Date();
    const dow = today.getDay();
    today.setDate(today.getDate() - dow);

    for (let i = 7; i >= 0; i--) {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - 7 * i);
      const date = dt.toISOString().slice(0, 10);

      const statuses: ("present" | "absent" | "excused")[] = [];
      ids.forEach((_, ti) => {
        let status: "present" | "absent" | "excused" = "present";
        if (ti === 2 && i >= 6) status = "absent";
        if (ti === 1 && i === 6) status = "excused";
        statuses.push(status);
      });

      for (let ti = 0; ti < ids.length; ti++) {
        await ctx.db.insert("attendance", {
          date,
          teenId: ids[ti],
          status: statuses[ti],
        });
      }
    }

    return {
      skipped: false,
      message: `Creados ${ids.length} adolescentes con 8 semanas de asistencia`,
    };
  },
});
