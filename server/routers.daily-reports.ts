import { and, desc, eq, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb, ensureOneiraSeedData } from "./db";
import { dailyReports, stores } from "../drizzle/schema";
import { canStoreAccess } from "./routers";

const dbOrThrow = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "云端数据库暂不可用。请确认已登录官方 App 或网络已恢复，然后点击重试。" });
  return db;
};

export const dailyReportsRouter = router({
  // 查看所有店铺的日报（管理员/经理）
  listAll: protectedProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        storeName: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      // 仅管理员和经理可以查看所有日报
      if (ctx.user?.role !== "manager" && ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员或运营经理可以查看所有日报" });
      }

      const db = await dbOrThrow();
      let query = db.select().from(dailyReports);

      // 日期范围过滤
      if (input.startDate && input.endDate) {
        query = query.where(
          and(
            gte(dailyReports.reportDate, input.startDate),
            lte(dailyReports.reportDate, input.endDate)
          )
        );
      }

      // 店铺过滤
      if (input.storeName) {
        query = query.where(eq(dailyReports.storeName, input.storeName));
      }

      const reports = await query.orderBy(desc(dailyReports.reportDate));
      return reports;
    }),

  // 查看特定店铺的日报
  listByStore: protectedProcedure
    .input(
      z.object({
        storeName: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      // 验证访问权限
      if (!canStoreAccess(ctx.user?.role || "user", ctx.user?.storeName, input.storeName)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "您没有权限查看该店铺的日报" });
      }

      const db = await dbOrThrow();
      let query = db.select().from(dailyReports).where(eq(dailyReports.storeName, input.storeName));

      // 日期范围过滤
      if (input.startDate && input.endDate) {
        query = query.where(
          and(
            gte(dailyReports.reportDate, input.startDate),
            lte(dailyReports.reportDate, input.endDate)
          )
        );
      }

      const reports = await query.orderBy(desc(dailyReports.reportDate));
      return reports;
    }),

  // 获取日报统计汇总（按月份）
  getSummary: protectedProcedure
    .input(
      z.object({
        month: z.string(), // 格式: YYYY-MM
        storeName: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (ctx.user?.role !== "manager" && ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员或运营经理可以查看汇总" });
      }

      const db = await dbOrThrow();
      const startDate = `${input.month}-01`;
      const endDate = `${input.month}-31`;

      let query = db
        .select()
        .from(dailyReports)
        .where(
          and(
            gte(dailyReports.reportDate, startDate),
            lte(dailyReports.reportDate, endDate)
          )
        );

      if (input.storeName) {
        query = query.where(eq(dailyReports.storeName, input.storeName));
      }

      const reports = await query;

      // 计算汇总统计
      const summary = {
        totalReports: reports.length,
        totalRevenue: 0,
        avgAvgTicket: 0,
        totalTraffic: 0,
        totalWaste: 0,
        issueCount: 0,
        resolvedIssueCount: 0,
        stores: {} as Record<string, any>,
      };

      reports.forEach((report) => {
        summary.totalRevenue += report.revenue;
        summary.avgAvgTicket += report.avgTicket;
        summary.totalTraffic += report.traffic;
        summary.totalWaste += report.wasteAmount;
        if (report.issue) summary.issueCount += 1;
        if (report.issueStatus === "已解决") summary.resolvedIssueCount += 1;

        if (!summary.stores[report.storeName]) {
          summary.stores[report.storeName] = {
            storeName: report.storeName,
            reporter: report.reporter,
            reportCount: 0,
            revenue: 0,
            issues: [],
          };
        }

        summary.stores[report.storeName].reportCount += 1;
        summary.stores[report.storeName].revenue += report.revenue;
        if (report.issue) {
          summary.stores[report.storeName].issues.push({
            date: report.reportDate,
            issue: report.issue,
            status: report.issueStatus,
          });
        }
      });

      summary.avgAvgTicket = reports.length > 0 ? summary.avgAvgTicket / reports.length : 0;

      return summary;
    }),

  // 获取日报详情
  getDetail: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await dbOrThrow();
      const report = await db.select().from(dailyReports).where(eq(dailyReports.id, input.id)).limit(1);

      if (!report[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "日报不存在" });
      }

      // 验证访问权限
      if (!canStoreAccess(ctx.user?.role || "user", ctx.user?.storeName, report[0].storeName)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "您没有权限查看该日报" });
      }

      return report[0];
    }),

  // 获取所有店铺列表（用于筛选）
  getStores: protectedProcedure.query(async () => {
    await ensureOneiraSeedData();
    const db = await dbOrThrow();
    return db
      .select({ id: stores.id, name: stores.name, managerName: stores.managerName })
      .from(stores)
      .orderBy(stores.name);
  }),
});
