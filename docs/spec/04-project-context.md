# 04: Project Context

## Summary

The `context` content type captures a project's planning, decision, and convention state as a portable, verifiable snapshot. It makes the history of *why* a project exists, *what* decisions were made, and *how* it relates to other projects machine-readable and exportable.

Context packages solve a specific problem: project documentation (vision docs, debates, decision records, conventions, milestones) lives in markdown files scattered across repositories. It cannot be cross-referenced across projects, queried programmatically, or verified for authorship. A context package serializes this documentation state into the `.opkg` format — signed, content-addressed, and structured.

Context is distinct from existing content types:
- **Memory** stores learned knowledge and reflections. Context stores structured project metadata.
- **Workspace** stores UI layout and preferences. Context stores planning and decision history.
- **Agent** stores an AI agent's portable definition. Context stores the project environment the agent operates in.

## Context Content Schema

```json
{
  "owner_did": "did:key:z6Mk...",
  "project_id": "openPeopleStudio/mars-hq",
  "project_name": "Mars HQ",
  "exported_at": "2026-02-18T12:00:00Z",
  "vision": {
    "summary": "Personal operating environment for identity, agents, and memory.",
    "audience": "Mars (primary user) and future open_people adopters",
    "done_criteria": ["Users can sign up", "Agent loop works", "Desktop app ships"],
    "out_of_scope": ["Social network", "Marketplace"],
    "status": [
      {
        "goal": "Agent loop",
        "status": "done",
        "delivered_by": "packages/runtime/"
      }
    ]
  },
  "debates": [
    {
      "id": "debate-001",
      "question": "Should vault DEK go in ToolContext or SessionKeyHolder?",
      "status": "open",
      "options": [
        {
          "label": "SessionKeyHolder in worker",
          "for": ["Natural fit", "DEK never leaves worker"],
          "against": ["No direct ToolContext access"]
        }
      ],
      "verdict": null,
      "resolved_decision_id": null,
      "created_at": "2026-02-10T00:00:00Z"
    }
  ],
  "decisions": [
    {
      "id": "decision-001",
      "title": "Connections data model",
      "context": "Extend contacts table or separate relationships table?",
      "decision": "Separate relationships table with FK to contacts",
      "reasoning": "Clean separation: contacts = who, relationships = how we relate",
      "resolved_debate_id": "debate-connections-data-model",
      "decided_at": "2026-02-15T00:00:00Z"
    }
  ],
  "conventions": {
    "stack": {
      "language": "TypeScript",
      "build": "Vite",
      "backend": "Supabase"
    },
    "key_paths": [
      {
        "path": "packages/runtime/",
        "description": "Agent execution engine"
      }
    ],
    "rules": ["All agent tools live in packages/runtime/src/tools/"],
    "ownership": {
      "owner": "Mars",
      "org": "OpenPeopleStudio"
    }
  },
  "milestones": [
    {
      "id": "M1",
      "name": "Skeleton + Docs",
      "tasks": [
        { "description": "Init Vite project", "done": true },
        { "description": "Deploy to Vercel", "done": false }
      ]
    }
  ],
  "relationships": [
    {
      "project_id": "openPeopleStudio/open-people",
      "relationship": "implements",
      "description": "First implementation of the open_people standard"
    }
  ],
  "extensions": {}
}
```

## Field Reference

### Top-Level Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `owner_did` | string | Yes | DID of the project owner |
| `project_id` | string | Yes | Stable identifier in `org/project-name` format. Not a DID — projects are not identities. |
| `project_name` | string | Yes | Human-readable project name |
| `exported_at` | string | Yes | ISO 8601 timestamp of when this context snapshot was created |
| `vision` | object | Yes | Project vision and goal tracking |
| `debates` | array | No | Structured deliberation records |
| `decisions` | array | No | Architecture decision records |
| `conventions` | object | No | Stack, key paths, rules, and ownership |
| `milestones` | array | No | Grouped tasks with completion status |
| `relationships` | array | No | How this project connects to other projects |
| `extensions` | object | No | Namespaced extension data |

### Vision Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `vision.summary` | string | Yes | One-sentence description of what the project is building |
| `vision.audience` | string | No | Who the project is for |
| `vision.done_criteria` | string[] | Yes | 3-5 bullet points describing the end state |
| `vision.out_of_scope` | string[] | No | Explicit scope boundaries — what the project is NOT building |
| `vision.status` | array | Yes | Living snapshot of goal progress |
| `vision.status[].goal` | string | Yes | Name of the vision goal |
| `vision.status[].status` | string | Yes | One of: `done`, `in_progress`, `not_started`, `out_of_scope` |
| `vision.status[].delivered_by` | string | No | File path, package, or component delivering this goal |

### Debate Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `debates[].id` | string | Yes | Stable identifier for cross-referencing (e.g., `debate-001`) |
| `debates[].question` | string | Yes | The question being debated |
| `debates[].status` | string | Yes | One of: `open`, `leaning`, `resolved` |
| `debates[].options` | array | Yes | The options being considered (minimum 2) |
| `debates[].options[].label` | string | Yes | Short name for this option |
| `debates[].options[].for` | string[] | Yes | Arguments in favor of this option |
| `debates[].options[].against` | string[] | Yes | Arguments against this option |
| `debates[].verdict` | string | No | If resolved or leaning — the reasoning, not just the choice |
| `debates[].resolved_decision_id` | string | No | Links to a decision record if this debate was resolved into one |
| `debates[].created_at` | string | Yes | ISO 8601 timestamp |

