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

## Reference

- [.marsbot to .opkg Migration](docs/reference/marsbot-mapping.md) — Field-by-field mapping
- [Schema Catalog](docs/reference/schema-catalog.md) — JSON Schema definitions for all content types

## Current Status

Spec phase. The three core spec documents (identity, data package, agent portability) are written. Reference implementation packages are stubbed but not yet built.

See [TODO.md](TODO.md) for the full roadmap.

## Architecture

```
open-people/
├── docs/
│   ├── MANIFESTO.md          # Why this exists
│   ├── spec/                  # The standard
│   │   ├── README.md          # Reading order + glossary
│   │   ├── 01-identity.md     # DID + keypairs
│   │   ├── 02-data-package.md # .opkg format
│   │   └── 03-agent-portable.md # Agent portability
│   └── reference/             # Implementation guides
│       ├── marsbot-mapping.md # Migration from .marsbot
│       └── schema-catalog.md  # All JSON Schemas
├── packages/                  # Future reference implementation
│   ├── identity/              # DID generation, keypair management
│   ├── package/               # .opkg builder, parser, validator
│   ├── verify/                # Signing, hash verification
│   └── migrate/               # .marsbot -> .opkg converter
├── examples/                  # Working .opkg examples
└── decisions/                 # Architecture Decision Records
```

## Setup (Future)

```bash
npm install
npm run build
```

Reference implementation packages are not yet built. See [TODO.md](TODO.md) M2 milestone.
