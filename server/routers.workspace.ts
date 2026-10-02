import { and, desc, eq, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { auditLogs, collaborationItems, collaborationReplies, dailyReports, dailyTargets, monthlyTargets, openingNodes, operationSummaries, reportTemplateFields, reportTemplates, retrospectives, specialDates, stores, users } from "../drizzle/schema";
import { getDb } from "./db";
import { getAppRole, canEditStoreRecord, requireRole, requireStoreScope } from "./permissions";
import { protectedProcedure, router } from "./_core/trpc";

const dbOrThrow = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "云端数据库暂不可用" });
  return db;
};

const writeAudit = async (db: Awaited<ReturnType<typeof dbOrThrow>>, user: Parameters<typeof getAppRole>[0], action: string, target: string, detail: string) => {
  await db.insert(auditLogs).values({ action, target, detail, actorName: user.name || "未命名用户", actorOpenId: user.openId, actorRole: getAppRole(user) });
};

const reportInput = z.object({
  storeName: z.string().min(1).max(120),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weather: z.enum(["晴", "阴", "雨", "雪"]).default("晴"),
  revenue: z.number().nonnegative().default(0),
  traffic: z.number().nonnegative().default(0),
  avgTicket: z.number().nonnegative().default(0),
  wasteAmount: z.number().nonnegative().default(0),
  tastingAmount: z.number().nonnegative().default(0),
  praiseCount: z.number().nonnegative().default(0),
  customFields: z.record(z.string(), z.string()).default({}),
  issue: z.string().max(5000).optional(),
  todayDone: z.string().max(5000).optional(),
  nextPlan: z.string().max(5000).optional(),
});

const collaborationInput = z.object({
  type: z.enum(["suggestion", "issue"]),
  storeName: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  content: z.string().min(1).max(5000),
});

