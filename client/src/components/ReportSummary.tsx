import { useMemo, useState } from "react";
import { BarChart3, Heart, PackageOpen, Percent, ShoppingBag, WalletCards } from "lucide-react";
import type { DailyReport } from "../types";
import { Card, StatCard } from "./UiKit";

const money = (value: number) => `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const ratio = (value: number, total: number) => total > 0 ? `${(value / total * 100).toFixed(2)}%` : "0.00%";

export function ReportSummary({ reports, stores = [], title = "经营汇总", compact = false }: { reports: DailyReport[]; stores?: string[]; title?: string; compact?: boolean }) {
  const dates = reports.map(report => report.date).sort();
  const [startDate, setStartDate] = useState(dates[0] || "");
  const [endDate, setEndDate] = useState(dates[dates.length - 1] || "");
  const [store, setStore] = useState("全部门店");
  const filtered = useMemo(() => reports.filter(report => (!startDate || report.date >= startDate) && (!endDate || report.date <= endDate) && (store === "全部门店" || report.storeName === store)), [reports, startDate, endDate, store]);
  const totals = useMemo(() => filtered.reduce((sum, report) => ({ revenue: sum.revenue + report.revenue, waste: sum.waste + report.wasteAmount, tasting: sum.tasting + (report.tastingAmount || 0), praise: sum.praise + (report.praiseCount || 0), traffic: sum.traffic + report.traffic }), { revenue: 0, waste: 0, tasting: 0, praise: 0, traffic: 0 }), [filtered]);
  return <Card className={`report-summary-card${compact ? " report-summary-compact" : ""}`}>
    <div className="report-summary-head"><div><span className="eyebrow">REPORT SUMMARY</span><h3>{title}</h3><p>按日期和门店查看汇总，比例按区间总营收自动计算。</p></div><div className="summary-filters"><label>开始日期<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label>结束日期<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></label>{stores.length > 1 && <label>门店<select value={store} onChange={event => setStore(event.target.value)}><option>全部门店</option>{stores.map(item => <option key={item}>{item}</option>)}</select></label>}</div></div>
    <div className="summary-meta"><span>{filtered.length} 份日报</span><span>{startDate || "不限开始"} 至 {endDate || "不限结束"}</span>{store !== "全部门店" && <span>{store}</span>}</div>
    <div className="summary-stat-grid"><StatCard label="总营收" value={money(totals.revenue)} hint="筛选区间合计" icon={<WalletCards size={18} />} tone="orange" /><StatCard label="总报损" value={money(totals.waste)} hint={`报损占比 ${ratio(totals.waste, totals.revenue)}`} icon={<PackageOpen size={18} />} tone="gold" /><StatCard label="总试吃" value={money(totals.tasting)} hint={`试吃占比 ${ratio(totals.tasting, totals.revenue)}`} icon={<ShoppingBag size={18} />} tone="blue" /><StatCard label="总好评数" value={String(totals.praise)} hint={`客流 ${totals.traffic}`} icon={<Heart size={18} />} tone="green" /><StatCard label="报损占比" value={ratio(totals.waste, totals.revenue)} hint="总报损 ÷ 总营收" icon={<Percent size={18} />} tone="gold" /><StatCard label="试吃占比" value={ratio(totals.tasting, totals.revenue)} hint="总试吃金额 ÷ 总营收" icon={<BarChart3 size={18} />} tone="blue" /></div>
  </Card>;
}
