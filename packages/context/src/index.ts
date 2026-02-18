/**
 * @open-people/context
 *
 * Export project planning state as .opkg context packages.
 * Reads VISION.md, DEBATES.md, TODO.md, CLAUDE.md, and decisions/*.md
 * from a project directory and produces valid context content JSON.
 *
 * See docs/spec/04-project-context.md for the spec.
 */

export { exportContext } from './exporter';
export {
  parseVision,
  parseDebates,
  parseTodo,
  parseConventions,
  parseDecision,
} from './parser';

// ---- Types ----

export interface VisionStatus {
  goal: string;
  status: 'done' | 'in_progress' | 'not_started' | 'out_of_scope';
  delivered_by?: string;
}

export interface Vision {
  summary: string;
  audience?: string;
  done_criteria: string[];
  out_of_scope?: string[];
  status: VisionStatus[];
}

export interface DebateOption {
  label: string;
  for: string[];
  against: string[];
}

export interface Debate {
  id: string;
  question: string;
  status: 'open' | 'leaning' | 'resolved';
  options: DebateOption[];
  verdict: string | null;
  resolved_decision_id: string | null;
  created_at: string;
}

export interface Decision {
  id: string;
  title: string;
  context: string;
  decision: string;
  reasoning: string;
  resolved_debate_id: string | null;
  decided_at: string;
}

export interface KeyPath {
  path: string;
  description: string;
}

export interface Conventions {
  stack?: Record<string, string>;
  key_paths?: KeyPath[];
  rules?: string[];
  ownership?: {
    owner: string;
    org?: string;
  };
}

export interface MilestoneTask {
  description: string;
  done: boolean;
}

export interface Milestone {
  id: string;
  name: string;
  tasks: MilestoneTask[];
}

export interface Relationship {
  project_id: string;
  relationship: 'implements' | 'depends_on' | 'extends' | 'forks' | 'related';
  description?: string;
}

export interface ContextContent {
  owner_did: string;
  project_id: string;
  project_name: string;
  exported_at: string;
  vision: Vision;
  debates?: Debate[];
  decisions?: Decision[];
  conventions?: Conventions;
  milestones?: Milestone[];
  relationships?: Relationship[];
  extensions?: Record<string, unknown>;
}

export interface ExportOptions {
  projectDir: string;
  ownerDid: string;
  projectId: string;
  projectName: string;
  relationships?: Relationship[];
  extensions?: Record<string, unknown>;
}
