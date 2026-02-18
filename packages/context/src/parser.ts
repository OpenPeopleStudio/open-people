/**
 * Markdown parsers for project documentation files.
 * Each parser reads a specific markdown format and returns structured data.
 */

import type {
  Vision,
  VisionStatus,
  Debate,
  DebateOption,
  Decision,
  Conventions,
  KeyPath,
  Milestone,
  MilestoneTask,
} from './index';

/**
 * Parse VISION.md into a Vision object.
 *
 * Expected format:
 * - "## What are we building?" → vision.summary
 * - "## Who is it for?" → vision.audience
 * - "## What does done look like?" → vision.done_criteria (bullet list)
 * - "## What are we NOT building?" → vision.out_of_scope (bullet list)
 * - "## Vision Status" → vision.status (markdown table)
 */
export function parseVision(markdown: string): Vision {
  const summary = extractSectionText(markdown, 'What are we building?');
  const audience = extractSectionText(markdown, 'Who is it for?');
  const doneCriteria = extractBulletList(markdown, 'What does done look like?');
  const outOfScope = extractBulletList(markdown, 'What are we NOT building?');
  const status = parseVisionStatusTable(markdown);

  return {
    summary: summary || '',
    ...(audience ? { audience } : {}),
    done_criteria: doneCriteria.length > 0 ? doneCriteria : ['(none specified)'],
    ...(outOfScope.length > 0 ? { out_of_scope: outOfScope } : {}),
    status: status.length > 0 ? status : [{ goal: '(none specified)', status: 'not_started' }],
  };
}

/**
 * Parse DEBATES.md into an array of Debate objects.
 *
 * Expected format: H2 headings are debate questions, followed by
 * **Status: ...**, then **For [Option]:** / **Against [Option]:** sections,
 * and optionally **Verdict:** at the end.
 */
export function parseDebates(markdown: string): Debate[] {
  const debates: Debate[] = [];
  const sections = splitByH2(markdown);

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const question = section.heading;
    if (!question) continue;

    const body = section.body;
    const statusMatch = body.match(/\*\*Status:\s*(OPEN|LEANING[^*]*|RESOLVED[^*]*)\*\*/i);
    if (!statusMatch) continue;

    const rawStatus = statusMatch[1].trim();
    let status: Debate['status'] = 'open';
    let resolvedDecisionId: string | null = null;

    if (rawStatus.toUpperCase().startsWith('RESOLVED')) {
      status = 'resolved';
      const decisionRef = rawStatus.match(/see\s+(decisions\/\S+)/i);
      if (decisionRef) {
        resolvedDecisionId = decisionRef[1].replace(/[()]/g, '').replace(/\.md$/, '');
      }
    } else if (rawStatus.toUpperCase().startsWith('LEANING')) {
      status = 'leaning';
    }

    const options = parseDebateOptions(body);
    const verdictMatch = body.match(/\*\*Verdict:\*\*\s*(.+?)(?=\n---|\n##|$)/s);
    const verdict = verdictMatch ? verdictMatch[1].trim() : null;

    const id = 'debate-' + question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 60);

    debates.push({
      id,
      question,
      status,
      options,
      verdict,
      resolved_decision_id: resolvedDecisionId,
      created_at: new Date().toISOString(),
    });
  }

  return debates;
}

/**
 * Parse TODO.md into an array of Milestone objects.
 *
 * Expected format: H2 headings starting with "M" followed by milestone name,
 * then checkbox lists (- [ ] or - [x]).
 */
export function parseTodo(markdown: string): Milestone[] {
  const milestones: Milestone[] = [];
  const sections = splitByH2(markdown);

  for (const section of sections) {
    const heading = section.heading;
    if (!heading) continue;

    // Match "M1: Name" or "M2: Name" pattern
    const milestoneMatch = heading.match(/^(M\d+)[:\s]+(.+)$/);
    if (!milestoneMatch) continue;

    const tasks = parseCheckboxList(section.body);
    milestones.push({
      id: milestoneMatch[1],
      name: milestoneMatch[2].trim(),
      tasks,
    });
  }

  return milestones;
}

/**
 * Parse CLAUDE.md into a Conventions object.
 *
 * Extracts stack info, key paths, rules, and ownership from the project CLAUDE.md.
 */
