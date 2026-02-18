# open_people TODO

## Current Sprint

M3 (Mars HQ Bridge) is complete. All items done — 44 passing tests.

---

## M1: Spec Complete
The spec is the product. All three core documents plus reference material.

- [x] Identity spec — Ed25519, did:key:, DID Document
- [x] Data package spec — .opkg format, 7 content types, signing, verification
- [x] Agent portability spec — agent content type, extensions, memory linking
- [x] Spec README — reading order, glossary, design principles
- [x] .marsbot -> .opkg migration guide
- [x] JSON Schema catalog for all content types
- [x] Example .opkg files that conform to the spec
- [x] Context content type spec (7th content type)
- [x] Context JSON Schema + example .opkg
- [x] Context export script package

## M2: Reference Implementation
TypeScript packages that can create, parse, sign, and verify open_people data.

- [x] `packages/identity/` — Generate Ed25519 keypairs, create DIDs, serialize/parse DID Documents
- [x] `packages/package/` — Build .opkg containers, compute content hashes, canonical JSON serialization
- [x] `packages/verify/` — Sign packages with Ed25519, verify signatures, validate content hashes
- [x] `packages/migrate/` — Convert .marsbot v1 files to .opkg format and back
- [x] Integration tests — round-trip: generate identity -> create package -> sign -> verify -> parse

## M3: Mars HQ Bridge
Connect the standard to its first implementation.

- [x] Adapter layer: `hqToMarsbotExport` + `marsbotExportToHq` (opkg-adapter.ts)
- [x] Identity key manager: `getOrCreateOwnerKeypair` + `getOwnerDID` (identity-keys.ts)
- [x] Export pipeline: `exportAgentAsOpkg` produces signed .opkg packages
- [x] Import pipeline: `importAgentFromOpkg` with verify + merge options
- [x] CLI commands: `mars agent export-opkg` + `mars agent import-opkg`
- [x] Unit tests (adapter) + integration tests (pipeline) — 34 passing
- [x] Public API exports in @mars-hq/agents index
- [x] Mars HQ identity page generates and displays DID (web + desktop settings)
- [x] Mars HQ workspace export as .opkg bundle (exportWorkspaceAsOpkg, CLI, 10 tests)

## M4: Federation & Transmission
Cross-system and cross-distance package handling.

- [ ] Transmission class handling (local, network, interplanetary)
- [ ] Package discovery protocol (how systems find and request packages)
- [ ] Bundle compression strategies for interplanetary transmission
- [ ] Conflict resolution when importing packages from multiple sources
