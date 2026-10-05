import { motion } from "framer-motion";
import { ArrowRight, Check, LockKeyhole, ShieldCheck, Store, UsersRound } from "lucide-react";
import { useState } from "react";
import type { Role, Session } from "../types";
import { trpc } from "../lib/trpc";

const roles: { role: Role; label: string; description: string; icon: React.ReactNode; bullets: string[] }[] = [
  { role: "admin", label: "管理员", description: "治理数据、模板和权限", icon: <ShieldCheck size={20} />, bullets: ["全量数据 CRUD", "日报模板配置", "操作审计追踪"] },
  { role: "operator", label: "运营", description: "协作、回复和复盘", icon: <UsersRound size={20} />, bullets: ["日报和问题跟进", "评论与处理记录", "运营日历标注"] },
  { role: "store", label: "店长", description: "日报、建议和门店备忘", icon: <Store size={20} />, bullets: ["上传经营日报", "复制到微信报账群", "记录门店复盘"] },
];

export default function AccessPage({ onEnter }: { onEnter: (session: Session) => void }) {
  const [role, setRole] = useState<Role>("store");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [storeName, setStoreName] = useState("");
  const [error, setError] = useState("");
  const stores = trpc.ops.publicStores.useQuery(undefined, { retry: false });
  const pinLogin = trpc.auth.pinLogin.useMutation();
  const selected = roles.find(item => item.role === role)!;
  const storeOptions = stores.data || [];
  const submit = async () => {
    setError("");
    if (!name.trim()) return setError("请填写你的姓名或称呼");
    if (!pin.trim()) return setError("请输入口令");
    if (role === "store" && !storeName) return setError("请选择门店");
    try {
      await pinLogin.mutateAsync({ role, name: name.trim(), pin: pin.trim(), storeName: role === "store" ? storeName : undefined });
      onEnter({ role, name: name.trim(), storeName: role === "store" ? storeName : undefined });
      window.location.reload();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "登录失败，请检查口令";
      if (message.includes("DATABASE_UNAVAILABLE") || message.includes("云端数据库暂不可用")) {
        onEnter({ role, name: name.trim(), storeName: role === "store" ? storeName : undefined });
        return;
      }
      setError(message);
    }
  };
  return <div className="access-page"><div className="access-glow access-glow-one" /><div className="access-glow access-glow-two" /><motion.div className="access-layout" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
    <div className="access-intro"><div className="access-brand"><div className="brand-mark brand-mark-large">✦</div><span>ONEIRA <em>梦面包</em></span></div><div className="access-kicker">THE OPERATIONS OS</div><h1>让每一次<br /><span>门店复盘</span>都留下来。</h1><p>从日报到问题，从评论到下一次行动。把门店每天的节奏，变成团队都看得见的经营资产。</p><div className="access-proof"><div><strong>3</strong><span>角色工作台</span></div><div><strong>1</strong><span>统一日报模板</span></div><div><strong>∞</strong><span>可追溯记录</span></div></div></div>
    <div className="access-card"><div className="access-card-head"><div><span className="eyebrow">PASSWORD ENTRY</span><h2>口令进入运营中台</h2><p>不需要账号；门店成员填写自己的姓名，共用本店口令即可。</p></div><div className="secure-badge"><LockKeyhole size={15} />安全入口</div></div><div className="role-switcher">{roles.map(item => <button key={item.role} className={role === item.role ? "is-selected" : ""} onClick={() => { setRole(item.role); setError(""); }}>{item.icon}<span>{item.label}</span><small>{item.description}</small>{role === item.role && <Check size={15} />}</button>)}</div><div className="selected-role-note"><div className="selected-role-icon">{selected.icon}</div><div><strong>{selected.label}工作台</strong><span>{selected.bullets.join(" · ")}</span></div></div><div className="access-form"><label className="field"><span>你的姓名或称呼</span><input value={name} onChange={e => setName(e.target.value)} placeholder="例如：林晓" /></label>{role === "store" && <label className="field"><span>门店</span><select value={storeName} onChange={e => setStoreName(e.target.value)}><option value="">请选择门店</option>{storeOptions.map(store => <option key={store.id} value={store.name}>{store.name}</option>)}</select></label>}<label className="field"><span>口令</span><input type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)} placeholder="请输入工作台口令" onKeyDown={e => { if (e.key === "Enter") void submit(); }} /></label>{error && <p className="form-error">{error}</p>}<button className="enter-button" onClick={() => void submit()} disabled={pinLogin.isPending || stores.isLoading}>{pinLogin.isPending ? "正在进入…" : `进入${selected.label}工作台`} <ArrowRight size={17} /></button></div><div className="access-foot"><span>姓名可由每位成员自行填写，数据统一同步到云端</span><span>v2.1</span></div></div>
  </motion.div></div>;
}
