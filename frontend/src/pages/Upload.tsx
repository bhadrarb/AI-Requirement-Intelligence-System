import { useState, useRef } from "react";
import type { PipelineResult } from "../App";

const API = "http://localhost:8000";

const SKILL_OPTIONS = ["backend", "frontend", "database", "devops", "testing", "security", "mobile", "ml"];

const DEFAULT_EMPLOYEES = [
  { emp_id: "E1", name: "Arjun Sharma",  skills: ["backend", "database"], experience: 4, current_project: "P1", active_task_count: 0 },
  { emp_id: "E2", name: "Priya Nair",    skills: ["frontend", "backend"], experience: 3, current_project: "P1", active_task_count: 0 },
  { emp_id: "E3", name: "Rahul Dev",     skills: ["frontend"],            experience: 2, current_project: "P1", active_task_count: 0 },
  { emp_id: "E4", name: "Sneha Pillai",  skills: ["backend", "devops"],   experience: 5, current_project: "P1", active_task_count: 0 },
  { emp_id: "E5", name: "Kiran Menon",   skills: ["testing", "backend"],  experience: 2, current_project: "P1", active_task_count: 0 },
];

type Employee = {
  emp_id: string;
  name: string;
  skills: string[];
  experience: number;
  current_project: string;
  active_task_count: number;
};

