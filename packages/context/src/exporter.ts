/**
 * Context exporter — reads project docs and produces .opkg context content.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import type { ContextContent, ExportOptions } from './index';
import { parseVision, parseDebates, parseTodo, parseConventions, parseDecision } from './parser';

/**
 * Export a project's documentation state as a ContextContent object.
 *
 * Reads the following files from the project directory:
 * - VISION.md → vision
 * - DEBATES.md → debates
 * - TODO.md → milestones
 * - CLAUDE.md → conventions
 * - decisions/*.md → decisions
 *
 * Missing files are skipped — only `VISION.md` is required.
 *
 * @returns A valid ContextContent object ready to be wrapped in a .opkg envelope.
 */
export function exportContext(options: ExportOptions): ContextContent {
  const { projectDir, ownerDid, projectId, projectName, relationships, extensions } = options;

  // Read VISION.md (required)
  const visionPath = join(projectDir, 'VISION.md');
  if (!existsSync(visionPath)) {
    throw new Error(`VISION.md not found at ${visionPath}. A vision document is required for context export.`);
  }
  const visionMd = readFileSync(visionPath, 'utf-8');
  const vision = parseVision(visionMd);

  const content: ContextContent = {
    owner_did: ownerDid,
    project_id: projectId,
    project_name: projectName,
    exported_at: new Date().toISOString(),
    vision,
  };

  // Read DEBATES.md (optional)
  const debatesPath = join(projectDir, 'DEBATES.md');
  if (existsSync(debatesPath)) {
    const debatesMd = readFileSync(debatesPath, 'utf-8');
    const debates = parseDebates(debatesMd);
    if (debates.length > 0) {
      content.debates = debates;
    }
  }

  // Read decisions/*.md (optional)
  const decisionsDir = join(projectDir, 'decisions');
  if (existsSync(decisionsDir)) {
    const decisionFiles = readdirSync(decisionsDir)
      .filter(f => f.endsWith('.md'))
      .sort();

    if (decisionFiles.length > 0) {
      content.decisions = decisionFiles.map(filename => {
        const md = readFileSync(join(decisionsDir, filename), 'utf-8');
        return parseDecision(md, filename);
      });
    }
  }

  // Read CLAUDE.md (optional)
  const claudePath = join(projectDir, 'CLAUDE.md');
  if (existsSync(claudePath)) {
    const claudeMd = readFileSync(claudePath, 'utf-8');
    const conventions = parseConventions(claudeMd);
    if (Object.keys(conventions).length > 0) {
      content.conventions = conventions;
    }
  }

  // Read TODO.md (optional)
  const todoPath = join(projectDir, 'TODO.md');
  if (existsSync(todoPath)) {
    const todoMd = readFileSync(todoPath, 'utf-8');
    const milestones = parseTodo(todoMd);
    if (milestones.length > 0) {
      content.milestones = milestones;
    }
  }

  // Add relationships if provided
  if (relationships && relationships.length > 0) {
    content.relationships = relationships;
  }

  // Add extensions if provided
  if (extensions && Object.keys(extensions).length > 0) {
    content.extensions = extensions;
  }

  return content;
}
