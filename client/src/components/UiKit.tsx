import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  FileText,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import type { SpecialDate } from "../types";

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "orange" | "blue" | "green" | "red" | "gold" }) {
  return <span className={`status-pill status-${tone}`}><span className="status-dot" />{label}</span>;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "soft";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return <button type={type} className={`button button-${variant} button-${size}`} onClick={onClick} disabled={disabled}>{icon}{children}</button>;
}

export function IconButton({ label, children, onClick, variant = "ghost" }: { label: string; children: ReactNode; onClick?: () => void; variant?: "ghost" | "soft" | "danger" }) {
  return <button type="button" className={`icon-button icon-button-${variant}`} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

export function Card({ children, className = "", onClick, id }: { children: ReactNode; className?: string; onClick?: () => void; id?: string }) {
  return <motion.section layout id={id} className={`card ${className}`} onClick={onClick} whileHover={onClick ? { y: -2 } : undefined} transition={{ duration: 0.2 }}>{children}</motion.section>;
}

export function StatCard({ label, value, hint, icon, tone = "orange" }: { label: string; value: string; hint: string; icon: ReactNode; tone?: "orange" | "blue" | "green" | "gold" }) {
  return <Card className="stat-card"><div className={`stat-icon stat-icon-${tone}`}>{icon}</div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></Card>;
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="section-header"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action && <div className="section-action">{action}</div>}</div>;
}

export function SearchField({ value, onChange, placeholder = "搜索门店、日报或备忘录" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="search-field"><Search size={16} /><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></label>;
}

export function EmptyState({ icon = <Sparkles size={22} />, title, description, action }: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{description}</p>{action}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Textarea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} />;
}

const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function CalendarView({ events, selectedDate, onSelect, editable = false, onAdd }: { events: SpecialDate[]; selectedDate: string; onSelect: (date: string) => void; editable?: boolean; onAdd?: (date: string) => void }) {
  const cursor = new Date(`${selectedDate.slice(0, 7)}-01T12:00:00`);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const monthTitle = `${year} 年 ${month + 1} 月`;
  const previous = () => onSelect(formatDate(new Date(year, month - 1, 1)));
  const next = () => onSelect(formatDate(new Date(year, month + 1, 1)));
  return <div className="calendar-wrap">
    <div className="calendar-toolbar"><div><span className="eyebrow">MOMENTS</span><h3>{monthTitle}</h3></div><div className="calendar-nav"><IconButton label="上个月" onClick={previous}>‹</IconButton><IconButton label="下个月" onClick={next}>›</IconButton></div></div>
    <div className="calendar-weekdays">{["日", "一", "二", "三", "四", "五", "六"].map(day => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid">{days.map(day => {
      const date = formatDate(day); const dayEvents = events.filter(event => event.date === date); const outside = day.getMonth() !== month; const selected = selectedDate === date;
      return <button key={date} type="button" className={`calendar-day ${outside ? "is-outside" : ""} ${selected ? "is-selected" : ""}`} onClick={() => onSelect(date)} onDoubleClick={() => editable && onAdd?.(date)}>
        <span className="calendar-day-number">{day.getDate()}</span>
        <span className="calendar-events">{dayEvents.slice(0, 2).map(event => <span key={event.id} className={`calendar-mark mark-${event.type === "节假日" ? "holiday" : event.type === "活动日" ? "activity" : "sales"}`}>{event.label}</span>)}{dayEvents.length > 2 && <span className="calendar-more">+{dayEvents.length - 2}</span>}</span>
      </button>;
    })}</div>
    {editable && <div className="calendar-hint"><Sparkles size={14} />双击日期可以快速创建运营标注</div>}
  </div>;
}

export function Drawer({ open, title, description, children, onClose, footer }: { open: boolean; title: string; description?: string; children: ReactNode; onClose: () => void; footer?: ReactNode }) {
  return <AnimatePresence>{open && <><motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} /><motion.aside className="drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 260 }}><div className="drawer-head"><div><div className="eyebrow">DETAIL VIEW</div><h3>{title}</h3>{description && <p>{description}</p>}</div><IconButton label="关闭" onClick={onClose}><X size={18} /></IconButton></div><div className="drawer-body">{children}</div>{footer && <div className="drawer-footer">{footer}</div>}</motion.aside></>}</AnimatePresence>;
}

export function Toast({ message }: { message?: string }) {
  return <AnimatePresence>{message && <motion.div className="toast" initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}><Check size={16} />{message}</motion.div>}</AnimatePresence>;
}

export const icons = { file: <FileText size={16} />, copy: <Copy size={16} />, plus: <Plus size={16} />, chevron: <ChevronRight size={16} />, alert: <AlertCircle size={16} />, clock: <Clock3 size={16} />, calendar: <CalendarDays size={16} />, help: <CircleHelp size={16} /> };
