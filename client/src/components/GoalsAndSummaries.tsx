import { useEffect, useState } from "react";
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
  const [dailyTargetInput, setDailyTargetInput] = useState("");
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
  const scopedReports = data.reports.filter(report => report.storeName === selectedStore && report.date.startsWith(month));
  const actual = scopedReports.reduce((sum, report) => sum + report.revenue, 0);
  const monthlyTarget = targetRow?.monthlyTarget || Number(target) || 0;
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const dailyTarget = Number(dailyTargetInput || (monthlyTarget / Math.max(1, days)).toFixed(2));
  useEffect(() => { if (targetRow && !dailyTargetInput) setDailyTargetInput((Number(targetRow.monthlyTarget) / Math.max(1, days)).toFixed(2)); }, [targetRow, days, dailyTargetInput]);
  const completed = tasks.data?.filter(task => task.completed).length || 0;
  const saveTargetForm = async () => { if (!selectedStore || !month) return; const nextDaily = Number(dailyTargetInput || target || 0); const nextMonthly = nextDaily * days; await saveTarget.mutateAsync({ storeName: selectedStore, month, monthlyTarget: nextMonthly, week1: nextMonthly / 5, week2: nextMonthly / 5, week3: nextMonthly / 5, week4: nextMonthly / 5, week5: nextMonthly / 5 }); onFlash("每日目标已保存并同步"); };
  const addTask = async () => { if (!taskTitle.trim()) return; await createTask.mutateAsync({ storeName: selectedStore, nodeName: taskTitle.trim(), planDate: taskDate, owner: storeName || "门店团队" }); setTaskTitle(""); onFlash("任务已下发"); };
  const saveSummaryForm = async () => { if (!summary.trim() || !plan.trim()) return; await saveSummary.mutateAsync({ storeName: selectedStore, period: summaryType === "周报" ? `${month}-W${Math.ceil(new Date().getDate() / 7)}` : month, type: summaryType, summary: summary.trim(), plan: plan.trim() }); setSummary(""); setPlan(""); onFlash(`${summaryType}已保存并同步`); };
  return <div className="goals-summary-grid">
    <Card className="goal-card"><div className="card-heading"><div><span className="eyebrow">DAILY TARGET</span><h3>每日目标与月度进度</h3><p>目标按天分解，日报提交后自动回填当天完成度。</p></div><Target size={20} /></div><div className="goal-toolbar">{!storeName && <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>{data.stores.map(item => <option key={item}>{item}</option>)}</select>}<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></div><div className="goal-progress"><div><span>本月实收</span><b>{money(actual)}</b></div><div><span>月目标</span><b>{money(monthlyTarget)}</b></div><div><span>每日目标</span><b>{money(dailyTarget)}</b></div><StatusPill label={`${monthlyTarget ? Math.min(100, actual / monthlyTarget * 100).toFixed(0) : 0}% 完成`} tone={actual >= monthlyTarget && monthlyTarget ? "green" : "blue"} /></div>{(role === "admin" || role === "operator" || role === "store") && <div className="goal-edit-grid"><Field label="每日目标（元）"><input type="number" value={dailyTargetInput || (targetRow ? (Number(targetRow.monthlyTarget) / Math.max(1, days)).toFixed(2) : "")} onChange={e => setDailyTargetInput(e.target.value)} /></Field><Field label="自动月目标（元）"><input value={(Number(dailyTargetInput || dailyTarget) * days).toFixed(2)} readOnly /></Field><div className="goal-save-cell"><Button size="sm" onClick={() => void saveTargetForm()} icon={<Check size={14} />}>保存每日目标</Button></div></div>}</Card>
    <Card className="task-card"><div className="card-heading"><div><span className="eyebrow">TASKS</span><h3>目标与任务</h3><p>{completed}/{tasks.data?.length || 0} 项已完成</p></div><ClipboardList size={20} /></div>{(role === "admin" || role === "operator") && <div className="task-create"><input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="给门店下发任务或目标" /><input type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)} /><Button size="sm" onClick={() => void addTask()}>下发</Button></div>}<div className="task-list">{tasks.data?.map(task => <label className="task-row" key={task.id}><input type="checkbox" checked={task.completed} onChange={e => void updateTask.mutateAsync({ id: task.id, completed: e.target.checked, status: e.target.checked ? "已完成" : "进行中" })} /><span><strong>{task.nodeName}</strong><small>{task.planDate} · {task.owner}</small></span><StatusPill label={task.status} tone={task.completed ? "green" : "orange"} /></label>)}</div></Card>
    <Card className="summary-card"><div className="card-heading"><div><span className="eyebrow">PERIOD REVIEW</span><h3>周复盘 / 月总结</h3><p>运营和店长都可以填写，并同步给协作团队。</p></div></div><div className="summary-form"><div className="segmented-control"><button className={summaryType === "周报" ? "is-active" : ""} onClick={() => setSummaryType("周报")}>周复盘</button><button className={summaryType === "月报" ? "is-active" : ""} onClick={() => setSummaryType("月报")}>月总结</button></div><Field label="总结内容"><Textarea value={summary} onChange={setSummary} rows={3} placeholder="本周期完成、问题、数据判断" /></Field><Field label="下一周期计划"><Textarea value={plan} onChange={setPlan} rows={3} placeholder="下一周期要继续做什么" /></Field><Button size="sm" onClick={() => void saveSummaryForm()}>保存{summaryType}</Button></div>{summaries.data?.slice(0, 3).map(item => <div className="summary-history" key={item.id}><StatusPill label={item.type} tone="blue" /><strong>{item.period}</strong><span>{item.summary}</span></div>)}</Card>
  </div>;
}