export function parseConventions(markdown: string): Conventions {
  const conventions: Conventions = {};

  // Parse stack from "## Stack" section
  const stackSection = extractSectionBody(markdown, 'Stack');
  if (stackSection) {
    const stack: Record<string, string> = {};
    const lines = stackSection.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*-\s*\*\*(.+?)\*\*:\s*(.+)/);
      if (match) {
        stack[match[1].toLowerCase()] = match[2].trim();
      }
    }
    if (Object.keys(stack).length > 0) {
      conventions.stack = stack;
    }
  }

  // Parse key paths from "## Key Paths" section
  const keyPathsSection = extractSectionBody(markdown, 'Key Paths');
  if (keyPathsSection) {
    const keyPaths: KeyPath[] = [];
    const lines = keyPathsSection.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*-\s*`(.+?)`\s*[—\-]+\s*(.+)/);
      if (match) {
        keyPaths.push({ path: match[1], description: match[2].trim() });
      }
    }
    if (keyPaths.length > 0) {
      conventions.key_paths = keyPaths;
    }
  }

  // Parse conventions/rules from "## Conventions" section
  const conventionsSection = extractSectionBody(markdown, 'Conventions');
  if (conventionsSection) {
    const rules = extractBulletListFromBody(conventionsSection);
    if (rules.length > 0) {
      conventions.rules = rules;
    }
  }

  // Parse ownership from "## Ownership" section
  const ownershipSection = extractSectionBody(markdown, 'Ownership');
  if (ownershipSection) {
    const ownerMatch = ownershipSection.match(/\*\*Owner:\*\*\s*(.+)/);
    const orgMatch = ownershipSection.match(/\*\*Org:\*\*\s*(.+)/);
    if (ownerMatch) {
      conventions.ownership = {
        owner: ownerMatch[1].trim(),
        ...(orgMatch ? { org: orgMatch[1].trim() } : {}),
      };
    }
  }

  return conventions;
}

/**
 * Parse a single decisions/*.md file into a Decision object.
 *
 * Expected format:
 * - H1 title (with optional NNN- prefix)
 * - **Context:** or ## Context section
 * - **Decision:** or ## Decision section
 * - **Reasoning:** or ## Reasoning section
 */