export const workspaceRouter = router({
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    name: ctx.user.name,
    email: ctx.user.email,
    role: getAppRole(ctx.user),
    storeName: ctx.user.storeName,
  })),

  stores: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const rows = await db.select({ id: stores.id, name: stores.name, managerName: stores.managerName, monthlyTargetWan: stores.monthlyTargetWan, status: stores.status, openingDate: stores.openingDate }).from(stores).orderBy(stores.name);
    return getAppRole(ctx.user) === "store" ? rows.filter(row => row.name === ctx.user.storeName) : rows;
  }),

  listTargets: protectedProcedure.input(z.object({ storeName: z.string().optional(), month: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await dbOrThrow(); const requestedStore = input?.storeName || (getAppRole(ctx.user) === "store" ? ctx.user.storeName : undefined); if (requestedStore) requireStoreScope(ctx.user, requestedStore);
    const filters = []; if (requestedStore) filters.push(eq(monthlyTargets.storeName, requestedStore)); if (input?.month) filters.push(eq(monthlyTargets.month, input.month));
    return db.select().from(monthlyTargets).where(filters.length ? and(...filters) : undefined).orderBy(desc(monthlyTargets.month));
  }),

  listDailyTargets: protectedProcedure.input(z.object({ storeName: z.string().optional(), month: z.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow(); const requestedStore = input.storeName || (getAppRole(ctx.user) === "store" ? ctx.user.storeName : undefined); if (requestedStore) requireStoreScope(ctx.user, requestedStore);
    return db.select().from(dailyTargets).where(and(eq(dailyTargets.storeName, requestedStore || ""), gte(dailyTargets.targetDate, `${input.month}-01`), lte(dailyTargets.targetDate, `${input.month}-31`))).orderBy(dailyTargets.targetDate);
  }),

  upsertDailyTarget: protectedProcedure.input(z.object({ storeName: z.string().min(1), targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), targetAmount: z.number().nonnegative() })).mutation(async ({ ctx, input }) => {
    requireRole(ctx.user, ["admin", "operator", "store"]); requireStoreScope(ctx.user, input.storeName); const db = await dbOrThrow(); const [old] = await db.select({ id: dailyTargets.id }).from(dailyTargets).where(and(eq(dailyTargets.storeName, input.storeName), eq(dailyTargets.targetDate, input.targetDate))).limit(1);
    if (old) await db.update(dailyTargets).set({ targetAmount: input.targetAmount }).where(eq(dailyTargets.id, old.id)); else await db.insert(dailyTargets).values(input); await writeAudit(db, ctx.user, "更新每日目标", `${input.storeName} · ${input.targetDate}`, `目标 ¥${input.targetAmount}`); return { success: true } as const;
  }),

  upsertTarget: protectedProcedure.input(z.object({ storeName: z.string().min(1), month: z.string().regex(/^\d{4}-\d{2}$/), monthlyTarget: z.number().nonnegative(), week1: z.number().nonnegative(), week2: z.number().nonnegative(), week3: z.number().nonnegative(), week4: z.number().nonnegative(), week5: z.number().nonnegative() })).mutation(async ({ ctx, input }) => {
    requireRole(ctx.user, ["admin", "operator", "store"]); requireStoreScope(ctx.user, input.storeName); const db = await dbOrThrow();
    const [old] = await db.select({ id: monthlyTargets.id }).from(monthlyTargets).where(and(eq(monthlyTargets.storeName, input.storeName), eq(monthlyTargets.month, input.month))).limit(1);
    if (old) await db.update(monthlyTargets).set(input).where(eq(monthlyTargets.id, old.id)); else await db.insert(monthlyTargets).values(input);
    await writeAudit(db, ctx.user, "更新月度目标", `${input.storeName} · ${input.month}`, `月目标 ${input.monthlyTarget}`); return { success: true } as const;
  }),

  listTasks: protectedProcedure.input(z.object({ storeName: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await dbOrThrow(); const requestedStore = input?.storeName || (getAppRole(ctx.user) === "store" ? ctx.user.storeName : undefined); if (requestedStore) requireStoreScope(ctx.user, requestedStore);
    return db.select().from(openingNodes).where(requestedStore ? eq(openingNodes.storeName, requestedStore) : undefined).orderBy(openingNodes.planDate, openingNodes.id);
  }),

  createTask: protectedProcedure.input(z.object({ storeName: z.string().min(1), nodeName: z.string().min(1).max(160), planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), owner: z.string().min(1).max(80) })).mutation(async ({ ctx, input }) => {
    requireRole(ctx.user, ["admin", "operator"]); const db = await dbOrThrow(); const [created] = await db.insert(openingNodes).values({ ...input, status: "未开始", completed: false }).$returningId(); await writeAudit(db, ctx.user, "下发门店任务", `${input.storeName} · ${input.planDate}`, input.nodeName); return { id: created.id };
  }),

  updateTask: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["未开始", "进行中", "已完成"]), completed: z.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow(); const [task] = await db.select().from(openingNodes).where(eq(openingNodes.id, input.id)).limit(1); if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" }); requireStoreScope(ctx.user, task.storeName); await db.update(openingNodes).set({ status: input.status, completed: input.completed }).where(eq(openingNodes.id, input.id)); return { success: true } as const;
  }),

  listSummaries: protectedProcedure.input(z.object({ storeName: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await dbOrThrow(); const requestedStore = input?.storeName || (getAppRole(ctx.user) === "store" ? ctx.user.storeName : undefined); if (requestedStore) requireStoreScope(ctx.user, requestedStore); return db.select().from(operationSummaries).where(requestedStore ? eq(operationSummaries.storeName, requestedStore) : undefined).orderBy(desc(operationSummaries.period));
  }),

  upsertSummary: protectedProcedure.input(z.object({ storeName: z.string().min(1), period: z.string().min(1).max(20), type: z.enum(["日报", "周报", "月报"]), summary: z.string().min(1), plan: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    requireStoreScope(ctx.user, input.storeName); const db = await dbOrThrow(); const [old] = await db.select({ id: operationSummaries.id }).from(operationSummaries).where(and(eq(operationSummaries.storeName, input.storeName), eq(operationSummaries.period, input.period), eq(operationSummaries.type, input.type))).limit(1); if (old) await db.update(operationSummaries).set(input).where(eq(operationSummaries.id, old.id)); else await db.insert(operationSummaries).values(input); await writeAudit(db, ctx.user, "保存周期总结", `${input.storeName} · ${input.type} · ${input.period}`, input.summary); return { success: true } as const;
  }),

  listReports: protectedProcedure
    .input(z.object({ storeName: z.string().optional(), startDate: z.string().optional(), endDate: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const requestedStore = input?.storeName || (getAppRole(ctx.user) === "store" ? ctx.user.storeName : undefined);
      if (getAppRole(ctx.user) === "store" && !requestedStore) throw new TRPCError({ code: "FORBIDDEN", message: "店长尚未绑定门店" });
      if (requestedStore) requireStoreScope(ctx.user, requestedStore);
      const filters = [];
      if (requestedStore) filters.push(eq(dailyReports.storeName, requestedStore));
      if (input?.startDate) filters.push(gte(dailyReports.reportDate, input.startDate));
      if (input?.endDate) filters.push(lte(dailyReports.reportDate, input.endDate));
      return db.select().from(dailyReports).where(filters.length ? and(...filters) : undefined).orderBy(desc(dailyReports.reportDate), desc(dailyReports.id));
    }),

  createReport: protectedProcedure.input(reportInput).mutation(async ({ ctx, input }) => {
    const role = requireStoreScope(ctx.user, input.storeName);
    if (role !== "admin" && role !== "operator" && role !== "store") throw new TRPCError({ code: "FORBIDDEN", message: "当前角色不能提交日报" });
    const db = await dbOrThrow();
    const existing = await db.select({ id: dailyReports.id }).from(dailyReports).where(and(eq(dailyReports.storeName, input.storeName), eq(dailyReports.reportDate, input.reportDate))).limit(1);
    if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "该门店当天已经有日报" });
    const { customFields, ...reportValues } = input;
    const [created] = await db.insert(dailyReports).values({ ...reportValues, customMetrics: JSON.stringify(customFields), reporter: ctx.user.name || "未命名用户", submitted: true, issueStatus: input.issue ? "待处理" : "已解决" }).$returningId();
    await writeAudit(db, ctx.user, "提交日报", `${input.storeName} · ${input.reportDate}`, `实收 ${input.revenue}`);
    return { id: created.id };
  }),

  updateReport: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: reportInput.partial() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [old] = await db.select().from(dailyReports).where(eq(dailyReports.id, input.id)).limit(1);
    if (!old) throw new TRPCError({ code: "NOT_FOUND", message: "日报不存在" });
    canEditStoreRecord(ctx.user, old.storeName, old.reporter);
    if (input.data.storeName && input.data.storeName !== old.storeName) requireRole(ctx.user, ["admin", "operator"]);
    const { customFields, ...reportValues } = input.data;
    await db.update(dailyReports).set({ ...reportValues, ...(customFields ? { customMetrics: JSON.stringify(customFields) } : {}), issueStatus: input.data.issue !== undefined ? (input.data.issue ? "待处理" : "已解决") : undefined }).where(eq(dailyReports.id, input.id));
    return { success: true } as const;
  }),

  deleteReport: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [old] = await db.select().from(dailyReports).where(eq(dailyReports.id, input.id)).limit(1);
    if (!old) throw new TRPCError({ code: "NOT_FOUND", message: "日报不存在" });
    const role = canEditStoreRecord(ctx.user, old.storeName, old.reporter);
    if (role !== "admin" && role !== "store") throw new TRPCError({ code: "FORBIDDEN", message: "运营不能删除日报" });
    const result = await db.delete(dailyReports).where(eq(dailyReports.id, input.id));
    if (!result[0]?.affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "日报不存在" });
    await writeAudit(db, ctx.user, "删除日报", `${old.storeName} · ${old.reportDate}`, "删除本人提交的日报");
    return { success: true } as const;
  }),

  listCollaboration: protectedProcedure.input(z.object({ storeName: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const requestedStore = input?.storeName || (getAppRole(ctx.user) === "store" ? ctx.user.storeName : undefined);
    if (getAppRole(ctx.user) === "store" && !requestedStore) throw new TRPCError({ code: "FORBIDDEN", message: "店长尚未绑定门店" });
    if (requestedStore) requireStoreScope(ctx.user, requestedStore);
    const items = await db.select().from(collaborationItems).where(requestedStore ? eq(collaborationItems.storeName, requestedStore) : undefined).orderBy(desc(collaborationItems.updatedAt));
    return Promise.all(items.map(async item => ({ ...item, replies: await db.select().from(collaborationReplies).where(eq(collaborationReplies.itemId, item.id)).orderBy(collaborationReplies.createdAt) })));
  }),

  createCollaboration: protectedProcedure.input(collaborationInput).mutation(async ({ ctx, input }) => {
    requireStoreScope(ctx.user, input.storeName);
    const db = await dbOrThrow();
    const [created] = await db.insert(collaborationItems).values({ ...input, authorName: ctx.user.name || "未命名用户", authorOpenId: ctx.user.openId, status: "待查看" }).$returningId();
    await writeAudit(db, ctx.user, input.type === "issue" ? "提交问题" : "提交建议", `协作 #${created.id}`, input.title);
    return { id: created.id };
  }),

  replyCollaboration: protectedProcedure.input(z.object({ itemId: z.number().int().positive(), body: z.string().min(1).max(5000) })).mutation(async ({ ctx, input }) => {
    const role = requireRole(ctx.user, ["admin", "operator"]);
    const db = await dbOrThrow();
    const [item] = await db.select().from(collaborationItems).where(eq(collaborationItems.id, input.itemId)).limit(1);
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "协作事项不存在" });
    await db.insert(collaborationReplies).values({ itemId: item.id, authorName: ctx.user.name || "未命名用户", authorRole: role, body: input.body });
    await db.update(collaborationItems).set({ status: item.type === "issue" ? "处理中" : "已回复" }).where(eq(collaborationItems.id, item.id));
    await writeAudit(db, ctx.user, "回复协作事项", `协作 #${item.id}`, input.body);
    return { success: true } as const;
  }),

  updateCollaborationStatus: protectedProcedure.input(z.object({ itemId: z.number().int().positive(), status: z.enum(["待查看", "处理中", "已回复", "已解决"]) })).mutation(async ({ ctx, input }) => {
    requireRole(ctx.user, ["admin", "operator"]);
    const db = await dbOrThrow();
    const result = await db.update(collaborationItems).set({ status: input.status }).where(eq(collaborationItems.id, input.itemId));
    if (!result[0]?.affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "协作事项不存在" });
    await writeAudit(db, ctx.user, "更新协作状态", `协作 #${input.itemId}`, input.status);
    return { success: true } as const;
  }),

  listRetrospectives: protectedProcedure.input(z.object({ storeName: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const requestedStore = input?.storeName || (getAppRole(ctx.user) === "store" ? ctx.user.storeName : undefined);
    if (getAppRole(ctx.user) === "store" && !requestedStore) throw new TRPCError({ code: "FORBIDDEN", message: "店长尚未绑定门店" });
    if (requestedStore) requireStoreScope(ctx.user, requestedStore);
    const rows = await db.select().from(retrospectives).where(requestedStore ? eq(retrospectives.storeName, requestedStore) : undefined).orderBy(desc(retrospectives.retroDate), desc(retrospectives.id));
    return rows.map(row => ({ ...row, tags: (() => { try { return JSON.parse(row.tags) as string[]; } catch { return []; } })() }));
  }),

  createRetrospective: protectedProcedure.input(z.object({ storeName: z.string().min(1).max(120), title: z.string().min(1).max(160), body: z.string().min(1).max(10000), tags: z.array(z.string().max(40)).max(8).default([]), retroDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), mood: z.enum(["顺利", "有收获", "需跟进"]).default("有收获") })).mutation(async ({ ctx, input }) => {
    requireStoreScope(ctx.user, input.storeName);
    const db = await dbOrThrow();
    const [created] = await db.insert(retrospectives).values({ storeName: input.storeName, title: input.title, body: input.body, tags: JSON.stringify(input.tags), retroDate: input.retroDate, mood: input.mood, authorName: ctx.user.name || "未命名用户", authorOpenId: ctx.user.openId }).$returningId();
    await writeAudit(db, ctx.user, "新增复盘备忘", `复盘 #${created.id}`, input.title);
    return { id: created.id };
  }),

  updateRetrospective: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: z.object({ title: z.string().min(1).max(160), body: z.string().min(1).max(10000), tags: z.array(z.string().max(40)).max(8), mood: z.enum(["顺利", "有收获", "需跟进"]) }) })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [row] = await db.select().from(retrospectives).where(eq(retrospectives.id, input.id)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "复盘不存在" });
    if (getAppRole(ctx.user) === "store") { requireStoreScope(ctx.user, row.storeName); if (row.authorOpenId !== ctx.user.openId) throw new TRPCError({ code: "FORBIDDEN", message: "只能编辑自己创建的复盘" }); } else requireRole(ctx.user, ["admin", "operator"]);
    await db.update(retrospectives).set({ title: input.data.title, body: input.data.body, tags: JSON.stringify(input.data.tags), mood: input.data.mood }).where(eq(retrospectives.id, input.id));
    await writeAudit(db, ctx.user, "编辑复盘备忘", `复盘 #${input.id}`, input.data.title);
    return { success: true } as const;
  }),

  deleteRetrospective: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [row] = await db.select().from(retrospectives).where(eq(retrospectives.id, input.id)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "复盘不存在" });
    if (getAppRole(ctx.user) === "store") { requireStoreScope(ctx.user, row.storeName); if (row.authorOpenId !== ctx.user.openId) throw new TRPCError({ code: "FORBIDDEN", message: "只能删除自己创建的复盘" }); } else requireRole(ctx.user, ["admin", "operator"]);
    await db.delete(retrospectives).where(eq(retrospectives.id, input.id));
    return { success: true } as const;
  }),

  listSpecialDates: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const rows = await db.select().from(specialDates).orderBy(specialDates.date, specialDates.id);
    const role = getAppRole(ctx.user);
    return rows.map(row => ({ ...row, stores: (() => { try { return JSON.parse(row.stores) as string[]; } catch { return []; } })() })).filter(row => role !== "store" || row.stores.includes("全部门店") || row.stores.includes(ctx.user.storeName || ""));
  }),

  createSpecialDate: protectedProcedure.input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), label: z.string().min(1).max(160), type: z.enum(["节假日", "活动日", "特别销售"]), note: z.string().max(5000).default(""), stores: z.array(z.string().min(1)).min(1).max(50) })).mutation(async ({ ctx, input }) => {
    requireRole(ctx.user, ["admin", "operator"]);
    const db = await dbOrThrow();
    const [created] = await db.insert(specialDates).values({ ...input, stores: JSON.stringify(input.stores), createdBy: ctx.user.name || "未命名用户" }).$returningId();
    await writeAudit(db, ctx.user, "新增特殊日期", `标注 #${created.id}`, input.label);
    return { id: created.id };
  }),

  updateSpecialDate: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), label: z.string().min(1).max(160).optional(), type: z.enum(["节假日", "活动日", "特别销售"]).optional(), note: z.string().max(5000).optional(), stores: z.array(z.string().min(1)).min(1).max(50).optional() }) })).mutation(async ({ ctx, input }) => {
    requireRole(ctx.user, ["admin", "operator"]);
    const db = await dbOrThrow();
    const result = await db.update(specialDates).set({ ...input.data, stores: input.data.stores ? JSON.stringify(input.data.stores) : undefined }).where(eq(specialDates.id, input.id));
    if (!result[0]?.affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "特殊日期不存在" });
    return { success: true } as const;
  }),

  deleteSpecialDate: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    requireRole(ctx.user, ["admin", "operator"]);
    const db = await dbOrThrow();
    const result = await db.delete(specialDates).where(eq(specialDates.id, input.id));
    if (!result[0]?.affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "特殊日期不存在" });
    return { success: true } as const;
  }),

  adminListUsers: protectedProcedure.query(async ({ ctx }) => {
    requireRole(ctx.user, ["admin"]);
    const db = await dbOrThrow();
    return db.select({ id: users.id, openId: users.openId, name: users.name, email: users.email, role: users.role, storeName: users.storeName, lastSignedIn: users.lastSignedIn }).from(users).orderBy(users.name);
  }),

  listAuditLogs: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const role = requireRole(ctx.user, ["admin", "operator", "store"]);
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id));
    return role === "store" ? rows.filter(row => row.actorOpenId === ctx.user.openId) : rows;
  }),

  getReportTemplate: protectedProcedure.query(async () => {
    const db = await dbOrThrow();
    const [template] = await db.select().from(reportTemplates).where(eq(reportTemplates.templateKey, "daily-report")).limit(1);
    if (!template) return null;
    const fields = await db.select().from(reportTemplateFields).where(eq(reportTemplateFields.templateId, template.id)).orderBy(reportTemplateFields.sortOrder);
    const builtIns = [
      { fieldId: "tastingAmount", label: "试吃金额", group: "经营数据" as const, required: false, enabled: true, copyToWechat: true },
      { fieldId: "praiseCount", label: "好评数", group: "经营数据" as const, required: false, enabled: true, copyToWechat: true },
      { fieldId: "discountAmount", label: "优惠/折扣券合计", group: "经营数据" as const, required: false, enabled: true, copyToWechat: true },
      { fieldId: "platformTotal", label: "合计平台收入", group: "经营数据" as const, required: false, enabled: true, copyToWechat: true },
      { fieldId: "tastingQty", label: "试吃数量", group: "经营数据" as const, required: false, enabled: true, copyToWechat: true },
      { fieldId: "wasteQty", label: "报损数量", group: "经营数据" as const, required: false, enabled: true, copyToWechat: true },
      { fieldId: "tastingRatio", label: "试吃占比（自动）", group: "经营数据" as const, required: false, enabled: true, copyToWechat: true },
      { fieldId: "wasteRatio", label: "报损占比（自动）", group: "经营数据" as const, required: false, enabled: true, copyToWechat: true },
      { fieldId: "memberCardBalance", label: "会员实体卡余量", group: "经营数据" as const, required: false, enabled: true, copyToWechat: true },
      { fieldId: "giftProduct", label: "赠送产品数量", group: "经营数据" as const, required: false, enabled: true, copyToWechat: true },
    ];
    const existingIds = new Set(fields.map(field => field.fieldId));
    return { ...template, fields: [...fields, ...builtIns.filter(field => !existingIds.has(field.fieldId)).map((field, index) => ({ ...field, id: -(index + 1), templateId: template.id, sortOrder: fields.length + index }))] };
  }),

  saveReportTemplate: protectedProcedure.input(z.object({ name: z.string().min(1).max(160), description: z.string().max(5000), fields: z.array(z.object({ fieldId: z.string().min(1).max(80), label: z.string().min(1).max(160), group: z.enum(["经营数据", "现场记录", "问题跟进"]), required: z.boolean(), enabled: z.boolean(), copyToWechat: z.boolean() })).min(1) })).mutation(async ({ ctx, input }) => {
    requireRole(ctx.user, ["admin"]);
    const db = await dbOrThrow();
    const [existing] = await db.select({ id: reportTemplates.id }).from(reportTemplates).where(eq(reportTemplates.templateKey, "daily-report")).limit(1);
    let templateId = existing?.id;
    if (templateId) await db.update(reportTemplates).set({ name: input.name, description: input.description, updatedBy: ctx.user.name || "未命名用户" }).where(eq(reportTemplates.id, templateId));
    else { const [created] = await db.insert(reportTemplates).values({ templateKey: "daily-report", name: input.name, description: input.description, updatedBy: ctx.user.name || "未命名用户" }).$returningId(); templateId = created.id; }
    await db.delete(reportTemplateFields).where(eq(reportTemplateFields.templateId, templateId));
    await db.insert(reportTemplateFields).values(input.fields.map((field, index) => ({ templateId: templateId!, ...field, sortOrder: index })));
    await writeAudit(db, ctx.user, "发布日报模板", "日报模板", `${input.name} · ${input.fields.length} 个字段`);
    return { success: true } as const;
  }),

  adminUpdateUser: protectedProcedure.input(z.object({ id: z.number().int().positive(), role: z.enum(["user", "admin", "operator", "store"]), storeName: z.string().max(120).nullable().optional() })).mutation(async ({ ctx, input }) => {
    requireRole(ctx.user, ["admin"]);
    if (input.id === ctx.user.id && input.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "不能移除当前管理员自己的管理员权限" });
    if (input.role === "store" && !input.storeName) throw new TRPCError({ code: "BAD_REQUEST", message: "店长必须绑定门店" });
    const db = await dbOrThrow();
    await db.update(users).set({ role: input.role, storeName: input.role === "store" ? input.storeName : null }).where(eq(users.id, input.id));
    await writeAudit(db, ctx.user, "修改用户权限", `用户 #${input.id}`, `${input.role}${input.storeName ? ` · ${input.storeName}` : ""}`);
    return { success: true } as const;
  }),

  adminCreateStore: protectedProcedure.input(z.object({ name: z.string().min(1).max(120), managerName: z.string().min(1).max(80), monthlyTargetWan: z.number().nonnegative().default(0), status: z.enum(["正常运营", "筹备中", "装修中"]).default("正常运营"), openingDate: z.string().optional() })).mutation(async ({ ctx, input }) => {
    requireRole(ctx.user, ["admin"]);
    const db = await dbOrThrow();
    const [created] = await db.insert(stores).values(input).$returningId();
    return { id: created.id };
  }),

  adminUpdateStore: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: z.object({ name: z.string().min(1).max(120).optional(), managerName: z.string().min(1).max(80).optional(), monthlyTargetWan: z.number().nonnegative().optional(), status: z.enum(["正常运营", "筹备中", "装修中"]).optional(), openingDate: z.string().nullable().optional() }) })).mutation(async ({ ctx, input }) => {
    requireRole(ctx.user, ["admin"]);
    const db = await dbOrThrow();
    const [oldStore] = await db.select({ name: stores.name }).from(stores).where(eq(stores.id, input.id)).limit(1);
    if (!oldStore) throw new TRPCError({ code: "NOT_FOUND", message: "门店不存在" });
    const result = await db.update(stores).set(input.data).where(eq(stores.id, input.id));
    if (input.data.name && input.data.name !== oldStore.name) await db.update(users).set({ storeName: input.data.name }).where(eq(users.storeName, oldStore.name));
    await writeAudit(db, ctx.user, "编辑门店", input.data.name || oldStore.name, `${input.data.managerName || ""} · ${input.data.status || ""}`);
    return { success: true } as const;
  }),

  adminDeleteStore: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    requireRole(ctx.user, ["admin"]);
    const db = await dbOrThrow();
    const [store] = await db.select({ name: stores.name }).from(stores).where(eq(stores.id, input.id)).limit(1);
    if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "门店不存在" });
    const [report] = await db.select({ id: dailyReports.id }).from(dailyReports).where(eq(dailyReports.storeName, store.name)).limit(1);
    if (report) throw new TRPCError({ code: "CONFLICT", message: "该门店已有日报记录，不能直接删除" });
    await db.delete(stores).where(eq(stores.id, input.id));
    return { success: true } as const;
  }),
});
