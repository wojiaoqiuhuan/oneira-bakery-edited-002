export type Role = "admin" | "operator" | "store";
export type WorkspaceView =
  | "overview"
  | "reports"
  | "templates"
  | "management"
  | "collaboration"
  | "calendar"
  | "retrospectives"
  | "audit";

export type ReportField = {
  id: string;
  label: string;
  group: "经营数据" | "现场记录" | "问题跟进";
  required: boolean;
  enabled: boolean;
  copyToWechat: boolean;
};

export type ReportTemplate = {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  fields: ReportField[];
};

export type DailyReport = {
  id: number;
  storeName: string;
  date: string;
  reporter: string;
  revenue: number;
  traffic: number;
  avgTicket: number;
  wasteAmount: number;
  tastingAmount?: number;
  praiseCount?: number;
  todayDone: string;
  tomorrowPlan: string;
  issue: string;
  issueStatus: "待处理" | "处理中" | "已解决";
  updatedAt: string;
  customFields?: Record<string, string>;
};

export type Reply = {
  id: number;
  author: string;
  role: Role;
  body: string;
  createdAt: string;
};

export type CollaborationItem = {
  id: number;
  type: "suggestion" | "issue";
  storeName: string;
  title: string;
  body: string;
  status: "待查看" | "处理中" | "已回复" | "已解决";
  author: string;
  createdAt: string;
  updatedAt: string;
  replies: Reply[];
};

export type Retrospective = {
  id: number;
  storeName: string;
  title: string;
  body: string;
  tags: string[];
  author: string;
  date: string;
  mood: "顺利" | "有收获" | "需跟进";
};

export type SpecialDate = {
  id: number;
  date: string;
  label: string;
  type: "节假日" | "活动日" | "特别销售";
  note: string;
  stores: string[];
};

export type AuditLog = {
  id: number;
  action: string;
  actor: string;
  role: Role;
  target: string;
  detail: string;
  createdAt: string;
};

export type AppData = {
  stores: string[];
  template: ReportTemplate;
  reports: DailyReport[];
  collaboration: CollaborationItem[];
  retrospectives: Retrospective[];
  specialDates: SpecialDate[];
  auditLogs: AuditLog[];
};

export type Session = {
  role: Role;
  name: string;
  storeName?: string;
};
