import { and, desc, eq, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { collaborationItems, collaborationReplies, dailyReports, retrospectives, stores } from "../drizzle/schema";
import { getDb } from "./db";
import { getAppRole, canEditStoreRecord, requireRole, requireStoreScope } from "./permissions";
import { protectedProcedure, router } from "./_core/trpc";

const dbOrThrow = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "云端数据库暂不可用" });
  return db;
};

const reportInput = z.object({
  storeName: z.string().min(1).max(120),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weather: z.enum(["晴", "阴", "雨", "雪"]).default("晴"),
  revenue: z.number().nonnegative().default(0),
  traffic: z.number().nonnegative().default(0),
  avgTicket: z.number().nonnegative().default(0),
  wasteAmount: z.number().nonnegative().default(0),
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
    const rows = await db.select({ id: stores.id, name: stores.name, managerName: stores.managerName, status: stores.status }).from(stores).orderBy(stores.name);
    return getAppRole(ctx.user) === "store" ? rows.filter(row => row.name === ctx.user.storeName) : rows;
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
    const [created] = await db.insert(dailyReports).values({ ...input, reporter: ctx.user.name || "未命名用户", submitted: true, issueStatus: input.issue ? "待处理" : "已解决" }).$returningId();
    return { id: created.id };
  }),

  updateReport: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: reportInput.partial() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [old] = await db.select().from(dailyReports).where(eq(dailyReports.id, input.id)).limit(1);
    if (!old) throw new TRPCError({ code: "NOT_FOUND", message: "日报不存在" });
    canEditStoreRecord(ctx.user, old.storeName, old.reporter);
    if (input.data.storeName && input.data.storeName !== old.storeName) requireRole(ctx.user, ["admin", "operator"]);
    await db.update(dailyReports).set({ ...input.data, issueStatus: input.data.issue !== undefined ? (input.data.issue ? "待处理" : "已解决") : undefined }).where(eq(dailyReports.id, input.id));
    return { success: true } as const;
  }),

  deleteReport: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    requireRole(ctx.user, ["admin"]);
    const db = await dbOrThrow();
    const result = await db.delete(dailyReports).where(eq(dailyReports.id, input.id));
    if (!result[0]?.affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "日报不存在" });
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
    return { id: created.id };
  }),

  replyCollaboration: protectedProcedure.input(z.object({ itemId: z.number().int().positive(), body: z.string().min(1).max(5000) })).mutation(async ({ ctx, input }) => {
    const role = requireRole(ctx.user, ["admin", "operator"]);
    const db = await dbOrThrow();
    const [item] = await db.select().from(collaborationItems).where(eq(collaborationItems.id, input.itemId)).limit(1);
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "协作事项不存在" });
    await db.insert(collaborationReplies).values({ itemId: item.id, authorName: ctx.user.name || "未命名用户", authorRole: role, body: input.body });
    await db.update(collaborationItems).set({ status: item.type === "issue" ? "处理中" : "已回复" }).where(eq(collaborationItems.id, item.id));
    return { success: true } as const;
  }),

  updateCollaborationStatus: protectedProcedure.input(z.object({ itemId: z.number().int().positive(), status: z.enum(["待查看", "处理中", "已回复", "已解决"]) })).mutation(async ({ ctx, input }) => {
    requireRole(ctx.user, ["admin", "operator"]);
    const db = await dbOrThrow();
    const result = await db.update(collaborationItems).set({ status: input.status }).where(eq(collaborationItems.id, input.itemId));
    if (!result[0]?.affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "协作事项不存在" });
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
    return { id: created.id };
  }),

  deleteRetrospective: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [row] = await db.select().from(retrospectives).where(eq(retrospectives.id, input.id)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "复盘不存在" });
    if (getAppRole(ctx.user) === "store") { requireStoreScope(ctx.user, row.storeName); if (row.authorOpenId !== ctx.user.openId) throw new TRPCError({ code: "FORBIDDEN", message: "只能删除自己创建的复盘" }); } else requireRole(ctx.user, ["admin", "operator"]);
    await db.delete(retrospectives).where(eq(retrospectives.id, input.id));
    return { success: true } as const;
  }),
});