export default function UploadPage({ onResult }: { onResult: (r: PipelineResult) => void }) {
  const [files, setFiles]         = useState<File[]>([]);
  const [employees, setEmployees] = useState<Employee[]>(DEFAULT_EMPLOYEES);
  const [loading, setLoading]     = useState(false);
  const [step, setStep]           = useState("");
  const [error, setError]         = useState("");
  const [dragOver, setDragOver]   = useState(false);

  // New employee form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName]         = useState("");
  const [newExp, setNewExp]           = useState(1);
  const [newSkills, setNewSkills]     = useState<string[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);

  // ── File handling ──────────────────────────────────────────────────────────
  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const allowed = Array.from(incoming).filter(f => f.name.endsWith(".txt") || f.name.endsWith(".pdf"));
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...allowed.filter(f => !existing.has(f.name))];
    });
  };

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  // ── Employee handling ──────────────────────────────────────────────────────
  const addEmployee = () => {
    if (!newName.trim()) return;
    if (newSkills.length === 0) { alert("Select at least one skill"); return; }
    const id = `E${employees.length + 1}`;
    setEmployees(prev => [...prev, {
      emp_id: id, name: newName.trim(), skills: newSkills,
      experience: newExp, current_project: "P1", active_task_count: 0
    }]);
    setNewName(""); setNewExp(1); setNewSkills([]); setShowAddForm(false);
  };

  const removeEmployee = (id: string) => setEmployees(prev => prev.filter(e => e.emp_id !== id));

  const toggleSkill = (skill: string) => {
    setNewSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]);
  };

  // ── Run pipeline ───────────────────────────────────────────────────────────
  const run = async () => {
    if (!files.length) { setError("Please upload at least one .txt or .pdf file."); return; }
    if (!employees.length) { setError("Please add at least one employee."); return; }
    setError(""); setLoading(true);
    try {
      await fetch(`${API}/reset`, { method: "DELETE" });

      setStep(`Uploading ${files.length} file(s)...`);
      const fd = new FormData();
      files.forEach(f => fd.append("files", f));
      const up = await fetch(`${API}/upload`, { method: "POST", body: fd });
      if (!up.ok) throw new Error("Upload failed. Check backend.");

      setStep(files.length > 1 ? "Running cross-document AI analysis..." : "Running AI pipeline...");
      const res = await fetch(`${API}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Pipeline failed"); }
      onResult(await res.json());
    } catch (e: any) {
      setError(e.message || "Something went wrong. Make sure backend is running.");
    } finally { setLoading(false); setStep(""); }
  };

  const fmtSize = (b: number) => b < 1024 * 1024 ? (b / 1024).toFixed(1) + " KB" : (b / 1024 / 1024).toFixed(1) + " MB";

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.badge}>AI · ML · NLP</div>
        <h1 style={S.title}>Requirement<br /><span style={S.accent}>Intelligence</span></h1>
        <p style={S.sub}>
          Upload SRS/PRD documents + add your team → AI extracts requirements,
          detects conflicts, predicts priority, estimates effort and assigns tasks intelligently.
        </p>
      </div>

      {/* Pipeline steps */}
      <div style={S.stepsRow}>
        {["1. Extract","2. Classify","3. Cross-Doc Conflicts","4. Prioritise","5. Estimate Effort","6. Assign Tasks"].map((s, i, a) => (
          <div key={s} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={S.stepChip}>{s}</div>
            {i < a.length - 1 && <span style={{ color:"#cbd5e1", fontSize:14 }}>→</span>}
          </div>
        ))}
      </div>

      <div style={{ width:"100%", maxWidth:680, display:"flex", flexDirection:"column" as const, gap:20 }}>

        {/* ── SECTION 1: Upload Documents ── */}
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <div style={S.sectionNumber}>1</div>
            <div>
              <div style={S.sectionTitle}>Upload Requirement Documents</div>
              <div style={S.sectionSub}>Supports .txt and .pdf · Upload multiple files for cross-document analysis</div>
            </div>
          </div>

          <div
            style={{ ...S.drop, borderColor: dragOver ? "#6366f1" : files.length ? "#86efac" : "#e2e8f0", background: dragOver ? "#eef2ff" : files.length ? "#f0fdf4" : "#fafafa" }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".txt,.pdf" multiple hidden onChange={e => addFiles(e.target.files)} />
            <div style={{ fontSize: 36, marginBottom: 8 }}>{dragOver ? "📂" : "⬆️"}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 4 }}>
              {dragOver ? "Drop files here" : "Click to upload or drag & drop"}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>.txt and .pdf supported</div>
          </div>

          {files.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {files.map(f => (
                <div key={f.name} style={S.fileRow}>
                  <span style={{ fontSize: 18 }}>{f.name.endsWith(".pdf") ? "📕" : "📄"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{fmtSize(f.size)}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeFile(f.name); }} style={S.removeBtn}>✕</button>
                </div>
              ))}
              {files.length > 1 && (
                <div style={S.crossDocNotice}>
                  🔀 <strong>Cross-document analysis enabled</strong> — AI will compare all {files.length} documents and flag conflicts between them
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SECTION 2: Team / Employees ── */}
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <div style={S.sectionNumber}>2</div>
            <div style={{ flex: 1 }}>
              <div style={S.sectionTitle}>Add Team Members</div>
              <div style={S.sectionSub}>Tasks will be intelligently assigned to these employees based on skills, workload and priority</div>
            </div>
            <button onClick={() => setShowAddForm(!showAddForm)} style={S.addBtn}>
              {showAddForm ? "✕ Cancel" : "+ Add Employee"}
            </button>
          </div>

          {/* Add employee form */}
          {showAddForm && (
            <div style={S.addForm}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>New Employee</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                <div>
                  <div style={S.label}>Full Name *</div>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. John Doe"
                    style={S.input}
                  />
                </div>
                <div>
                  <div style={S.label}>Years of Experience</div>
                  <input
                    type="number" min={0} max={20}
                    value={newExp}
                    onChange={e => setNewExp(Number(e.target.value))}
                    style={S.input}
                  />
                </div>
              </div>
              <div style={S.label}>Skills * (select all that apply)</div>
              <div style={{ display:"flex", flexWrap:"wrap" as const, gap:8, marginBottom:14 }}>
                {SKILL_OPTIONS.map(skill => (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    style={{
                      padding:"5px 14px", borderRadius:20, border:"1.5px solid",
                      borderColor: newSkills.includes(skill) ? "#6366f1" : "#e2e8f0",
                      background: newSkills.includes(skill) ? "#eef2ff" : "#fff",
                      color: newSkills.includes(skill) ? "#4338ca" : "#64748b",
                      fontSize:12, fontWeight:600, cursor:"pointer"
                    }}
                  >
                    {newSkills.includes(skill) ? "✓ " : ""}{skill}
                  </button>
                ))}
              </div>
              <button onClick={addEmployee} style={S.confirmBtn}>
                ✓ Add Employee
              </button>
            </div>
          )}

          {/* Employee list */}
          <div style={{ display:"flex", flexDirection:"column" as const, gap:8, marginTop: showAddForm ? 12 : 0 }}>
            {employees.map(emp => (
              <div key={emp.emp_id} style={S.empRow}>
                <div style={S.empAvatar}>{emp.name.charAt(0)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:"#1e293b" }}>{emp.name}</div>
                  <div style={{ fontSize:11, color:"#94a3b8" }}>{emp.emp_id} · {emp.experience} yr{emp.experience !== 1 ? "s" : ""} experience</div>
                  <div style={{ display:"flex", flexWrap:"wrap" as const, gap:4, marginTop:4 }}>
                    {emp.skills.map(s => (
                      <span key={s} style={{ background:"#eef2ff", color:"#4338ca", borderRadius:6, padding:"1px 8px", fontSize:11, fontWeight:600 }}>{s}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => removeEmployee(emp.emp_id)} style={S.removeBtn} title="Remove employee">✕</button>
              </div>
            ))}
            {employees.length === 0 && (
              <div style={{ textAlign:"center" as const, padding:20, color:"#94a3b8", fontSize:13 }}>
                No employees added yet. Click "+ Add Employee" above.
              </div>
            )}
          </div>
        </div>

        {/* ── RUN BUTTON ── */}
        {error && <div style={S.error}>{error}</div>}

        <button
          style={{ ...S.runBtn, opacity: loading || !files.length || !employees.length ? 0.6 : 1, cursor: loading || !files.length || !employees.length ? "not-allowed" : "pointer" }}
          onClick={run}
          disabled={loading || !files.length || !employees.length}
        >
          {loading
            ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                <span style={S.spinner} />{step}
              </span>
            : files.length > 1
              ? `▶  Analyse ${files.length} Documents with ${employees.length} Employees`
              : `▶  Run Intelligence Pipeline (${employees.length} employees)`}
        </button>

        <div style={S.hint}>
          Backend must be running: <code style={{ background:"#f1f5f9", padding:"2px 8px", borderRadius:4 }}>uvicorn main:app --reload</code>
        </div>

        {/* ML Models info */}
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" as const, justifyContent:"center" }}>
          {[
            { name:"SVM Classifier",  desc:"Functional vs Non-functional", color:"#6366f1" },
            { name:"Random Forest",   desc:"Priority: High / Medium / Low", color:"#f59e0b" },
            { name:"RF Regressor",    desc:"Effort in Story Points (1–13)", color:"#10b981" },
          ].map(m => (
            <div key={m.name} style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderTop:`3px solid ${m.color}`, borderRadius:10, padding:"14px 20px", width:180, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ fontWeight:700, fontSize:13, color:"#1e293b", marginBottom:4 }}>{m.name}</div>
              <div style={{ fontSize:12, color:"#64748b" }}>{m.desc}</div>
            </div>
          ))}
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:         { minHeight:"100vh", background:"#f8f9fb", display:"flex", flexDirection:"column", alignItems:"center", padding:"50px 20px 40px", fontFamily:"'DM Sans','Segoe UI',sans-serif" },
  header:       { textAlign:"center", marginBottom:36 },
  badge:        { display:"inline-block", background:"#eef2ff", color:"#6366f1", fontSize:11, fontWeight:700, letterSpacing:3, padding:"4px 14px", borderRadius:999, marginBottom:14 },
  title:        { fontSize:"clamp(32px,5vw,52px)", fontWeight:900, color:"#0f172a", lineHeight:1.1, margin:0 },
  accent:       { color:"#6366f1" },
  sub:          { color:"#64748b", fontSize:13, marginTop:12, lineHeight:1.8, maxWidth:540, textAlign:"center" as const },
  stepsRow:     { display:"flex", flexWrap:"wrap" as const, gap:8, marginBottom:28, justifyContent:"center" },
  stepChip:     { background:"#fff", border:"1px solid #e2e8f0", borderRadius:20, padding:"4px 14px", fontSize:11, color:"#475569", fontWeight:600 },
  card:         { width:"100%", background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:16, padding:24, boxShadow:"0 4px 20px rgba(0,0,0,0.05)" },
  sectionHeader:{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:18 },
  sectionNumber:{ width:32, height:32, borderRadius:10, background:"#6366f1", color:"#fff", fontWeight:900, fontSize:15, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  sectionTitle: { fontWeight:800, fontSize:15, color:"#0f172a" },
  sectionSub:   { fontSize:12, color:"#64748b", marginTop:2 },
  drop:         { border:"2px dashed", borderRadius:12, padding:"32px 20px", textAlign:"center" as const, cursor:"pointer", transition:"all 0.2s" },
  fileRow:      { display:"flex", alignItems:"center", gap:10, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px 12px", marginBottom:6 },
  removeBtn:    { background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:6, width:24, height:24, fontSize:11, cursor:"pointer", fontWeight:700, flexShrink:0 },
  crossDocNotice:{ background:"#eef2ff", border:"1px solid #c7d2fe", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#4338ca", lineHeight:1.6, marginTop:8 },
  addBtn:       { background:"#0f172a", color:"#fff", border:"none", borderRadius:8, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0 },
  addForm:      { background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:12, padding:16, marginBottom:4 },
  label:        { fontSize:12, fontWeight:600, color:"#374151", marginBottom:6 },
  input:        { width:"100%", padding:"9px 12px", border:"1.5px solid #e2e8f0", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" as const },
  confirmBtn:   { width:"100%", padding:"10px", background:"#6366f1", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" },
  empRow:       { display:"flex", alignItems:"center", gap:12, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"12px 14px" },
  empAvatar:    { width:38, height:38, borderRadius:10, background:"#6366f1", color:"#fff", fontSize:16, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  error:        { background:"#fef2f2", border:"1px solid #fca5a5", color:"#dc2626", padding:"10px 14px", borderRadius:8, fontSize:13 },
  runBtn:       { width:"100%", padding:"14px", background:"#0f172a", color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:700, letterSpacing:0.5, transition:"opacity 0.2s" },
  spinner:      { display:"inline-block", width:16, height:16, border:"2px solid #ffffff40", borderTop:"2px solid #fff", borderRadius:"50%", animation:"spin 0.8s linear infinite" },
  hint:         { fontSize:11, color:"#94a3b8", textAlign:"center" as const },
};
