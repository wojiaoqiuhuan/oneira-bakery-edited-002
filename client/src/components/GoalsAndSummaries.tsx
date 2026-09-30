import { useMemo, useState } from "react";
import { Check, ClipboardList, Target } from "lucide-react";
import { trpc } from "../lib/trpc";
import type { AppData, Role } from "../types";
import { Button, Card, Field, StatusPill, Textarea } from "./UiKit";

const monthNow = new Date().toISOString().slice(0, 7);
const money = (n: number) => `¥${n.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;

export function GoalsAndSummaries({ data, role, storeName, onFlash }: { data: AppData; role: Role; storeName?: string; onFlash: (message: string) => void }) {
  const [selectedStore, setSelectedStore] = useState(storeName || data.stores[0] || "");
  const [month, setMonth] = useState(monthNow);
  const [target, setTarget] = useState("");
  const [weekTargets, setWeekTargets] = useState(["", "", "", "", ""]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDate, setTaskDate] = useState(new Date().toISOString().slice(0, 10));
  const [summaryType, setSummaryType] = useState<"周报" | "月报">("周报");
  const [summary, setSummary] = useState("");
  const [plan, setPlan] = useState("");
  const targets = trpc.workspace.listTargets.useQuery({ storeName: selectedStore, month }, { enabled: Boolean(selectedStore), retry: false });
  const tasks = trpc.workspace.listTasks.useQuery({ storeName: selectedStore }, { enabled: Boolean(selectedStore), retry: false });
  const summaries = trpc.workspace.listSummaries.useQuery({ storeName: selectedStore }, { enabled: Boolean(selectedStore), retry: false });
  const saveTarget = trpc.workspace.upsertTarget.useMutation({ onSuccess: () => targets.refetch() });
  const createTask = trpc.workspace.createTask.useMutation({ onSuccess: () => tasks.refetch() });
  const updateTask = trpc.workspace.updateTask.useMutation({ onSuccess: () => tasks.refetch() });
  const saveSummary = trpc.workspace.upsertSummary.useMutation({ onSuccess: () => summaries.refetch() });
  const targetRow = targets.data?.[0];
  const weekValue = (index: number) => { const key = `week${index + 1}` as "week1" | "week2" | "week3" | "week4" | "week5"; return weekTargets[index] || (targetRow ? Number(targetRow[key]) : ""); };
  const scopedReports = data.reports.filter(report => report.storeName === selectedStore && report.date.startsWith(month));
  const actual = scopedReports.reduce((sum, report) => sum + report.revenue, 0);
  const monthlyTarget = targetRow?.monthlyTarget || Number(target) || 0;
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const dailyTarget = monthlyTarget / Math.max(1, days);
  const completed = tasks.data?.filter(task => task.completed).length || 0;
  const saveTargetForm = async () => { if (!selectedStore || !month) return; await saveTarget.mutateAsync({ storeName: selectedStore, month, monthlyTarget: Number(target || targetRow?.monthlyTarget || 0), week1: Number(weekTargets[0] || targetRow?.week1 || 0), week2: Number(weekTargets[1] || targetRow?.week2 || 0), week3: Number(weekTargets[2] || targetRow?.week3 || 0), week4: Number(weekTargets[3] || targetRow?.week4 || 0), week5: Number(weekTargets[4] || targetRow?.week5 || 0) }); onFlash("月目标和周分解已同步"); };
  const addTask = async () => { if (!taskTitle.trim()) return; await createTask.mutateAsync({ storeName: selectedStore, nodeName: taskTitle.trim(), planDate: taskDate, owner: storeName || "门店团队" }); setTaskTitle(""); onFlash("任务已下发"); };
  const saveSummaryForm = async () => { if (!summary.trim() || !plan.trim()) return; await saveSummary.mutateAsync({ storeName: selectedStore, period: summaryType === "周报" ? `${month}-W${Math.ceil(new Date().getDate() / 7)}` : month, type: summaryType, summary: summary.trim(), plan: plan.trim() }); setSummary(""); setPlan(""); onFlash(`${summaryType}已保存并同步`); };
  return <div className="goals-summary-grid">
    <Card className="goal-card"><div className="card-heading"><div><span className="eyebrow">MONTHLY TARGET</span><h3>月目标与每日分解</h3><p>每日报到数据会自动累计完成度。</p></div><Target size={20} /></div><div className="goal-toolbar">{!storeName && <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>{data.stores.map(item => <option key={item}>{item}</option>)}</select>}<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></div><div className="goal-progress"><div><span>本月实收</span><b>{money(actual)}</b></div><div><span>月目标</span><b>{money(monthlyTarget)}</b></div><div><span>每日目标</span><b>{money(dailyTarget)}</b></div><StatusPill label={`${monthlyTarget ? Math.min(100, actual / monthlyTarget * 100).toFixed(0) : 0}% 完成`} tone={actual >= monthlyTarget && monthlyTarget ? "green" : "blue"} /></div>{(role === "admin" || role === "operator" || role === "store") && <><div className="goal-edit-grid"><Field label="月目标"><input type="number" value={target || (targetRow?.monthlyTarget ?? "")} onChange={e => setTarget(e.target.value)} /></Field>{[1, 2, 3, 4, 5].map((week, index) => <Field key={week} label={`第${week}周`}><input type="number" value={weekValue(index)} onChange={e => setWeekTargets(current => current.map((value, i) => i === index ? e.target.value : value))} /></Field>)}</div><Button size="sm" onClick={() => void saveTargetForm()} icon={<Check size={14} />}>保存目标分解</Button></>}</Card>
    <Card className="task-card"><div className="card-heading"><div><span className="eyebrow">TASKS</span><h3>目标与任务</h3><p>{completed}/{tasks.data?.length || 0} 项已完成</p></div><ClipboardList size={20} /></div>{(role === "admin" || role === "operator") && <div className="task-create"><input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="给门店下发任务或目标" /><input type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)} /><Button size="sm" onClick={() => void addTask()}>下发</Button></div>}<div className="task-list">{tasks.data?.map(task => <label className="task-row" key={task.id}><input type="checkbox" checked={task.completed} onChange={e => void updateTask.mutateAsync({ id: task.id, completed: e.target.checked, status: e.target.checked ? "已完成" : "进行中" })} /><span><strong>{task.nodeName}</strong><small>{task.planDate} · {task.owner}</small></span><StatusPill label={task.status} tone={task.completed ? "green" : "orange"} /></label>)}</div></Card>
    <Card className="summary-card"><div className="card-heading"><div><span className="eyebrow">PERIOD REVIEW</span><h3>周复盘 / 月总结</h3><p>运营和店长都可以填写，并同步给协作团队。</p></div></div><div className="summary-form"><div className="segmented-control"><button className={summaryType === "周报" ? "is-active" : ""} onClick={() => setSummaryType("周报")}>周复盘</button><button className={summaryType === "月报" ? "is-active" : ""} onClick={() => setSummaryType("月报")}>月总结</button></div><Field label="总结内容"><Textarea value={summary} onChange={setSummary} rows={3} placeholder="本周期完成、问题、数据判断" /></Field><Field label="下一周期计划"><Textarea value={plan} onChange={setPlan} rows={3} placeholder="下一周期要继续做什么" /></Field><Button size="sm" onClick={() => void saveSummaryForm()}>保存{summaryType}</Button></div>{summaries.data?.slice(0, 3).map(item => <div className="summary-history" key={item.id}><StatusPill label={item.type} tone="blue" /><strong>{item.period}</strong><span>{item.summary}</span></div>)}</Card>
  </div>;
}
