import { useState } from "react";
import UploadPage from "./pages/Upload";
import ResultsPage from "./pages/Results";

export type Requirement = {
  req_id: string;
  text: string;
  source_document: string;
  confidence_score: number;
  type: string;
  type_confidence: number;
  priority: string;
  priority_confidence: number;
  story_points: number;
  effort_label: string;
  estimated_days: number;
};

export type Task = {
  task_id: string;
  title: string;
  type: string;
  description: string;
  requirement_id: string;
  priority: string;
  story_points: number;
  effort_label: string;
  status: string;
  assigned_to: string | null;
  assigned_name: string | null;
  required_skills: string[];
  assignment_score: number | null;
  skill_match: number;
  workload_ratio: number;
  deadline_urgency: number;
  matched_skills: string[];
  missing_skills: string[];
  formula: string;
  constraint_passed: boolean;
  all_evaluations: any[];
  allocation_confidence: string;
  margin: number;
  runner_up: string | null;
  tsi_before: number;
  tsi_after: number;
  tsi_impact: number;
  tsi_status: string;
  impact_meaning: string;
  risk_score: number;
  risk_level: string;
  risk_color: string;
  risk_reason: string;
  risk_components: Record<string, number>;
};

export type MismatchReport = {
  duplicates: any[];
  conflicts: any[];
  ambiguities: any[];
  clusters?: any[];
  summary: any;
};

export type PipelineResult = {
  status: string;
  summary: {
    total_requirements: number;
    validated: number;
    flagged: number;
    functional: number;
    non_functional: number;
    high_priority: number;
    total_tasks: number;
    assigned_tasks: number;
    total_story_points: number;
    estimated_total_days: number;
  };
  requirements: Requirement[];
  mismatches: MismatchReport;
  tasks: Task[];
  traceability: any;
};

export default function App() {
  const [result, setResult] = useState<PipelineResult | null>(null);
  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", minHeight: "100vh", background: "#f8f9fb" }}>
      {!result
        ? <UploadPage onResult={r => setResult(r)} />
        : <ResultsPage result={result} onBack={() => setResult(null)} />}
    </div>
  );
}