### Decision Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `decisions[].id` | string | Yes | Stable identifier (e.g., `decision-001`) |
| `decisions[].title` | string | Yes | Short title of the decision |
| `decisions[].context` | string | Yes | What problem or question prompted this decision |
| `decisions[].decision` | string | Yes | What was decided |
| `decisions[].reasoning` | string | Yes | Why this choice was made |
| `decisions[].resolved_debate_id` | string | No | Links back to the debate that led to this decision |
| `decisions[].decided_at` | string | Yes | ISO 8601 timestamp |

### Convention Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `conventions.stack` | object | No | Key-value pairs describing the tech stack |
| `conventions.key_paths` | array | No | Important file paths with descriptions |
| `conventions.key_paths[].path` | string | Yes | File or directory path |
| `conventions.key_paths[].description` | string | Yes | What lives at this path |
| `conventions.rules` | string[] | No | Coding conventions and project rules |
| `conventions.ownership` | object | No | Project ownership information |
| `conventions.ownership.owner` | string | Yes | Name of the project owner |
| `conventions.ownership.org` | string | No | Organization name |

### Milestone Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `milestones[].id` | string | Yes | Milestone identifier (e.g., `M1`, `M2`) |
| `milestones[].name` | string | Yes | Human-readable milestone name |
| `milestones[].tasks` | array | Yes | Tasks within this milestone |
| `milestones[].tasks[].description` | string | Yes | What needs to be done |
| `milestones[].tasks[].done` | boolean | Yes | Whether the task is complete |

### Relationship Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `relationships[].project_id` | string | Yes | `org/project-name` of the related project |
| `relationships[].relationship` | string | Yes | One of: `implements`, `depends_on`, `extends`, `forks`, `related` |
| `relationships[].description` | string | No | Human-readable description of the relationship |

## Debate-Decision Linking

Debates and decisions are linked bidirectionally:

- A debate's `resolved_decision_id` points to the decision that resolved it
- A decision's `resolved_debate_id` points to the debate that prompted it

Both fields are optional:
- Not all debates become decisions (some are resolved without a formal ADR)
- Not all decisions had debates (some are straightforward enough to decide directly)

When a debate is resolved into a decision, its `status` MUST be `"resolved"` and `resolved_decision_id` MUST be set.

## Project ID Format

The `project_id` uses `org/project-name` format (e.g., `openPeopleStudio/mars-hq`). This is a stable identifier for cross-export referencing — not a DID. Projects are organizational constructs, not cryptographic identities.

The same project MAY have multiple context packages over time (snapshots). Each has its own `exported_at` timestamp and `content_hash`. To reconstruct the full history of a project's planning state, collect all context packages with the same `project_id` and order by `exported_at`.

## Export Guidance

Context packages are snapshots, not live documents. Recommended export triggers:

- **Milestone completion**: Export when a milestone moves to done
- **Decision resolution**: Export when a significant debate is resolved
- **Release**: Export alongside each release or deployment
- **On demand**: Manual export before archiving or sharing a project

The export script (`packages/context/`) reads project documentation files and produces valid context content JSON. Signing requires the identity package (not yet implemented — signature placeholder is acceptable).

## Extension Points

Extensions carry implementation-specific context data under namespaced keys, following the same rules as agent extensions (see [03-agent-portable.md](03-agent-portable.md)):

1. A system MUST ignore extensions it doesn't understand
2. A system MUST preserve extensions it doesn't understand when re-exporting
3. Extension data is NOT validated by the open_people standard
4. Extension keys MUST be lowercase alphanumeric with hyphens

Example extensions:
- `mars-hq:workflow` — Mars HQ-specific workflow configuration (prompt patterns, session rules)
- `mars-hq:ci` — CI/CD pipeline configuration associated with the project

## What Is NOT Exported

| Excluded | Reason |
|---|---|
| File contents | Context captures metadata about a project, not the project's source code |
| Git history | Too large, system-specific — use git for git history |
| Environment variables | Security — never include secrets or credentials |
| Build artifacts | Ephemeral and system-specific |
| User-specific tool config | IDE settings, local overrides — not project-level |

## Verify

A conforming implementation MUST pass these tests:

1. **Create**: Create a context package with all required fields (owner_did, project_id, project_name, exported_at, vision with summary, done_criteria, and status). Validate against the JSON Schema.
2. **Vision status values**: Create a context package with `vision.status` entries using each valid status value (`done`, `in_progress`, `not_started`, `out_of_scope`). All validate.
3. **Debate-decision linking**: Create a context package with a resolved debate pointing to a decision, and that decision pointing back. Both IDs match.
4. **Relationship types**: Create context packages using each relationship type (`implements`, `depends_on`, `extends`, `forks`, `related`). All validate.
5. **Extensions preserved**: Import a context package with unknown extensions. Re-export. Unknown extensions are still present and unchanged.
6. **Minimal valid**: A context package with only required fields (no debates, decisions, conventions, milestones, or relationships) validates successfully.
7. **Round-trip**: Create context from project docs → serialize to JSON → parse → all fields match original.
