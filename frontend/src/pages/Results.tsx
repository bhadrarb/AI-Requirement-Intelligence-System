import { useState, useEffect } from "react";
import type { PipelineResult, Task } from "../App";

const API = "http://localhost:8000";

const PC: Record<string,string> = { high:"#ef4444", medium:"#f59e0b", low:"#22c55e" };
const TC: Record<string,string> = { functional:"#6366f1", "non-functional":"#8b5cf6", non_functional:"#8b5cf6" };
const RC: Record<string,string> = { High:"#ef4444", Medium:"#f59e0b", Low:"#22c55e" };
const CONF_COLOR: Record<string,string> = {
  High:"#22c55e", Medium:"#f59e0b", Fragile:"#ef4444",
  "No Candidate":"#94a3b8", "Only Candidate":"#6366f1",
};
const ACTION_COLOR: Record<string,string> = {
  UPSKILL:"#6366f1", REDISTRIBUTE:"#f59e0b", HIRE:"#ef4444", EXTEND_DEADLINE:"#94a3b8",
};
const ACTION_ICON: Record<string,string> = {
  UPSKILL:"↑ Train", REDISTRIBUTE:"⇄ Move tasks", HIRE:"+ Hire", EXTEND_DEADLINE:"⏱ Extend",
};
const CASCADE_COLOR: Record<string,string> = {
  Critical:"#ef4444", High:"#f97316", Medium:"#f59e0b", Low:"#22c55e",
};

function normaliseType(t: string): string {
  return t === "non_functional" ? "non-functional" : t;
}

const Badge = ({ label, bg, color }: { label:string; bg:string; color:string }) => (
  <span style={{ background:bg, color, borderRadius:999, padding:"2px 9px", fontSize:11, fontWeight:700, display:"inline-block" }}>
    {label}
  </span>
);

function TSIGauge({ tsi, status }: { tsi:number; status:string }) {
  const pct    = Math.round(tsi * 100);
  const radius = 36;
  const circ   = 2 * Math.PI * radius;
  const dash   = (pct / 100) * circ;
  const color  = pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display:"flex", flexDirection:"column" as const, alignItems:"center", gap:6 }}>
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="8"/>
        <circle cx="48" cy="48" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 48 48)"/>
        <text x="48" y="44" textAnchor="middle" fontSize="16" fontWeight="700" fill={color}>{pct}%</text>
        <text x="48" y="60" textAnchor="middle" fontSize="9" fill="#94a3b8">TSI</text>
      </svg>
      <span style={{ fontSize:12, fontWeight:700, color }}>{status}</span>
    </div>
  );
}