export function DailyTargetBoard({ data, role, storeName, onSelectDate }: { data: AppData; role: Role; storeName?: string; onSelectDate?: (date: string) => void }) {
  const [selectedStore, setSelectedStore] = useState(storeName || data.stores[0] || "");
  const [month, setMonth] = useState(monthNow);
  const targets = trpc.workspace.listTargets.useQuery({ storeName: selectedStore, month }, { enabled: Boolean(selectedStore), retry: false });
  const dailyTargets = trpc.workspace.listDailyTargets.useQuery({ storeName: selectedStore, month }, { enabled: Boolean(selectedStore), retry: false });
  const saveDailyTarget = trpc.workspace.upsertDailyTarget.useMutation({ onSuccess: () => dailyTargets.refetch() });
  const target = Number(targets.data?.[0]?.monthlyTarget || 0);
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const dailyTarget = target / Math.max(1, days);
  const rows = Array.from({ length: days }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    const reports = data.reports.filter(report => report.storeName === selectedStore && report.date === date);
    const actual = reports.reduce((sum, report) => sum + report.revenue, 0);
    const savedTarget = Number(dailyTargets.data?.find(item => item.targetDate === date)?.targetAmount || 0);
    const dayTarget = savedTarget || dailyTarget;
    return { date, day: index + 1, actual, reports: reports.length, target: dayTarget, percent: dayTarget ? Math.min(100, actual / dayTarget * 100) : 0 };
  });
  const updateDayTarget = async (date: string, value: string) => { if (role !== "admin" && role !== "operator") return; await saveDailyTarget.mutateAsync({ storeName: selectedStore, targetDate: date, targetAmount: Number(value || 0) }); };
  return <Card className="daily-target-board"><div className="daily-target-board-head"><div><span className="eyebrow">DAILY BREAKDOWN</span><h3>每日目标分解</h3><p>点击日期查看当天日报、特殊标注和完成明细；管理员或运营可逐日设置不同目标。</p></div><div className="daily-target-board-filters">{!storeName && <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>{data.stores.map(item => <option key={item}>{item}</option>)}</select>}<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></div></div><div className="daily-target-meta"><span>月目标 <b>{money(target)}</b></span><span>默认日目标 <b>{money(dailyTarget)}</b></span><span>已提交 <b>{rows.filter(row => row.reports > 0).length}/{days} 天</b></span></div><div className="daily-target-grid">{rows.map(row => <button className={`daily-target-day ${row.actual >= row.target && row.target ? "is-complete" : ""}`} key={row.date} onClick={() => onSelectDate?.(row.date)}><div className="daily-target-day-top"><b>{row.day}</b><StatusPill label={row.reports ? "已报" : "待报"} tone={row.reports ? "green" : "neutral"} /></div><strong>{money(row.actual)}</strong>{role === "admin" || role === "operator" || role === "store" ? <input className="daily-target-input" type="number" defaultValue={row.target || ""} onClick={event => event.stopPropagation()} onBlur={event => void updateDayTarget(row.date, event.target.value)} /> : <span>目标 {money(row.target)}</span>}<i><em style={{ width: `${row.percent}%` }} /></i><small>{row.percent.toFixed(0)}% 完成</small></button>)}</div></Card>;
}
