import { motion } from "framer-motion";
import { ArrowRight, Check, KeyRound, ShieldCheck, Store, UsersRound } from "lucide-react";
import { useState } from "react";
import { trpc } from "../lib/trpc";
import type { Role, Session } from "../types";

const roles: { role: Role; label: string; description: string; icon: React.ReactNode; bullets: string[] }[] = [
  { role: "admin", label: "管理员", description: "治理数据、模板和权限", icon: <ShieldCheck size={20} />, bullets: ["全量数据 CRUD", "修改全部登录口令", "操作审计追踪"] },
  { role: "operator", label: "运营", description: "协作、回复和复盘", icon: <UsersRound size={20} />, bullets: ["日报和问题跟进", "评论与处理记录", "运营日历标注"] },
  { role: "store", label: "店长", description: "日报、建议和门店备忘", icon: <Store size={20} />, bullets: ["上传经营日报", "复制到微信报账群", "记录门店复盘"] },
];

export default function AccessPage({ onEnter }: { onEnter: (session: Session) => void }) {
  const [role, setRole] = useState<Role>("admin");
  const [pin, setPin] = useState("");
  const [storeName, setStoreName] = useState("");
  const [identityName, setIdentityName] = useState("");
  const [error, setError] = useState("");
  const selected = roles.find(item => item.role === role)!;
  const stores = trpc.ops.publicStores.useQuery(undefined, { retry: false });
  const login = trpc.auth.loginWithPin.useMutation();
  const utils = trpc.useUtils();
  const submit = async () => {
    setError("");
    try {
      const result = await login.mutateAsync({ role, pin, storeName: role === "store" ? storeName : undefined, identityName: role === "store" ? identityName.trim() : undefined });
      if (!result || !result.role || !["admin", "operator", "store"].includes(result.role)) throw new Error("登录信息无效");
      await utils.auth.me.invalidate();
      onEnter({ role: result.role as Role, name: result.name || selected.label, storeName: result.storeName || undefined });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "口令验证失败，请重试");
    }
  };
  return <div className="access-page"><div className="access-glow access-glow-one" /><div className="access-glow access-glow-two" /><motion.div className="access-layout" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
    <div className="access-intro"><div className="access-brand"><div className="brand-mark brand-mark-large">✦</div><span>ONEIRA <em>梦面包</em></span></div><div className="access-kicker">THE OPERATIONS OS</div><h1>让每一次<br /><span>门店复盘</span>都留下来。</h1><p>从日报到问题，从评论到下一次行动。把门店每天的节奏，变成团队都看得见的经营资产。</p><div className="access-proof"><div><strong>3</strong><span>角色工作台</span></div><div><strong>1</strong><span>统一日报模板</span></div><div><strong>∞</strong><span>可追溯记录</span></div></div></div>
    <div className="access-card"><div className="access-card-head"><div><span className="eyebrow">SECURE ACCESS</span><h2>进入运营中台</h2><p>选择你的工作角色，使用管理员分配的口令进入。</p></div><div className="secure-badge"><KeyRound size={15} />口令入口</div></div><div className="role-switcher">{roles.map(item => <button key={item.role} className={role === item.role ? "is-selected" : ""} onClick={() => { setRole(item.role); setError(""); setPin(""); }}>{item.icon}<span>{item.label}</span><small>{item.description}</small>{role === item.role && <Check size={15} />}</button>)}</div><div className="selected-role-note"><div className="selected-role-icon">{selected.icon}</div><div><strong>{selected.label}工作台</strong><span>{selected.bullets.join(" · ")}</span></div></div><div className="access-form">{role === "store" && <><label className="field"><span>选择门店</span><select value={storeName} onChange={e => setStoreName(e.target.value)}><option value="">请选择门店</option>{stores.data?.map(store => <option key={store.id} value={store.name}>{store.name}</option>)}</select></label><label className="field"><span>本次提交人姓名</span><input value={identityName} onChange={e => setIdentityName(e.target.value.slice(0, 40))} placeholder="请输入今天实际提交日报的人" /></label></>}<label className="field"><span>{selected.label}口令</span><input type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))} onKeyDown={e => { if (e.key === "Enter") void submit(); }} placeholder="请输入 4-12 位数字口令" /></label>{error && <div className="access-error">{error}</div>}<button className="enter-button" disabled={login.isPending || pin.length < 4 || (role === "store" && (!storeName || !identityName.trim()))} onClick={() => void submit()}><KeyRound size={17} />{login.isPending ? "正在验证…" : `进入${selected.label}工作台`} <ArrowRight size={17} /></button></div><div className="access-foot"><span>同一门店口令可由不同员工使用，姓名会记录在日报中</span><span>v2.2</span></div></div>
  </motion.div></div>;
}
