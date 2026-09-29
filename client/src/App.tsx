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

export default function App() {
  const auth = useAuth();
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
  const enter = (next: Session) => { setSession(next); setView("overview"); window.history.replaceState({}, "", next.role === "admin" ? "/admin" : next.role === "operator" ? "/operations" : "/store"); };
  const logout = () => { setSession(null); setView("overview"); window.history.replaceState({}, "", "/"); };
  if (!session) return <AccessPage onEnter={enter} />;
  return <AppShell session={session} view={view} onViewChange={setView} onLogout={logout} flash={flash}>
    {session.role === "admin" && <AdminWorkspace data={data} view={view} onChange={setData} onFlash={showFlash} onNavigate={setView} />}
    {session.role === "operator" && <OperationsWorkspace data={data} view={view} onChange={setData} onFlash={showFlash} sessionName={session.name} onNavigate={setView} />}
    {session.role === "store" && <StoreWorkspace data={data} view={view} onChange={setData} onFlash={showFlash} session={session} onNavigate={setView} />}
  </AppShell>;
}
