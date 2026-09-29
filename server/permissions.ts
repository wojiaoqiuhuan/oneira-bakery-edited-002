import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";

export type AppRole = "admin" | "operator" | "store";

export function getAppRole(user: User): AppRole {
  if (user.role === "admin") return "admin";
  if (user.role === "store") return "store";
  return "operator";
}

export function requireRole(user: User, allowed: AppRole[]) {
  const role = getAppRole(user);
  if (!allowed.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "当前角色没有执行此操作的权限" });
  }
  return role;
}

export function requireStoreScope(user: User, storeName: string) {
  const role = getAppRole(user);
  if (role !== "store") return role;
  if (!user.storeName || user.storeName !== storeName) {
    throw new TRPCError({ code: "FORBIDDEN", message: "店长只能访问绑定门店的数据" });
  }
  return role;
}

export function canEditStoreRecord(user: User, storeName: string, reporter?: string | null) {
  const role = requireStoreScope(user, storeName);
  if (role === "store" && reporter && user.name && reporter !== user.name) {
    throw new TRPCError({ code: "FORBIDDEN", message: "店长只能修改自己提交的记录" });
  }
  if (role !== "admin" && role !== "operator" && role !== "store") {
    throw new TRPCError({ code: "FORBIDDEN", message: "当前角色不能修改该记录" });
  }
  return role;
}
