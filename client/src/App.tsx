import { useEffect, useState } from "react";
import { demoData } from "./data";
import { AppShell } from "./components/AppShell";
import type { AppData, Session, WorkspaceView } from "./types";
import AccessPage from "./pages/AccessPage";
import AdminWorkspace from "./pages/AdminWorkspace";
import OperationsWorkspace from "./pages/OperationsWorkspace";
import StoreWorkspace from "./pages/StoreWorkspace";

export default function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try { const saved = localStorage.getItem("oneira-demo-session"); return saved ? JSON.parse(saved) : null; } catch { return null; }
  });
  const [view, setView] = useState<WorkspaceView>("overview");
  const [data, setData] = useState<AppData>(() => {
    try { const saved = localStorage.getItem("oneira-demo-data"); return saved ? JSON.parse(saved) : demoData; } catch { return demoData; }
  });
  const [flash, setFlash] = useState("");
  useEffect(() => { localStorage.setItem("oneira-demo-data", JSON.stringify(data)); }, [data]);
  useEffect(() => { if (session) localStorage.setItem("oneira-demo-session", JSON.stringify(session)); else localStorage.removeItem("oneira-demo-session"); }, [session]);
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