export function parseDecision(markdown: string, filename: string): Decision {
  // Extract ID from filename (e.g., "001-json-envelope.md" -> "decision-001")
  const idMatch = filename.match(/^(\d+)/);
  const id = idMatch ? `decision-${idMatch[1]}` : `decision-${filename.replace(/\.md$/, '')}`;

  // Extract title from H1 or filename
  const titleMatch = markdown.match(/^#\s+(?:\d+-\s*)?(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : filename.replace(/\.md$/, '').replace(/^\d+-/, '');

  // Extract sections — try both bold-label and H2 formats
  const context = extractLabeledField(markdown, 'Context') || '';
  const decision = extractLabeledField(markdown, 'Decision') || '';
  const reasoning = extractLabeledField(markdown, 'Reasoning') || '';

  return {
    id,
    title,
    context,
    decision,
    reasoning,
    resolved_debate_id: null,
    decided_at: new Date().toISOString(),
  };
}

// ---- Internal helpers ----

interface Section {
  heading: string;
  body: string;
}

function splitByH2(markdown: string): Section[] {
  const sections: Section[] = [];
  const parts = markdown.split(/^## /m);

  for (let i = 1; i < parts.length; i++) {
    const newlineIdx = parts[i].indexOf('\n');
    if (newlineIdx === -1) {
      sections.push({ heading: parts[i].trim(), body: '' });
    } else {
      sections.push({
        heading: parts[i].substring(0, newlineIdx).trim(),
        body: parts[i].substring(newlineIdx + 1),
      });
    }
  }

  return sections;
}

function extractSectionText(markdown: string, heading: string): string {
  const body = extractSectionBody(markdown, heading);
  if (!body) return '';
  return body.split('\n').filter(l => l.trim()).map(l => l.replace(/^[-*]\s*/, '').trim()).join(' ').trim();
}

function extractSectionBody(markdown: string, heading: string): string | null {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^##\\s+${escapedHeading}\\s*$`, 'im');
  const match = markdown.match(regex);
  if (!match || match.index === undefined) return null;

  const start = match.index + match[0].length;
  const nextHeading = markdown.substring(start).match(/^##\s/m);
  const end = nextHeading && nextHeading.index !== undefined ? start + nextHeading.index : markdown.length;

  return markdown.substring(start, end).trim();
}

function extractBulletList(markdown: string, heading: string): string[] {
  const body = extractSectionBody(markdown, heading);
  if (!body) return [];
  return extractBulletListFromBody(body);
}

function extractBulletListFromBody(body: string): string[] {
  const items: string[] = [];
  for (const line of body.split('\n')) {
    const match = line.match(/^\s*[-*]\s+(.+)/);
    if (match) {
      items.push(match[1].trim());
    }
  }
  return items;
}

function parseVisionStatusTable(markdown: string): VisionStatus[] {
  const body = extractSectionBody(markdown, 'Vision Status');
  if (!body) return [];

  const statuses: VisionStatus[] = [];
  const lines = body.split('\n');

  for (const line of lines) {
    // Match table rows: | Goal | Status | Delivered By |
    const match = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.*?)\s*\|$/);
    if (!match) continue;

    const goal = match[1].trim();
    const rawStatus = match[2].trim();
    const deliveredBy = match[3].trim();

    // Skip header and separator rows
    if (goal === 'Vision Goal' || goal.startsWith('---') || goal === '') continue;
    if (rawStatus.startsWith('---')) continue;

    const status = normalizeStatus(rawStatus);
    const entry: VisionStatus = { goal, status };
    if (deliveredBy && deliveredBy !== '—' && deliveredBy !== '-') {
      entry.delivered_by = deliveredBy;
    }

    statuses.push(entry);
  }

  return statuses;
}

function normalizeStatus(raw: string): VisionStatus['status'] {
  const lower = raw.toLowerCase().replace(/\s+/g, '_');
  if (lower.includes('done') || lower.includes('complete')) return 'done';
  if (lower.includes('in_progress') || lower.includes('in progress') || lower.includes('wip')) return 'in_progress';
  if (lower.includes('out_of_scope') || lower.includes('out of scope')) return 'out_of_scope';
  return 'not_started';
}

function parseDebateOptions(body: string): DebateOption[] {
  const options: DebateOption[] = [];
  const optionLabels = new Map<string, { forArgs: string[]; againstArgs: string[] }>();

  // Find all **For [Label]:** and **Against [Label]:** sections
  const forRegex = /\*\*For\s+(.+?):\*\*/g;
  const againstRegex = /\*\*Against\s+(.+?):\*\*/g;

  let match;
  while ((match = forRegex.exec(body)) !== null) {
    const label = match[1].replace(/[[\]]/g, '').trim();
    if (!optionLabels.has(label)) {
      optionLabels.set(label, { forArgs: [], againstArgs: [] });
    }
    const start = match.index + match[0].length;
    const nextSection = body.substring(start).match(/\*\*(For|Against|Verdict)\s/);
    const end = nextSection && nextSection.index !== undefined ? start + nextSection.index : body.length;
    const sectionBody = body.substring(start, end);
    optionLabels.get(label)!.forArgs = extractBulletListFromBody(sectionBody);
  }

  while ((match = againstRegex.exec(body)) !== null) {
    const label = match[1].replace(/[[\]]/g, '').trim();
    if (!optionLabels.has(label)) {
      optionLabels.set(label, { forArgs: [], againstArgs: [] });
    }
    const start = match.index + match[0].length;
    const nextSection = body.substring(start).match(/\*\*(For|Against|Verdict)\s/);
    const end = nextSection && nextSection.index !== undefined ? start + nextSection.index : body.length;
    const sectionBody = body.substring(start, end);
    optionLabels.get(label)!.againstArgs = extractBulletListFromBody(sectionBody);
  }

  for (const [label, { forArgs, againstArgs }] of optionLabels) {
    options.push({
      label,
      for: forArgs,
      against: againstArgs,
    });
  }

  return options;
}

function parseCheckboxList(body: string): MilestoneTask[] {
  const tasks: MilestoneTask[] = [];
  for (const line of body.split('\n')) {
    const match = line.match(/^\s*-\s+\[([ xX])\]\s+(.+)/);
    if (match) {
      tasks.push({
        description: match[2].trim(),
        done: match[1] !== ' ',
      });
    }
  }
  return tasks;
}

function extractLabeledField(markdown: string, label: string): string | null {
  // Try **Label:** format first
  const boldRegex = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+?)(?=\\*\\*\\w+:|^##|$)`, 'is');
  const boldMatch = markdown.match(boldRegex);
  if (boldMatch) return boldMatch[1].trim();

  // Try ## Label section format
  const sectionBody = extractSectionBody(markdown, label);
  if (sectionBody) return sectionBody.split('\n').filter(l => l.trim()).join(' ').trim();

  return null;
}