function CorrectiveCard({ action }: { action:any }) {
  const color = ACTION_COLOR[action.action] || "#64748b";
  const icon  = ACTION_ICON[action.action]  || action.action;
  return (
    <div style={{ background:color+"10", border:`1.5px solid ${color}30`, borderRadius:10, padding:"12px 16px", marginBottom:8 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
        <span style={{ background:color, color:"#fff", borderRadius:6, padding:"2px 10px", fontSize:11, fontWeight:700 }}>{icon}</span>
        {action.developer  && <span style={{ fontSize:12, fontWeight:700, color:"#1e293b" }}>{action.developer}</span>}
        {action.skill_needed && <Badge label={action.skill_needed} bg={color+"20"} color={color}/>}
      </div>
      <div style={{ fontSize:12, color:"#64748b", lineHeight:1.5 }}>{action.reason}</div>
    </div>
  );
}

// ── PHASE 5: Risk type card ───────────────────────────────────────────────
function RiskTypeCard({ title, data, icon }: { title:string; data:any; icon:string }) {
  const [open, setOpen] = useState(false);
  const level = data?.level || "Low";
  const color = RC[level] || "#22c55e";
  return (
    <div style={{ background:"#fff", border:`1.5px solid ${color}40`, borderLeft:`4px solid ${color}`, borderRadius:12, padding:20, marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }} onClick={()=>setOpen(!open)}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:20 }}>{icon}</span>
          <div>
            <div style={{ fontWeight:800, fontSize:14, color:"#0f172a" }}>{title}</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{data?.description}</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ background:color+"20", color, borderRadius:999, padding:"4px 14px", fontSize:12, fontWeight:700 }}>{level} Risk</span>
          <span style={{ color:"#94a3b8", fontSize:14 }}>{open?"▲":"▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid #f0f0f0" }}>
          {/* Score bar */}
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
              <span style={{ color:"#64748b" }}>Risk score</span>
              <span style={{ fontWeight:700, color }}>{((data.score||0)*100).toFixed(0)}%</span>
            </div>
            <div style={{ background:"#f3f4f6", borderRadius:999, height:8, overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:999, width:`${Math.min(100,(data.score||0)*100)}%`, background:color, transition:"width 0.5s" }}/>
            </div>
          </div>

          {/* Type-specific details */}
          {data.affected_developers?.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", letterSpacing:2, marginBottom:6 }}>AFFECTED DEVELOPERS</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" as const }}>
                {data.affected_developers.map((d:string)=>(
                  <Badge key={d} label={d} bg={color+"15"} color={color}/>
                ))}
              </div>
            </div>
          )}

          {data.sprint_utilisation != null && (
            <div style={{ display:"flex", gap:12, marginBottom:12, flexWrap:"wrap" as const }}>
              {[
                { l:"Total points",   v:String(data.total_points||0) },
                { l:"Sprint capacity",v:String(data.sprint_capacity||0) },
                { l:"Utilisation",    v:(data.sprint_utilisation||0)+"%", color: data.sprint_utilisation>100?"#ef4444":"#22c55e" },
                { l:"Unassigned",     v:String(data.unassigned_tasks||0), color: data.unassigned_tasks>0?"#ef4444":"#22c55e" },
              ].map(item=>(
                <div key={item.l} style={{ background:"#f8fafc", borderRadius:8, padding:"10px 16px", flex:1, minWidth:100 }}>
                  <div style={{ fontSize:11, color:"#94a3b8", marginBottom:3 }}>{item.l}</div>
                  <div style={{ fontWeight:700, fontSize:15, color:(item as any).color||"#1e293b" }}>{item.v}</div>
                </div>
              ))}
            </div>
          )}

          {data.tsi != null && (
            <div style={{ display:"flex", gap:12, marginBottom:12, flexWrap:"wrap" as const }}>
              {[
                { l:"TSI score",  v:((data.tsi||0)*100).toFixed(0)+"%" },
                { l:"Status",     v:data.tsi_status||"—" },
                { l:"Tasks causing drops", v:String(data.tsi_drops||0) },
              ].map(item=>(
                <div key={item.l} style={{ background:"#f8fafc", borderRadius:8, padding:"10px 16px", flex:1, minWidth:100 }}>
                  <div style={{ fontSize:11, color:"#94a3b8", marginBottom:3 }}>{item.l}</div>
                  <div style={{ fontWeight:700, fontSize:15, color:"#1e293b" }}>{item.v}</div>
                </div>
              ))}
            </div>
          )}

          {data.critical_skills?.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", letterSpacing:2, marginBottom:8 }}>CRITICAL SKILLS (SINGLE DEVELOPER)</div>
              {data.critical_skills.map((cs:any)=>(
                <div key={cs.skill} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, marginBottom:6 }}>
                  <Badge label={cs.skill} bg="#fee2e2" color="#dc2626"/>
                  <span style={{ fontSize:12, color:"#374151" }}>Only <strong>{cs.only_developer}</strong> — {cs.tasks_affected} tasks ({cs.total_pts} pts)</span>
                </div>
              ))}
            </div>
          )}

          {data.fragile_count != null && (
            <div style={{ display:"flex", gap:12, marginBottom:12, flexWrap:"wrap" as const }}>
              {[
                { l:"Fragile assignments", v:String(data.fragile_count||0) },
                { l:"No candidate",        v:String(data.no_candidate||0), color: data.no_candidate>0?"#ef4444":"#22c55e" },
                { l:"Fragility ratio",     v:(data.fragility_ratio||0)+"%" },
              ].map(item=>(
                <div key={item.l} style={{ background:"#f8fafc", borderRadius:8, padding:"10px 16px", flex:1, minWidth:100 }}>
                  <div style={{ fontSize:11, color:"#94a3b8", marginBottom:3 }}>{item.l}</div>
                  <div style={{ fontWeight:700, fontSize:15, color:(item as any).color||"#1e293b" }}>{item.v}</div>
                </div>
              ))}
            </div>
          )}

          {/* Mitigation steps */}
          {data.mitigation?.length > 0 && (
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", letterSpacing:2, marginBottom:8 }}>MITIGATION STEPS</div>
              {data.mitigation.map((m:string, i:number)=>(
                <div key={i} style={{ display:"flex", gap:10, padding:"8px 12px", background:"#f0fdf4", border:"1px solid #86efac", borderRadius:8, marginBottom:6, fontSize:13, color:"#15803d" }}>
                  <span style={{ fontWeight:700 }}>→</span>{m}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PHASE 5: Dependency chain component ──────────────────────────────────
function DependencyChain({ dep }: { dep:any }) {
  const color = CASCADE_COLOR[dep.cascade_risk] || "#22c55e";
  return (
    <div style={{ background:color+"08", border:`1px solid ${color}30`, borderRadius:10, padding:"14px 16px", marginBottom:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" as const }}>
        <span style={{ background:"#eef2ff", color:"#4338ca", borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{dep.task_id}</span>
        <span style={{ fontSize:12, color:"#64748b" }}>depends on</span>
        <span style={{ background:"#f0fdf4", color:"#15803d", borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{dep.depends_on}</span>
        <span style={{ marginLeft:"auto" }}>
          <Badge label={dep.cascade_risk+" cascade risk"} bg={color+"20"} color={color}/>
        </span>
      </div>
      <div style={{ fontSize:12, color:"#374151", marginBottom:4 }}>{dep.task_title}</div>
      <div style={{ fontSize:11, color:color, fontWeight:600, marginTop:4 }}>{dep.cascade_reason}</div>
    </div>
  );
}

// ── Explainability drawer ─────────────────────────────────────────────────
function ExplainDrawer({ task, onClose }: { task:Task; onClose:()=>void }) {
  const ta    = task as any;
  const evals: any[] = ta.all_evaluations || [];
  const corrective: any[] = ta.corrective_actions || [];

  return (
    <div style={{ position:"fixed" as const, inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:16, padding:28, maxWidth:740, width:"100%", maxHeight:"88vh", overflowY:"auto" as const, boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:"#0f172a", marginBottom:4 }}>{task.task_id} — Explainability Report</div>
            <div style={{ fontSize:13, color:"#64748b" }}>{task.title}</div>
          </div>
          <button onClick={onClose} style={{ background:"#f1f5f9", border:"none", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:13, fontWeight:700 }}>Close</button>
        </div>

        <div style={{ display:"flex", gap:10, flexWrap:"wrap" as const, marginBottom:20 }}>
          {[
            { label:"ASSIGNED TO", val:ta.assigned_name||ta.assigned_to||"Unassigned", bg:"#eef2ff", color:"#6366f1" },
            { label:"SCORE",       val:ta.assignment_score?.toFixed(3)??"—",           bg:"#f0fdf4", color:"#15803d" },
            { label:"CONFIDENCE",  val:ta.allocation_confidence||"—",                  bg:"#fff7ed", color:"#d97706" },
            { label:"RISK",        val:`${ta.risk_level||"—"} (${(ta.risk_score??0).toFixed(2)})`, bg:"#fef2f2", color:"#dc2626" },
          ].map(item=>(
            <div key={item.label} style={{ background:item.bg, borderRadius:10, padding:"12px 18px", flex:1, minWidth:130 }}>
              <div style={{ fontSize:10, fontWeight:700, color:item.color, letterSpacing:2, marginBottom:4 }}>{item.label}</div>
              <div style={{ fontWeight:800, fontSize:14, color:"#1e293b" }}>{item.val}</div>
            </div>
          ))}
        </div>

        {ta.formula && (
          <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px 14px", marginBottom:12, fontFamily:"monospace", fontSize:13, color:"#334155" }}>
            <span style={{ fontWeight:700, color:"#6366f1" }}>Score formula: </span>{ta.formula}
          </div>
        )}
        {ta.nonlinear_penalty>0 && (
          <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:8, padding:"8px 14px", marginBottom:16, fontSize:12, color:"#c2410c" }}>
            ⚠️ Overload penalty applied: <strong>{ta.nonlinear_penalty.toFixed(3)}</strong> — developer was above 80% capacity
          </div>
        )}

        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" as const }}>
          {[
            { l:"TSI before", v:((ta.tsi_before||0)*100).toFixed(0)+"%" },
            { l:"TSI after",  v:((ta.tsi_after||0)*100).toFixed(0)+"%" },
            { l:"Impact",     v:(ta.tsi_impact>=0?"+":"")+((ta.tsi_impact||0)*100).toFixed(1)+"%", color:(ta.tsi_impact||0)>=0?"#22c55e":"#ef4444" },
            { l:"Meaning",    v:ta.impact_meaning||"—" },
          ].map(item=>(
            <div key={item.l} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px 14px", flex:1, minWidth:110 }}>
              <div style={{ fontSize:11, color:"#94a3b8", marginBottom:2 }}>{item.l}</div>
              <div style={{ fontWeight:700, fontSize:14, color:(item as any).color||"#1e293b" }}>{item.v}</div>
            </div>
          ))}
        </div>

        {ta.risk_reason && (
          <div style={{ background:(RC[ta.risk_level]||"#888")+"15", border:`1px solid ${(RC[ta.risk_level]||"#888")}40`, borderRadius:8, padding:"10px 14px", marginBottom:20, fontSize:13, color:"#374151" }}>
            <span style={{ fontWeight:700 }}>Risk reason: </span>{ta.risk_reason}
          </div>
        )}

        {corrective.length>0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, letterSpacing:2, color:"#94a3b8", fontWeight:700, marginBottom:10 }}>SUGGESTED CORRECTIVE ACTIONS</div>
            {corrective.map((a:any,i:number)=><CorrectiveCard key={i} action={a}/>)}
          </div>
        )}

        {evals.length>0 && (
          <>
            <div style={{ fontSize:11, letterSpacing:2, color:"#94a3b8", fontWeight:700, marginBottom:10 }}>ALL DEVELOPER EVALUATIONS</div>
            <div style={{ overflowX:"auto" as const }}>
              <table style={{ width:"100%", borderCollapse:"collapse" as const, fontSize:12 }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    {["Developer","Skill Match","Workload","Penalty","Score","Eligible","Code"].map(h=>(
                      <th key={h} style={{ padding:"8px 12px", textAlign:"left" as const, fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase" as const, borderBottom:"1.5px solid #e2e8f0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {evals.map((ev:any,idx:number)=>{
                    const isChosen=ev.emp_id===task.assigned_to;
                    return (
                      <tr key={idx} style={{ background:isChosen?"#eef2ff":idx%2===0?"#fff":"#fafafa", borderBottom:"1px solid #f3f4f6" }}>
                        <td style={{ padding:"8px 12px", fontWeight:isChosen?700:400 }}>
                          {ev.name}{isChosen&&<span style={{ marginLeft:6, background:"#6366f1", color:"#fff", borderRadius:4, padding:"1px 6px", fontSize:10 }}>selected</span>}
                        </td>
                        <td style={{ padding:"8px 12px" }}>{ev.skill_match!=null?(ev.skill_match*100).toFixed(0)+"%":"—"}</td>
                        <td style={{ padding:"8px 12px", color:ev.workload_ratio>0.8?"#ef4444":"inherit" }}>{ev.workload_ratio!=null?(ev.workload_ratio*100).toFixed(0)+"%":"—"}</td>
                        <td style={{ padding:"8px 12px", color:ev.nonlinear_penalty>0?"#d97706":"#94a3b8" }}>{ev.nonlinear_penalty!=null&&ev.nonlinear_penalty>0?"-"+ev.nonlinear_penalty.toFixed(3):"—"}</td>
                        <td style={{ padding:"8px 12px", fontWeight:700, color:ev.constraint_passed?"#1e293b":"#94a3b8" }}>{ev.constraint_passed?ev.score?.toFixed(3):"—"}</td>
                        <td style={{ padding:"8px 12px" }}><span style={{ color:ev.constraint_passed?"#22c55e":"#ef4444", fontWeight:700 }}>{ev.constraint_passed?"Yes":"No"}</span></td>
                        <td style={{ padding:"8px 12px" }}>
                          {ev.reason_code&&<span style={{ background:ev.reason_code==="ELIGIBLE"?"#dcfce7":ev.reason_code==="NO_SKILL_MATCH"?"#fee2e2":"#fef3c7", color:ev.reason_code==="ELIGIBLE"?"#15803d":ev.reason_code==="NO_SKILL_MATCH"?"#dc2626":"#92400e", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700 }}>{ev.reason_code}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Metrics tab ───────────────────────────────────────────────────────────
function MetricsTab() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  useEffect(()=>{
    fetch(`${API}/metrics`).then(r=>r.json()).then(d=>{setMetrics(d);setLoading(false);}).catch(()=>{setError("Could not load metrics.");setLoading(false);});
  },[]);
  if(loading) return <div style={{ padding:40, textAlign:"center" as const, color:"#94a3b8" }}>Loading...</div>;
  if(error)   return <div style={{ padding:20, background:"#fef2f2", borderRadius:10, color:"#dc2626" }}>{error}</div>;
  if(!metrics) return null;
  const models=[
    { key:"classifier_metrics", name:"SVM Classifier",        desc:"Functional vs Non-Functional", color:"#6366f1", isReg:false },
    { key:"priority_metrics",   name:"RF Priority Predictor", desc:"High / Medium / Low",          color:"#f59e0b", isReg:false },
    { key:"effort_metrics",     name:"RF Effort Estimator",   desc:"Story Points 1–13",            color:"#10b981", isReg:true  },
  ];
  return (
    <div>
      <div style={{ marginBottom:20, padding:"14px 18px", background:"#eef2ff", borderRadius:10, fontSize:13, color:"#4338ca", lineHeight:1.6 }}>
        These metrics were saved when you ran <code style={{ background:"#ddd6fe", padding:"1px 6px", borderRadius:4 }}>python train_models.py</code>.
      </div>
      {models.map(m=>{
        const data=metrics[m.key];
        if(!data) return (
          <div key={m.key} style={{ background:"#fff", borderLeft:`4px solid ${m.color}`, borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ fontWeight:800, fontSize:15, color:"#0f172a", marginBottom:6 }}>{m.name}</div>
            <div style={{ fontSize:13, color:"#94a3b8" }}>No data. Run <code>python train_models.py</code> first.</div>
          </div>
        );
        return (
          <div key={m.key} style={{ background:"#fff", border:"1.5px solid #f0f0f0", borderLeft:`4px solid ${m.color}`, borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
              <div><div style={{ fontWeight:800, fontSize:15, color:"#0f172a" }}>{m.name}</div><div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{m.desc}</div></div>
              <div style={{ textAlign:"right" as const }}>
                {m.isReg?<><div style={{ fontSize:28, fontWeight:900, color:m.color }}>{(data.cv_mae_mean||0).toFixed(2)}</div><div style={{ fontSize:11, color:"#94a3b8" }}>avg error (pts)</div></>
                        :<><div style={{ fontSize:28, fontWeight:900, color:m.color }}>{((data.cv_f1_mean||0)*100).toFixed(1)}%</div><div style={{ fontSize:11, color:"#94a3b8" }}>CV F1</div></>}
              </div>
            </div>
            {!m.isReg&&data.report&&(
              <table style={{ width:"100%", borderCollapse:"collapse" as const, fontSize:12 }}>
                <thead><tr style={{ background:"#f8fafc" }}>{["Class","Precision","Recall","F1","Support"].map(h=><th key={h} style={{ padding:"8px 12px", textAlign:"left" as const, fontSize:11, fontWeight:700, color:"#64748b", borderBottom:"1.5px solid #e2e8f0" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {Object.entries(data.report).filter(([k])=>!["accuracy","macro avg","weighted avg"].includes(k)).map(([cls,vals]:any,i:number)=>(
                    <tr key={cls} style={{ background:i%2===0?"#fff":"#fafafa", borderBottom:"1px solid #f3f4f6" }}>
                      <td style={{ padding:"8px 12px", fontWeight:700, textTransform:"capitalize" as const }}>{cls.replace("_","-")}</td>
                      <td style={{ padding:"8px 12px" }}>{(vals.precision*100).toFixed(1)}%</td>
                      <td style={{ padding:"8px 12px" }}>{(vals.recall*100).toFixed(1)}%</td>
                      <td style={{ padding:"8px 12px", fontWeight:700, color:m.color }}>{(vals["f1-score"]*100).toFixed(1)}%</td>
                      <td style={{ padding:"8px 12px", color:"#94a3b8" }}>{vals.support}</td>
                    </tr>
                  ))}
                  {data.report.accuracy!=null&&<tr style={{ background:"#f0fdf4", borderTop:"2px solid #e2e8f0" }}><td style={{ padding:"8px 12px", fontWeight:700, color:"#15803d" }}>Overall</td><td colSpan={3} style={{ padding:"8px 12px", fontWeight:700, color:"#15803d" }}>{(data.report.accuracy*100).toFixed(1)}%</td><td style={{ padding:"8px 12px", color:"#94a3b8" }}>{data.n_samples} samples</td></tr>}
                </tbody>
              </table>
            )}
            {m.isReg&&<div style={{ display:"flex", gap:12, flexWrap:"wrap" as const }}>{[{l:"CV MAE",v:(data.cv_mae_mean||0).toFixed(2)+" pts"},{l:"±Std",v:"±"+(data.cv_mae_std||0).toFixed(2)},{l:"Train MAE",v:(data.train_mae||0).toFixed(2)+" pts"},{l:"Samples",v:String(data.n_samples||0)}].map(item=><div key={item.l} style={{ background:"#f8fafc", borderRadius:8, padding:"10px 16px", flex:1, minWidth:90 }}><div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>{item.l}</div><div style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{item.v}</div></div>)}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function ResultsPage({ result, onBack }: { result:PipelineResult; onBack:()=>void }) {
  const [tab, setTab]               = useState<"overview"|"requirements"|"conflicts"|"tasks"|"traceability"|"risks"|"metrics">("overview");
  const [tasks, setTasks]           = useState<Task[]>(result.tasks);
  const [reqFilter, setReqFilter]   = useState("all");
  const [taskFilter, setTaskFilter] = useState("ALL");
  const [explainTask, setExplainTask] = useState<Task|null>(null);

  // Phase 5: risk report and dependencies state
  const [riskReport, setRiskReport]     = useState<any>(null);
  const [dependencies, setDependencies] = useState<any[]>([]);
  const [riskLoading, setRiskLoading]   = useState(false);
  const [riskError, setRiskError]       = useState("");

  const s = result.summary ?? {
    total_requirements: result.requirements?.length??0,
    validated: result.requirements?.length??0,
    flagged:0,
    functional: result.requirements?.filter(r=>!r.type?.startsWith("non")).length??0,
    non_functional: result.requirements?.filter(r=>r.type?.startsWith("non")).length??0,
    high_priority: result.requirements?.filter(r=>r.priority==="high").length??0,
    total_tasks: result.tasks?.length??0,
    assigned_tasks: result.tasks?.filter(t=>t.assigned_to).length??0,
    total_story_points: result.tasks?.reduce((a,t)=>a+(t.story_points||0),0)??0,
    estimated_total_days: result.tasks?.reduce((a,t)=>a+(t.story_points||0),0)??0,
  };

  const totalIssues    = (result.mismatches.duplicates?.length||0)+(result.mismatches.conflicts?.length||0)+(result.mismatches.ambiguities?.length||0);
  const moveTask       = (id:string, status:string) => setTasks(prev=>prev.map(t=>t.task_id===id?{...t,status}:t));
  const unassignedTasks = tasks.filter(t=>!t.assigned_to);

  const filtReqs  = result.requirements.filter(r=>{ const nt=normaliseType(r.type); return reqFilter==="all"||nt===reqFilter||r.priority===reqFilter; });
  const filtTasks = taskFilter==="ALL"?tasks:tasks.filter(t=>t.status===taskFilter||t.priority===taskFilter.toLowerCase());

  const trace        = result.traceability as any;
  const reqToTasks   = trace?.requirement_to_tasks  ||{};
  const reqStatus    = trace?.requirement_status     ||{};
  const teamWorkload = trace?.team_workload           ||{};
  const coverageRate = trace?.coverage_rate           ??0;
  const tsi          = trace?.team_stability_index    ??null;
  const tsiStatus    = trace?.tsi_status              ||"";
  const riskSummary  = trace?.risk_summary            ||{};
  const busFactorRisks: any[] = trace?.skill_concentration_risk||[];

  const traceRows = result.requirements.map(r=>({
    req_id:r.req_id, req_text:r.text, type:normaliseType(r.type), priority:r.priority,
    story_points:r.story_points??r.effort_points??0, task_ids:(reqToTasks[r.req_id] as string[])||[],
    status:(reqStatus[r.req_id] as string)||"GAP",
  }));

  // Load risk report when Risks tab is opened
  useEffect(()=>{
    if(tab==="risks" && !riskReport && !riskLoading){
      setRiskLoading(true);
      setRiskError("");
      fetch(`${API}/risk-report`)
        .then(r=>r.json())
        .then(d=>{
          if(d.status==="success"){
            setRiskReport(d.risk_report);
            setDependencies(d.dependencies||[]);
          } else {
            setRiskError("Failed to load risk report.");
          }
          setRiskLoading(false);
        })
        .catch(()=>{ setRiskError("Backend error loading risk report."); setRiskLoading(false); });
    }
  },[tab]);

  const TABS = ["overview","requirements","conflicts","tasks","traceability","risks","metrics"] as const;

  return (
    <div style={S.page}>
      {explainTask && <ExplainDrawer task={explainTask} onClose={()=>setExplainTask(null)}/>}

      <div style={S.header}>
        <button onClick={onBack} style={S.back}>← New Analysis</button>
        <div style={S.headerTitle}>REQUIREMENT INTELLIGENCE — RESULTS</div>
        <div style={S.headerBadge}>{s.total_requirements} requirements processed</div>
      </div>

      <div style={S.statGrid}>
        {[
          { v:s.total_requirements, l:"Total Requirements",   sub:`${s.functional} func · ${s.non_functional??0} non-func`, c:"#6366f1" },
          { v:s.validated,          l:"Validated",            sub:`${s.flagged} flagged`,                c:"#22c55e" },
          { v:totalIssues,          l:"Issues Found",         sub:`${result.mismatches.duplicates?.length||0} dup · ${result.mismatches.conflicts?.length||0} conflict`, c:"#ef4444" },
          { v:s.total_tasks,        l:"Tasks Generated",      sub:`${s.assigned_tasks} assigned`,        c:"#f59e0b" },
          { v:s.total_story_points, l:"Story Points",         sub:`~${s.estimated_total_days} dev days`, c:"#06b6d4" },
          { v:s.high_priority,      l:"High Priority",        sub:"need immediate attention",            c:"#ef4444" },
        ].map(c=>(
          <div key={c.l} style={{ ...S.statCard, borderTopColor:c.c }}>
            <div style={{ fontSize:34, fontWeight:900, color:c.c }}>{c.v}</div>
            <div style={{ fontSize:12, fontWeight:700, color:"#1e293b", marginTop:4 }}>{c.l}</div>
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:3 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={S.tabBar}>
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{ ...S.tab, ...(tab===t?S.tabOn:{}) }}>
            {t==="conflicts"&&totalIssues>0&&<span style={S.tabBadge}>{totalIssues}</span>}
            {t==="risks"&&unassignedTasks.length>0&&<span style={{ ...S.tabBadge, background:"#f59e0b" }}>{unassignedTasks.length}</span>}
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      <div style={S.body}>

        {/* ── OVERVIEW ── */}
        {tab==="overview" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:16, marginBottom:16 }}>
              <div style={S.panel}>
                <div style={S.panelTitle}>REQUIREMENT TYPES</div>
                {([["Functional",s.functional,"#6366f1"],["Non-Functional",s.non_functional??0,"#8b5cf6"]] as [string,number,string][]).map(([l,v,c])=>(
                  <div key={l} style={{ marginBottom:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}><span style={{ fontWeight:600 }}>{l}</span><span style={{ color:"#94a3b8" }}>{v}</span></div>
                    <div style={S.barBg}><div style={{ ...S.barFill, width:`${(v/Math.max(s.total_requirements,1)*100).toFixed(0)}%`, background:c }}/></div>
                  </div>
                ))}
              </div>
              <div style={S.panel}>
                <div style={S.panelTitle}>PRIORITY DISTRIBUTION</div>
                {(["high","medium","low"] as const).map(p=>{
                  const cnt=result.requirements.filter(r=>r.priority===p).length;
                  return (
                    <div key={p} style={{ marginBottom:14 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}><span style={{ fontWeight:600, textTransform:"capitalize" as const }}>{p}</span><span style={{ color:"#94a3b8" }}>{cnt}</span></div>
                      <div style={S.barBg}><div style={{ ...S.barFill, width:`${(cnt/Math.max(s.validated||s.total_requirements,1)*100).toFixed(0)}%`, background:PC[p] }}/></div>
                    </div>
                  );
                })}
              </div>
              {tsi!==null&&<div style={{ ...S.panel, display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center", minWidth:150 }}><div style={S.panelTitle}>TEAM STABILITY</div><TSIGauge tsi={tsi} status={tsiStatus}/></div>}
            </div>

            <div style={S.panel}>
              <div style={S.panelTitle}>ESTIMATED EFFORT BY PRIORITY</div>
              <div style={{ display:"flex", gap:12, flexWrap:"wrap" as const, marginTop:12 }}>
                {(["high","medium","low"] as const).map(p=>{
                  const pts=result.requirements.filter(r=>r.priority===p).reduce((a,r)=>a+((r.story_points||r.effort_points)||0),0);
                  return (<div key={p} style={{ background:"#f8fafc", border:`2px solid ${PC[p]}33`, borderRadius:12, padding:"16px 24px", textAlign:"center" as const, minWidth:110 }}><div style={{ fontSize:30, fontWeight:900, color:PC[p] }}>{pts}</div><div style={{ fontSize:12, color:"#64748b", marginTop:4, textTransform:"capitalize" as const }}>{p} priority</div><div style={{ fontSize:11, color:"#94a3b8" }}>story points</div></div>);
                })}
              </div>
            </div>

            {Object.keys(teamWorkload).length>0&&(
              <div style={S.panel}>
                <div style={S.panelTitle}>TEAM WORKLOAD (STORY POINTS ASSIGNED)</div>
                {Object.entries(teamWorkload).map(([empId,pts])=>{
                  const empName=tasks.find(t=>t.assigned_to===empId)?.assigned_name||empId;
                  const pct=Math.min(100,Math.round(((pts as number)/20)*100));
                  const barColor=pct>80?"#ef4444":pct>60?"#f59e0b":"#6366f1";
                  return (<div key={empId} style={{ marginBottom:14 }}><div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}><span style={{ fontWeight:600 }}>{empName}</span><span style={{ color:pct>80?"#ef4444":"#94a3b8", fontWeight:pct>80?700:400 }}>{pts as number}/20 pts ({pct}%){pct>80?" ⚠️":""}</span></div><div style={S.barBg}><div style={{ ...S.barFill, width:`${pct}%`, background:barColor }}/></div></div>);
                })}
              </div>
            )}

            {Object.keys(riskSummary).length>0&&(
              <div style={S.panel}>
                <div style={S.panelTitle}>TASK RISK SUMMARY</div>
                <div style={{ display:"flex", gap:14, flexWrap:"wrap" as const }}>
                  {Object.entries(riskSummary).map(([level,count])=>(
                    <div key={level} style={{ background:(RC[level]||"#888")+"15", border:`2px solid ${(RC[level]||"#888")}40`, borderRadius:12, padding:"18px 28px", textAlign:"center" as const }}>
                      <div style={{ fontSize:32, fontWeight:900, color:RC[level]||"#888" }}>{count as number}</div>
                      <div style={{ fontSize:12, fontWeight:700, color:RC[level]||"#888", marginTop:4 }}>{level} Risk</div>
                      <div style={{ fontSize:11, color:"#94a3b8" }}>tasks</div>
                    </div>
                  ))}
                  <div style={{ background:"#f0fdf4", border:"2px solid #86efac", borderRadius:12, padding:"18px 28px", textAlign:"center" as const }}>
                    <div style={{ fontSize:32, fontWeight:900, color:"#15803d" }}>{coverageRate}%</div>
                    <div style={{ fontSize:12, fontWeight:700, color:"#15803d", marginTop:4 }}>Coverage</div>
                  </div>
                  {unassignedTasks.length>0&&(
                    <div style={{ background:"#fff7ed", border:"2px solid #fed7aa", borderRadius:12, padding:"18px 28px", textAlign:"center" as const }}>
                      <div style={{ fontSize:32, fontWeight:900, color:"#d97706" }}>{unassignedTasks.length}</div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#d97706", marginTop:4 }}>Unassigned</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── REQUIREMENTS ── */}
        {tab==="requirements"&&(
          <div>
            <div style={S.filterRow}>
              {["all","functional","non-functional","high","medium","low"].map(f=>(
                <button key={f} onClick={()=>setReqFilter(f)} style={{ ...S.fBtn, background:reqFilter===f?"#6366f1":"#fff", color:reqFilter===f?"#fff":"#64748b", borderColor:reqFilter===f?"#6366f1":"#e2e8f0" }}>{f.toUpperCase()}</button>
              ))}
              <span style={{ marginLeft:"auto", fontSize:12, color:"#94a3b8", alignSelf:"center" }}>{filtReqs.length} shown</span>
            </div>
            {filtReqs.map(req=>{
              const nt=normaliseType(req.type);
              return (
                <div key={req.req_id} style={S.reqCard}>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" as const, marginBottom:8, alignItems:"center" }}>
                    <span style={S.reqId}>{req.req_id}</span>
                    <Badge label={nt} bg={(TC[nt]||"#6366f1")+"20"} color={TC[nt]||"#6366f1"}/>
                    <Badge label={(req.type_confidence*100).toFixed(0)+"%"} bg="#f3f4f6" color="#374151"/>
                    <Badge label={req.priority||"?"} bg={(PC[req.priority]||"#888")+"20"} color={PC[req.priority]||"#888"}/>
                    <Badge label={(req.story_points||req.effort_points||"?")+"SP"} bg="#e0f2fe" color="#0284c7"/>
                    <Badge label={"conf: "+((req.confidence??req.confidence_score??0)*100).toFixed(0)+"%"} bg="#f3f4f6" color="#64748b"/>
                  </div>
                  <div style={{ fontSize:13, color:"#374151", lineHeight:1.6 }}>{req.text}</div>
                  <div style={{ fontSize:11, color:"#94a3b8", marginTop:6 }}>📄 {req.source_document||req.source}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── CONFLICTS ── */}
        {tab==="conflicts"&&(
          <div>
            {totalIssues===0
              ?<div style={{ textAlign:"center" as const, padding:60, color:"#22c55e", fontSize:16 }}>✅ No issues detected</div>
              :<>
                {result.mismatches.duplicates?.length>0&&(
                  <div style={S.panel}><div style={S.panelTitle}>🔁 DUPLICATES ({result.mismatches.duplicates.length})</div>
                    {result.mismatches.duplicates.map((d:any,i:number)=>(
                      <div key={i} style={{ ...S.issueCard, borderColor:"#fca5a5", background:"#fff5f5" }}>
                        <div style={{ display:"flex", gap:8, marginBottom:8 }}><Badge label={d.req_1} bg="#fde8e8" color="#dc2626"/><Badge label={d.req_2} bg="#fde8e8" color="#dc2626"/><Badge label={(d.similarity*100).toFixed(0)+"% similar"} bg="#fee2e2" color="#b91c1c"/>{d.cross_document&&<Badge label="CROSS-DOC" bg="#fde8e8" color="#991b1b"/>}</div>
                        <div style={{ fontSize:13, color:"#374151", marginBottom:4 }}>"{d.text_1}"</div><div style={{ fontSize:13, color:"#374151" }}>"{d.text_2}"</div>
                      </div>
                    ))}
                  </div>
                )}
                {result.mismatches.conflicts?.length>0&&(
                  <div style={S.panel}><div style={S.panelTitle}>⚡ CONFLICTS ({result.mismatches.conflicts.length})</div>
                    {result.mismatches.conflicts.map((c:any,i:number)=>(
                      <div key={i} style={{ ...S.issueCard, borderColor:"#fcd34d", background:"#fffbeb" }}>
                        <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" as const }}><Badge label={c.req_1} bg="#fef3c7" color="#d97706"/><Badge label={c.req_2} bg="#fef3c7" color="#d97706"/><Badge label={c.type} bg="#fde68a" color="#92400e"/></div>
                        {(c.explanation||c.reason)&&<div style={{ fontSize:12, color:"#d97706", marginBottom:8, fontWeight:600 }}>{c.explanation||c.reason}</div>}
                        <div style={{ fontSize:13, color:"#374151", marginBottom:4 }}>"{c.text_1}"</div><div style={{ fontSize:13, color:"#374151" }}>"{c.text_2}"</div>
                      </div>
                    ))}
                  </div>
                )}
                {result.mismatches.ambiguities?.length>0&&(
                  <div style={S.panel}><div style={S.panelTitle}>❓ AMBIGUITIES ({result.mismatches.ambiguities.length})</div>
                    {result.mismatches.ambiguities.map((a:any,i:number)=>(
                      <div key={i} style={{ ...S.issueCard, borderColor:"#c4b5fd", background:"#faf5ff" }}>
                        <div style={{ display:"flex", gap:8, marginBottom:8 }}><Badge label={a.req_id} bg="#ede9fe" color="#7c3aed"/><Badge label="VAGUE LANGUAGE" bg="#f3e8ff" color="#9333ea"/></div>
                        <div style={{ fontSize:13, color:"#374151", marginBottom:6 }}>"{a.text}"</div>
                        {(a.suggestion||a.reason)&&<div style={{ fontSize:12, color:"#7c3aed" }}>{a.suggestion||a.reason}</div>}
                        {a.vague_words?.length>0&&<div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>Vague words: {a.vague_words.join(", ")}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            }
          </div>
        )}

        {/* ── TASKS ── */}
        {tab==="tasks"&&(
          <div>
            <div style={S.filterRow}>
              {["ALL","TODO","IN PROGRESS","DONE","high","medium","low"].map(f=>(
                <button key={f} onClick={()=>setTaskFilter(f)} style={{ ...S.fBtn, background:taskFilter===f?"#0f172a":"#fff", color:taskFilter===f?"#fff":"#64748b", borderColor:taskFilter===f?"#0f172a":"#e2e8f0", fontSize:11 }}>{f}</button>
              ))}
            </div>
            <div style={S.kanban}>
              {(["TODO","IN PROGRESS","DONE"] as const).map(st=>{
                const col=filtTasks.filter(t=>t.status===st);
                const stColor=st==="DONE"?"#22c55e":st==="IN PROGRESS"?"#f59e0b":"#94a3b8";
                return (
                  <div key={st} style={S.kanbanCol}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:stColor }}/><span style={{ fontWeight:700, fontSize:13, color:"#1e293b" }}>{st}</span>
                      <span style={{ marginLeft:"auto", background:stColor+"20", color:stColor, borderRadius:999, padding:"1px 8px", fontSize:11, fontWeight:700 }}>{col.length}</span>
                    </div>
                    {col.map(task=>{
                      const ta=task as any;
                      return (
                        <div key={task.task_id} style={S.taskCard}>
                          <div style={{ display:"flex", gap:5, flexWrap:"wrap" as const, marginBottom:6, alignItems:"center" }}>
                            <span style={{ fontSize:10, color:"#94a3b8" }}>{task.task_id}</span>
                            <Badge label={task.priority} bg={(PC[task.priority]||"#888")+"20"} color={PC[task.priority]||"#888"}/>
                            <Badge label={(task.story_points||0)+"SP"} bg="#e0f2fe" color="#0284c7"/>
                            {ta.risk_level&&<Badge label={ta.risk_level+" Risk"} bg={(RC[ta.risk_level]||"#888")+"20"} color={RC[ta.risk_level]||"#888"}/>}
                            {!task.assigned_to&&<Badge label="UNASSIGNED" bg="#fff7ed" color="#d97706"/>}
                          </div>
                          <div style={{ fontSize:13, fontWeight:600, color:"#1e293b", lineHeight:1.4, marginBottom:6 }}>{task.title}</div>
                          <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>
                            {ta.assigned_name?`👤 ${ta.assigned_name}`:task.assigned_to?`👤 ${task.assigned_to}`:"⚠️ Unassigned"} · {task.type}
                          </div>
                          {ta.allocation_confidence&&ta.allocation_confidence!=="No Candidate"&&(
                            <div style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
                              <span style={{ fontSize:10, color:"#94a3b8" }}>Confidence:</span>
                              <Badge label={ta.allocation_confidence} bg={(CONF_COLOR[ta.allocation_confidence]||"#888")+"20"} color={CONF_COLOR[ta.allocation_confidence]||"#888"}/>
                              {ta.assignment_score!=null&&<span style={{ fontSize:10, color:"#94a3b8" }}>score: {ta.assignment_score.toFixed(2)}</span>}
                            </div>
                          )}
                          {ta.risk_reason&&<div style={{ fontSize:11, color:RC[ta.risk_level]||"#64748b", background:(RC[ta.risk_level]||"#888")+"10", borderRadius:6, padding:"4px 8px", marginBottom:6, lineHeight:1.4 }}>{ta.risk_reason}</div>}
                          <div style={{ display:"flex", gap:4, flexWrap:"wrap" as const, marginBottom:8 }}>
                            {task.required_skills.map(sk=><span key={sk} style={{ background:"#eef2ff", color:"#4338ca", borderRadius:6, padding:"1px 7px", fontSize:10, fontWeight:600 }}>{sk}</span>)}
                          </div>
                          <div style={{ display:"flex", gap:5 }}>
                            <button onClick={()=>setExplainTask(task)} style={{ flex:1, padding:"5px", background:"#eef2ff", color:"#4338ca", border:"none", borderRadius:6, fontSize:10, cursor:"pointer", fontWeight:600 }}>🔍 Explain</button>
                            {(["TODO","IN PROGRESS","DONE"] as const).filter(s=>s!==task.status).map(s=>(
                              <button key={s} onClick={()=>moveTask(task.task_id,s)} style={{ flex:1, padding:"5px", background:s==="DONE"?"#dcfce7":s==="IN PROGRESS"?"#fef3c7":"#f3f4f6", color:s==="DONE"?"#15803d":s==="IN PROGRESS"?"#92400e":"#374151", border:"none", borderRadius:6, fontSize:10, cursor:"pointer", fontWeight:600 }}>→ {s}</button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TRACEABILITY ── */}
        {tab==="traceability"&&(
          <div>
            <div style={{ display:"flex", gap:16, marginBottom:20, flexWrap:"wrap" as const }}>
              <div style={S.miniCard}><div style={S.miniLabel}>COVERAGE RATE</div><div style={{ fontSize:32, fontWeight:900, color:"#22c55e" }}>{coverageRate}%</div><div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>of requirements have tasks</div></div>
              {tsi!==null&&<div style={S.miniCard}><div style={S.miniLabel}>TEAM STABILITY INDEX</div><div style={{ fontSize:32, fontWeight:900, color:tsi>=0.75?"#22c55e":tsi>=0.5?"#f59e0b":"#ef4444" }}>{(tsi*100).toFixed(0)}%</div><div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{tsiStatus}</div></div>}
              {Object.keys(riskSummary).length>0&&<div style={{ ...S.miniCard, flex:1 }}><div style={S.miniLabel}>RISK SUMMARY</div><div style={{ display:"flex", gap:14 }}>{Object.entries(riskSummary).map(([level,count])=><div key={level} style={{ textAlign:"center" as const }}><div style={{ fontSize:22, fontWeight:900, color:RC[level]||"#888" }}>{count as number}</div><div style={{ fontSize:11, color:"#64748b" }}>{level}</div></div>)}</div></div>}
              {Object.keys(teamWorkload).length>0&&<div style={{ ...S.miniCard, flex:2 }}><div style={S.miniLabel}>TEAM WORKLOAD</div>{Object.entries(teamWorkload).map(([empId,pts])=>{ const empName=tasks.find(t=>t.assigned_to===empId)?.assigned_name||empId; const pct=Math.min(100,Math.round(((pts as number)/20)*100)); return (<div key={empId} style={{ marginBottom:8 }}><div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}><span style={{ fontWeight:600 }}>{empName}</span><span style={{ color:"#94a3b8" }}>{pts as number} pts</span></div><div style={S.barBg}><div style={{ ...S.barFill, width:`${pct}%`, background:pct>80?"#ef4444":pct>60?"#f59e0b":"#6366f1" }}/></div></div>); })}</div>}
            </div>
            <div style={S.panel}>
              <div style={S.panelTitle}>REQUIREMENT → TASK TRACEABILITY MATRIX</div>
              <div style={{ overflowX:"auto" as const }}>
                <table style={{ width:"100%", borderCollapse:"collapse" as const, fontSize:12 }}>
                  <thead><tr style={{ background:"#f8fafc" }}>{["Req ID","Requirement","Type","Priority","Story Pts","Tasks","Status"].map(h=><th key={h} style={{ padding:"10px 14px", textAlign:"left" as const, fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase" as const, borderBottom:"1.5px solid #e2e8f0" }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {traceRows.map((row,i)=>(
                      <tr key={row.req_id+i} style={{ background:i%2===0?"#fff":"#fafafa", borderBottom:"1px solid #f3f4f6" }}>
                        <td style={{ padding:"10px 14px" }}><span style={S.reqId}>{row.req_id}</span></td>
                        <td style={{ padding:"10px 14px", maxWidth:240, color:"#374151" }}>{row.req_text}</td>
                        <td style={{ padding:"10px 14px" }}><Badge label={row.type} bg={(TC[row.type]||"#6366f1")+"20"} color={TC[row.type]||"#6366f1"}/></td>
                        <td style={{ padding:"10px 14px" }}><Badge label={row.priority} bg={(PC[row.priority]||"#888")+"20"} color={PC[row.priority]||"#888"}/></td>
                        <td style={{ padding:"10px 14px", textAlign:"center" as const, fontWeight:700, color:"#0284c7" }}>{row.story_points}</td>
                        <td style={{ padding:"10px 14px" }}>{row.task_ids.length>0?row.task_ids.map(tid=><span key={tid} style={{ background:"#fef3c7", color:"#92400e", borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:600, marginRight:4 }}>{tid}</span>):<span style={{ color:"#94a3b8", fontSize:11 }}>None</span>}</td>
                        <td style={{ padding:"10px 14px" }}><span style={{ background:row.status==="COVERED"?"#dcfce7":"#fee2e2", color:row.status==="COVERED"?"#15803d":"#dc2626", borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{row.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── PHASE 5: RISKS TAB ── */}
        {tab==="risks"&&(
          <div>
            {riskLoading&&<div style={{ padding:40, textAlign:"center" as const, color:"#94a3b8", fontSize:14 }}>Loading risk report & dependency analysis...</div>}
            {riskError&&<div style={{ padding:20, background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, color:"#dc2626", marginBottom:16 }}>{riskError}</div>}

            {/* PHASE 5: Full risk report */}
            {riskReport && (
              <>
                {/* Overall risk banner */}
                <div style={{ background:riskReport.overall_color+"15", border:`2px solid ${riskReport.overall_color}40`, borderRadius:14, padding:"20px 28px", marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", letterSpacing:2, marginBottom:6 }}>OVERALL PROJECT RISK</div>
                    <div style={{ fontSize:28, fontWeight:900, color:riskReport.overall_color }}>{riskReport.overall_risk}</div>
                    <div style={{ fontSize:13, color:"#64748b", marginTop:4 }}>Based on 5-dimensional risk analysis across all {result.tasks?.length||0} tasks</div>
                  </div>
                  <div style={{ textAlign:"right" as const }}>
                    <div style={{ fontSize:48, fontWeight:900, color:riskReport.overall_color }}>{((riskReport.overall_score||0)*100).toFixed(0)}%</div>
                    <div style={{ fontSize:12, color:"#94a3b8" }}>risk score</div>
                  </div>
                </div>

                {/* 5 risk type cards */}
                <div style={{ marginBottom:24 }}>
                  <div style={S.panelTitle}>FIVE-DIMENSIONAL RISK ANALYSIS</div>
                  <RiskTypeCard title="Overload Risk"              data={riskReport.overload_risk}             icon="🔥"/>
                  <RiskTypeCard title="Deadline Risk"             data={riskReport.deadline_risk}             icon="⏰"/>
                  <RiskTypeCard title="Stability Risk"            data={riskReport.stability_risk}            icon="⚖️"/>
                  <RiskTypeCard title="Skill Concentration Risk"  data={riskReport.skill_concentration_risk}  icon="🎯"/>
                  <RiskTypeCard title="Allocation Fragility"      data={riskReport.allocation_fragility}      icon="🔮"/>
                </div>
              </>
            )}

            {/* PHASE 5: Dependency chains */}
            {dependencies.length > 0 && (
              <div style={S.panel}>
                <div style={S.panelTitle}>TASK DEPENDENCY CHAINS ({dependencies.length} detected)</div>
                <div style={{ fontSize:13, color:"#64748b", marginBottom:16, lineHeight:1.6 }}>
                  These dependencies were automatically detected from requirement text analysis.
                  A cascade delay occurs when an upstream (prerequisite) task is at risk.
                </div>

                {/* Summary counts */}
                <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" as const }}>
                  {(["Critical","High","Medium","Low"] as const).map(level=>{
                    const count=dependencies.filter(d=>d.cascade_risk===level).length;
                    if(count===0) return null;
                    const color=CASCADE_COLOR[level];
                    return (
                      <div key={level} style={{ background:color+"15", border:`2px solid ${color}40`, borderRadius:10, padding:"12px 20px", textAlign:"center" as const }}>
                        <div style={{ fontSize:24, fontWeight:900, color }}>{count}</div>
                        <div style={{ fontSize:11, fontWeight:700, color, marginTop:3 }}>{level}</div>
                        <div style={{ fontSize:10, color:"#94a3b8" }}>cascade risk</div>
                      </div>
                    );
                  })}
                </div>

                {/* Critical and High cascades first */}
                {["Critical","High","Medium","Low"].map(level=>{
                  const filtered=dependencies.filter(d=>d.cascade_risk===level);
                  if(filtered.length===0) return null;
                  return (
                    <div key={level} style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:CASCADE_COLOR[level], letterSpacing:2, marginBottom:10 }}>
                        {level.toUpperCase()} CASCADE RISK ({filtered.length})
                      </div>
                      {filtered.map((dep:any,i:number)=><DependencyChain key={i} dep={dep}/>)}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Unassigned tasks */}
            {unassignedTasks.length>0&&(
              <div style={{ ...S.panel, borderLeft:"4px solid #f59e0b" }}>
                <div style={S.panelTitle}>⚠️ UNASSIGNED TASKS ({unassignedTasks.length})</div>
                {unassignedTasks.map(task=>{
                  const ta=task as any;
                  const corrective:any[]=ta.corrective_actions||[];
                  return (
                    <div key={task.task_id} style={{ background:"#fffbeb", border:"1.5px solid #fcd34d", borderRadius:12, padding:18, marginBottom:14 }}>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" as const, marginBottom:10, alignItems:"center" }}>
                        <span style={S.reqId}>{task.task_id}</span>
                        <Badge label={task.priority} bg={(PC[task.priority]||"#888")+"20"} color={PC[task.priority]||"#888"}/>
                        <Badge label={(task.story_points||0)+"SP"} bg="#e0f2fe" color="#0284c7"/>
                        <Badge label={ta.reason_code||"UNASSIGNED"} bg="#fef3c7" color="#92400e"/>
                      </div>
                      <div style={{ fontSize:13, fontWeight:600, color:"#1e293b", marginBottom:8 }}>{task.title}</div>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap" as const, marginBottom:12 }}>
                        <span style={{ fontSize:12, color:"#64748b" }}>Required skills:</span>
                        {task.required_skills.map(sk=><span key={sk} style={{ background:"#eef2ff", color:"#4338ca", borderRadius:6, padding:"1px 7px", fontSize:11, fontWeight:600 }}>{sk}</span>)}
                      </div>
                      {corrective.length>0&&(
                        <><div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", letterSpacing:2, marginBottom:8 }}>SUGGESTED ACTIONS</div>{corrective.map((a:any,i:number)=><CorrectiveCard key={i} action={a}/>)}</>
                      )}
                      <button onClick={()=>setExplainTask(task)} style={{ marginTop:4, padding:"6px 14px", background:"#eef2ff", color:"#4338ca", border:"none", borderRadius:6, fontSize:11, cursor:"pointer", fontWeight:600 }}>🔍 View full evaluation</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bus factor */}
            {busFactorRisks.length>0&&(
              <div style={{ ...S.panel, borderLeft:"4px solid #ef4444" }}>
                <div style={S.panelTitle}>🚌 BUS FACTOR RISKS ({busFactorRisks.length})</div>
                {busFactorRisks.map((risk:any,i:number)=>(
                  <div key={i} style={{ background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:12, padding:18, marginBottom:12 }}>
                    <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:10 }}>
                      <Badge label={risk.skill} bg="#fee2e2" color="#dc2626"/>
                      <Badge label="BUS FACTOR" bg="#fee2e2" color="#991b1b"/>
                      <span style={{ fontSize:13, fontWeight:700, color:"#1e293b" }}>Only: {risk.only_dev}</span>
                    </div>
                    <div style={{ fontSize:13, color:"#64748b", lineHeight:1.6 }}>{risk.suggestion}</div>
                  </div>
                ))}
              </div>
            )}

            {!riskLoading&&!riskReport&&unassignedTasks.length===0&&busFactorRisks.length===0&&(
              <div style={{ textAlign:"center" as const, padding:60, color:"#22c55e", fontSize:16 }}>✅ No critical risks detected</div>
            )}
          </div>
        )}

        {/* ── METRICS ── */}
        {tab==="metrics"&&<MetricsTab/>}

      </div>
    </div>
  );
}

const S: Record<string,React.CSSProperties> = {
  page:        { minHeight:"100vh", background:"#f8f9fb", fontFamily:"'DM Sans','Segoe UI',sans-serif" },
  header:      { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 32px", background:"#fff", borderBottom:"1.5px solid #f0f0f0", boxShadow:"0 1px 6px rgba(0,0,0,0.04)" },
  back:        { background:"transparent", border:"1px solid #e2e8f0", color:"#64748b", padding:"7px 14px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 },
  headerTitle: { fontSize:12, letterSpacing:3, color:"#94a3b8", fontWeight:700 },
  headerBadge: { background:"#eef2ff", color:"#6366f1", fontSize:12, fontWeight:700, padding:"5px 14px", borderRadius:999 },
  statGrid:    { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, padding:"24px 32px" },
  statCard:    { background:"#fff", border:"1.5px solid #f0f0f0", borderTop:"3px solid", borderRadius:12, padding:"18px 16px", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" },
  tabBar:      { display:"flex", padding:"0 32px", borderBottom:"1.5px solid #f0f0f0", background:"#fff", gap:4, overflowX:"auto" as const },
  tab:         { background:"transparent", border:"none", padding:"13px 18px", color:"#94a3b8", cursor:"pointer", fontSize:13, fontWeight:600, borderBottom:"2px solid transparent", position:"relative" as const, whiteSpace:"nowrap" as const },
  tabOn:       { color:"#6366f1", borderBottom:"2px solid #6366f1" },
  tabBadge:    { position:"absolute" as const, top:6, right:4, background:"#ef4444", color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:9, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 },
  body:        { padding:"24px 32px" },
  panel:       { background:"#fff", border:"1.5px solid #f0f0f0", borderRadius:12, padding:20, marginBottom:16, boxShadow:"0 2px 8px rgba(0,0,0,0.03)" },
  panelTitle:  { fontSize:11, letterSpacing:2, color:"#94a3b8", fontWeight:700, marginBottom:16, textTransform:"uppercase" as const },
  barBg:       { background:"#f3f4f6", borderRadius:999, height:8, overflow:"hidden" },
  barFill:     { height:"100%", borderRadius:999, transition:"width 0.5s ease" },
  filterRow:   { display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" as const, alignItems:"center" },
  fBtn:        { padding:"5px 12px", border:"1.5px solid", borderRadius:20, cursor:"pointer", fontSize:11, fontWeight:700, transition:"all 0.15s", letterSpacing:0.5 },
  reqCard:     { background:"#fff", border:"1.5px solid #f0f0f0", borderRadius:10, padding:"14px 18px", marginBottom:10, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" },
  reqId:       { background:"#eef2ff", color:"#4338ca", borderRadius:6, padding:"2px 9px", fontSize:12, fontWeight:700 },
  issueCard:   { border:"1px solid", borderRadius:10, padding:14, marginBottom:10 },
  kanban:      { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 },
  kanbanCol:   { background:"#fff", border:"1.5px solid #f0f0f0", borderRadius:12, padding:16, minHeight:200, boxShadow:"0 2px 8px rgba(0,0,0,0.03)" },
  taskCard:    { background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:10, padding:12, marginBottom:10 },
  miniCard:    { background:"#fff", border:"1.5px solid #f0f0f0", borderRadius:12, padding:"16px 20px", flex:1, minWidth:160 },
  miniLabel:   { fontSize:10, letterSpacing:2, color:"#94a3b8", fontWeight:700, marginBottom:8 },
};
