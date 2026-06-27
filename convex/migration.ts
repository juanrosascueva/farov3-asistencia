import { mutation } from "./_generated/server";

export const assignLegacyTeens = mutation({
  handler: async (ctx) => {
    const teens = await ctx.db.query("teens").collect();
    const unassigned = teens.filter(t => !t.campusId);

    if (unassigned.length === 0) {
      return { migrated: 0, message: "Todos los teens ya tienen asignación" };
    }

    let campusId = (await ctx.db.query("campus").first())?._id;
    if (!campusId) {
      campusId = await ctx.db.insert("campus", {
        name: "Sede Principal",
        createdAt: new Date().toISOString(),
      });
    }

    let ministryId = await ctx.db
      .query("ministry")
      .withIndex("by_campusId", q => q.eq("campusId", campusId!))
      .first()
      .then(m => m?._id);

    if (!ministryId) {
      ministryId = await ctx.db.insert("ministry", {
        campusId: campusId!,
        name: "Adolescentes",
        createdAt: new Date().toISOString(),
      });
    }

    let groupId = await ctx.db
      .query("group")
      .withIndex("by_ministryId", q => q.eq("ministryId", ministryId!))
      .first()
      .then(g => g?._id);

    if (!groupId) {
      groupId = await ctx.db.insert("group", {
        ministryId: ministryId!,
        name: "Grupo Único",
        createdAt: new Date().toISOString(),
      });
    }

    for (const teen of unassigned) {
      await ctx.db.patch(teen._id, {
        campusId: campusId!,
        ministryId: ministryId!,
        groupId: groupId!,
      });
    }

    return {
      migrated: unassigned.length,
      message: `Asignados ${unassigned.length} teens a Sede Principal > Adolescentes > Grupo Único`,
    };
  },
});
