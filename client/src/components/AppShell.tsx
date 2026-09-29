import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileCog,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Store,
  UsersRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Role, Session, WorkspaceView } from "../types";
import { IconButton, StatusPill, Toast } from "./UiKit";

const roleMeta: Record<Role, { label: string; mark: string; tone: "orange" | "blue" | "green" }> = {
  admin: { label: "系统管理员", mark: "A", tone: "orange" },
  operator: { label: "运营经理", mark: "O", tone: "blue" },
  store: { label: "门店店长", mark: "S", tone: "green" },
};

const navByRole: Record<Role, { id: WorkspaceView; label: string; icon: ReactNode }[]> = {
  admin: [
    { id: "overview", label: "总览", icon: <LayoutDashboard size={17} /> },
    { id: "reports", label: "业务数据", icon: <ClipboardList size={17} /> },
    { id: "templates", label: "日报模板", icon: <FileCog size={17} /> },
    { id: "management", label: "权限与门店", icon: <UsersRound size={17} /> },
    { id: "calendar", label: "特殊日期", icon: <CalendarDays size={17} /> },
    { id: "audit", label: "审计记录", icon: <History size={17} /> },
  ],
  operator: [
    { id: "overview", label: "运营总览", icon: <LayoutDashboard size={17} /> },
    { id: "reports", label: "日报中心", icon: <ClipboardList size={17} /> },
    { id: "collaboration", label: "协作收件箱", icon: <MessageCircle size={17} /> },
    { id: "calendar", label: "运营日历", icon: <CalendarDays size={17} /> },
    { id: "retrospectives", label: "复盘备忘录", icon: <BookOpen size={17} /> },
  ],
  store: [
    { id: "overview", label: "我的工作台", icon: <LayoutDashboard size={17} /> },
    { id: "reports", label: "上传日报", icon: <FileText size={17} /> },
    { id: "collaboration", label: "建议与问题", icon: <MessageCircle size={17} /> },
    { id: "calendar", label: "门店日历", icon: <CalendarDays size={17} /> },
    { id: "retrospectives", label: "我的复盘", icon: <BookOpen size={17} /> },
  ],
};

export function AppShell({ session, view, onViewChange, onLogout, children, flash, syncing = false, lastSyncedAt = "刚刚", onSync }: { session: Session; view: WorkspaceView; onViewChange: (view: WorkspaceView) => void; onLogout: () => void; children: ReactNode; flash?: string; syncing?: boolean; lastSyncedAt?: string; onSync?: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const meta = roleMeta[session.role];
  const nav = navByRole[session.role];
  return <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
    <aside className="sidebar">
      <div className="brand-lockup"><div className="brand-mark"><Sparkles size={18} /></div><div className="brand-words"><strong>ONEIRA</strong><span>梦面包 · Ops OS</span></div></div>
      <div className="role-chip"><div className={`avatar avatar-${meta.tone}`}>{meta.mark}</div><div><strong>{session.name}</strong><span>{meta.label}{session.storeName ? ` · ${session.storeName}` : ""}</span></div></div>
      <nav className="side-nav">{nav.map(item => <button key={item.id} className={`nav-item ${view === item.id ? "is-active" : ""}`} onClick={() => onViewChange(item.id)}>{item.icon}<span>{item.label}</span>{view === item.id && <motion.i layoutId="nav-indicator" />}</button>)}</nav>
      <div className="sidebar-bottom"><button className={`sidebar-note sync-control ${syncing ? "is-syncing" : ""}`} onClick={onSync} disabled={syncing}><span className="pulse-dot" /><div><strong>{syncing ? "正在同步" : "数据已同步"}</strong><small>{syncing ? "正在读取最新数据" : `${lastSyncedAt} · 安全连接`}</small></div><RefreshCw size={15} /></button><button className="logout-link" onClick={onLogout}><LogOut size={16} />退出工作台</button></div>
      <IconButton label={collapsed ? "展开侧栏" : "收起侧栏"} onClick={() => setCollapsed(!collapsed)} variant="soft"><span className="collapse-icon">{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</span></IconButton>
    </aside>
    <main className="main-shell">
      <header className="topbar"><div className="mobile-brand"><div className="brand-mark"><Sparkles size={16} /></div><strong>ONEIRA</strong></div><div className="topbar-meta"><span className="live-dot" />工作台在线 <span className="topbar-divider" />{session.storeName || "全门店视图"}</div><div className="topbar-actions"><button className={`sync-button ${syncing ? "is-syncing" : ""}`} onClick={onSync} disabled={syncing} title="刷新各部门最新数据"><RefreshCw size={15} /><span>{syncing ? "同步中…" : `同步 ${lastSyncedAt}`}</span></button><button className="topbar-profile" onClick={onLogout}><div className={`avatar avatar-${meta.tone}`}>{meta.mark}</div><span>{session.name}</span><Settings2 size={15} /></button></div></header>
      <div className="page-content">{children}</div>
    </main>
    <nav className="mobile-nav">{nav.slice(0, 4).map(item => <button key={item.id} className={view === item.id ? "is-active" : ""} onClick={() => onViewChange(item.id)}>{item.icon}<span>{item.label}</span></button>)}</nav>
    <Toast message={flash} />
  </div>;
}

export { roleMeta };
