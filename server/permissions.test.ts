import { describe, expect, it } from "vitest";
import type { User } from "../drizzle/schema";
import { canEditStoreRecord, getAppRole, requireStoreScope } from "./permissions";

const user = (overrides: Partial<User> = {}) => ({
  id: 1,
  openId: "open-1",
  name: "林晓",
  email: "lin@example.com",
  loginMethod: "email",
  role: "store" as const,
  storeName: "西湖店",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
  ...overrides,
});

describe("server role boundaries", () => {
  it("maps legacy user accounts to operator access", () => {
    expect(getAppRole(user({ role: "user" }))).toBe("operator");
    expect(getAppRole(user({ role: "admin" }))).toBe("admin");
  });

  it("limits store users to their bound store", () => {
    expect(requireStoreScope(user(), "西湖店")).toBe("store");
    expect(() => requireStoreScope(user(), "滨江店")).toThrow("绑定门店");
  });

  it("limits store edits to the submitting user", () => {
    expect(canEditStoreRecord(user(), "西湖店", "林晓")).toBe("store");
    expect(() => canEditStoreRecord(user(), "西湖店", "周宁")).toThrow("自己提交");
  });
});
