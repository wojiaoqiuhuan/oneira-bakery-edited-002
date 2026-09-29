import { useEffect, useState } from "react";
import { useAuth } from "./_core/hooks/useAuth";
import { demoData } from "./data";
import { AppShell } from "./components/AppShell";
import { trpc } from "./lib/trpc";
import type { AppData, DailyReport, Session, WorkspaceView } from "./types";
import AccessPage from "./pages/AccessPage";
import AdminWorkspace from "./pages/AdminWorkspace";
import OperationsWorkspace from "./pages/OperationsWorkspace";
import StoreWorkspace from "./pages/StoreWorkspace";

const parseCustomMetrics = (value: string | null | undefined): Record<string, string> => {
  if (!value) return {};
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed : {}; } catch { return {}; }
};

export default function App() {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const remoteMe = trpc.workspace.me.useQuery(undefined, { enabled: auth.isAuthenticated, retry: false });
  const canReadRemoteReports = Boolean(remoteMe.data && (remoteMe.data.role !== "store" || remoteMe.data.storeName));
  const remoteReports = trpc.workspace.listReports.useQuery(
    remoteMe.data?.role === "store" ? { storeName: remoteMe.data.storeName || undefined } : {},
    { enabled: canReadRemoteReports, retry: false }
  );
  const [session, setSession] = useState<Session | null>(() => {
    try { const saved = localStorage.getItem("oneira-demo-session"); return saved ? JSON.parse(saved) : null; } catch { return null; }
  });
  const [view, setView] = useState<WorkspaceView>("overview");
  const [data, setData] = useState<AppData>(() => {
    try { const saved = localStorage.getItem("oneira-demo-data"); return saved ? JSON.parse(saved) : demoData; } catch { return demoData; }
  });
  const [flash, setFlash] = useState("");
  const [remoteSynced, setRemoteSynced] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState("刚刚");
  const realSession: Session | null = remoteMe.data ? { role: remoteMe.data.role, name: remoteMe.data.name || remoteMe.data.email || "ONEIRA 用户", storeName: remoteMe.data.storeName || undefined } : null;
  useEffect(() => { localStorage.setItem("oneira-demo-data", JSON.stringify(data)); }, [data]);
  useEffect(() => { if (session) localStorage.setItem("oneira-demo-session", JSON.stringify(session)); else localStorage.removeItem("oneira-demo-session"); }, [session]);
  useEffect(() => {
    if (!remoteReports.data || remoteSynced) return;
    const reports: DailyReport[] = remoteReports.data.map(report => ({
      id: report.id,
      storeName: report.storeName,
      date: report.reportDate,
      reporter: report.reporter,
      revenue: report.revenue,
      traffic: report.traffic,
      avgTicket: report.avgTicket,
      wasteAmount: report.wasteAmount,
      tastingAmount: report.tastingAmount || 0,
      praiseCount: report.praiseCount || 0,
      customFields: parseCustomMetrics(report.customMetrics),
      todayDone: report.todayDone || "",
      tomorrowPlan: report.nextPlan || "",
      issue: report.issue || "",
      issueStatus: report.issueStatus,
      updatedAt: report.updatedAt instanceof Date ? report.updatedAt.toISOString() : String(report.updatedAt),
    }));
    setData(current => ({ ...current, reports }));
    setRemoteSynced(true);
    showFlash("已从服务端同步日报数据");
  }, [remoteReports.data, remoteSynced]);
  const showFlash = (message: string) => { setFlash(message); window.setTimeout(() => setFlash(current => current === message ? "" : current), 2600); };
  const syncAll = async () => {
    if (syncing) return;
    setSyncing(true);
    setRemoteSynced(false);
    showFlash("正在同步各部门最新数据…");
    try {
      await utils.invalidate();
      await remoteReports.refetch();
      const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      setLastSyncedAt(time);
      showFlash(`同步完成 · ${time}`);
    } catch (error) {
      showFlash(error instanceof Error ? `同步失败：${error.message}` : "同步失败，请稍后重试");
    } finally {
      setSyncing(false);
    }
  };
  const enter = (next: Session) => { setSession(next); setView("overview"); window.history.replaceState({}, "", next.role === "admin" ? "/admin" : next.role === "operator" ? "/operations" : "/store"); };
  const logout = async () => { if (auth.isAuthenticated) { try { await auth.logout(); } catch {} } setSession(null); setView("overview"); window.history.replaceState({}, "", "/"); };
  const activeSession = realSession || session;
  if (auth.loading || (auth.isAuthenticated && remoteMe.isLoading)) return <div className="access-page"><div className="access-card"><span className="eyebrow">ONEIRA OPS</span><h2>正在验证工作台权限</h2><p>正在读取口令会话、角色和门店范围，请稍候。</p></div></div>;
  if (!activeSession) return <AccessPage onEnter={enter} />;
  return <AppShell session={activeSession} view={view} onViewChange={setView} onLogout={logout} flash={flash} syncing={syncing} lastSyncedAt={lastSyncedAt} onSync={() => void syncAll()}>
    {activeSession.role === "admin" && <AdminWorkspace data={data} view={view} onChange={setData} onFlash={showFlash} onNavigate={setView} />}
    {activeSession.role === "operator" && <OperationsWorkspace data={data} view={view} onChange={setData} onFlash={showFlash} sessionName={activeSession.name} onNavigate={setView} />}
    {activeSession.role === "store" && <StoreWorkspace data={data} view={view} onChange={setData} onFlash={showFlash} session={activeSession} onNavigate={setView} />}
  </AppShell>;
}
