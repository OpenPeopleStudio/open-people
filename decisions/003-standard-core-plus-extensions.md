# 003: Standard Core Profile + Namespaced Extensions for Agent Model

## Context
Mars HQ has a rich agent model (personality dimensions, guardrails, visual identity). The question was how much of this to standardize vs keep as implementation-specific.

## Decision
Minimal standard core profile + namespaced extensions.

## Reasoning
- **Core profile** covers universal concepts every agent system needs: `name`, `capabilities`, `memory_format`, `origin`. Any system can read and use these fields.
- **Namespaced extensions** (`extensions["mars-hq"]`) let Mars HQ keep its personality dimensions, guardrails, and visual identity without forcing them on other implementations.
- **Adoption-friendly**: Implement the core, ignore extensions you don't understand. Follows the pattern of successful standards (HTML, HTTP headers, JSON-LD).
- **Validated by M2**: The `@open-people/migrate` package implements this pattern — standard fields map to `content.profile`, Mars-HQ-specific fields map to `content.extensions["mars-hq"]`. Round-trip tests confirm the approach works.
- **Accepted risk**: Extensions that aren't standard won't be portable across systems. Mars-HQ personality data may be lost when importing into other systems. This is acceptable — the core is portable, the rest is best-effort.

See DEBATES.md "How much of mars-hq's agent model becomes standard vs stays mars-hq-specific" for the full deliberation.
