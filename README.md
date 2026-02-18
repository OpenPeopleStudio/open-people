# open_people

A portable data standard for human identity, AI agents, and memory. Create a keypair, package your data, sign it, and carry it anywhere — across apps, devices, or planets. No central authority. No blockchain. Just cryptography and open formats.

**This is a standard, not a product.** [Mars HQ](https://github.com/OpenPeopleStudio/mars-hq) is the first implementation.

## Why

Read the [Manifesto](docs/MANIFESTO.md).

## The Spec

Start here:

1. [Spec Overview & Glossary](docs/spec/README.md)
2. [Identity](docs/spec/01-identity.md) — Ed25519 keypairs, `did:key:` DIDs
3. [Data Package (.opkg)](docs/spec/02-data-package.md) — Signed, content-addressed containers
4. [Agent Portability](docs/spec/03-agent-portable.md) — Portable AI agent format
5. [Project Context](docs/spec/04-project-context.md) — Vision, debates, decisions, conventions as portable packages

## Reference

- [.marsbot to .opkg Migration](docs/reference/marsbot-mapping.md) — Field-by-field mapping
- [Schema Catalog](docs/reference/schema-catalog.md) — JSON Schema definitions for all content types

## Current Status

**M1 (Spec) and M2 (Reference Implementation) are complete.**

- Four spec documents: identity, data package, agent portability, project context
- Five TypeScript packages: `identity`, `package`, `verify`, `migrate`, `context`
- 24 integration tests passing (identity round-trips, canonical JSON, sign/verify, tamper detection, migration)
- Crypto stack: Noble ecosystem (pure TypeScript, audited, isomorphic)

Next: M3 (Mars HQ Bridge). See [TODO.md](TODO.md) for the full roadmap.

## Architecture

```
open-people/
├── docs/
│   ├── MANIFESTO.md          # Why this exists
│   ├── spec/                  # The standard
│   │   ├── README.md          # Reading order + glossary
│   │   ├── 01-identity.md     # DID + keypairs
│   │   ├── 02-data-package.md # .opkg format
│   │   ├── 03-agent-portable.md # Agent portability
│   │   └── 04-project-context.md # Project context
│   └── reference/             # Implementation guides
│       ├── marsbot-mapping.md # Migration from .marsbot
│       └── schema-catalog.md  # All JSON Schemas
├── packages/                  # Reference implementation + tools
│   ├── identity/              # DID generation, keypair management
│   ├── package/               # .opkg builder, parser, validator
│   ├── verify/                # Signing, hash verification
│   ├── migrate/               # .marsbot -> .opkg converter
│   └── context/               # Project docs -> .opkg context exporter
├── examples/                  # Working .opkg examples
└── decisions/                 # Architecture Decision Records
```

## Setup

```bash
npm install
npm run build
npm test        # runs tests across all packages
```

### Packages

| Package | Description |
|---|---|
| `@open-people/identity` | Ed25519 keypair generation, `did:key:` DID encoding/decoding, DID Documents |
| `@open-people/package` | .opkg envelope builder, canonical JSON, content hashing, validation |
| `@open-people/verify` | Ed25519 signing and verification of .opkg packages |
| `@open-people/migrate` | .marsbot v1 ↔ .opkg format conversion |
| `@open-people/context` | Project docs (VISION, DEBATES, TODO) → .opkg context export |
