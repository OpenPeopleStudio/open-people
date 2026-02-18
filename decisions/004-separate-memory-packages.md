# 004: Memory as Separate Packages Linked via Bundle

## Context
In `.marsbot`, memory is embedded inside the agent export. The question was whether `.opkg` should do the same or ship memory as a separate package.

## Decision
Memory is a separate package (`content_type: "memory"`), linked to the agent via `memory_refs` and grouped with `content_type: "bundle"` when you want the complete picture.

## Reasoning
- **Independent verification**: Each package has its own `content_hash` and signature. Memory integrity is verifiable without the agent package.
- **Selective sharing**: Send just the agent (fresh start), or agent + memory (full context), or agent + memory + workspace (everything). Privacy-friendly — share your agent config without exposing your memories.
- **Independent versioning**: Memory updates frequently (new reflections, key-value changes). Agent profile changes rarely. Decoupling lets each evolve on its own timeline.
- **Content-addressed philosophy**: Follows the core design principle — each piece is independently addressable and verifiable.
- **Validated by M2**: The `@open-people/migrate` package produces separate agent and memory packages linked via bundle. The `marsbotToOpkg` function creates up to 3 packages (agent, memory, bundle). Round-trip tests confirm the approach preserves all data.
- **Accepted risk**: More complex than embedded memory. Bundles add a layer of indirection. Broken references possible if a memory package is missing. This is acceptable — the bundle ties them together, and `memory_refs` provides explicit linking.

See DEBATES.md "Memory embedded in agent package vs shipped separately" for the full deliberation.
