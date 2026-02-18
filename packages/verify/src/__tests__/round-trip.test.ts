/**
 * Integration tests for the open_people reference implementation.
 *
 * Covers the full pipeline: identity → package → sign → verify → migrate.
 */

import { describe, it, expect } from 'vitest';
import {
  generateKeypair,
  publicKeyToDID,
  didToPublicKey,
  createDIDDocument,
} from '@open-people/identity';
import {
  canonicalize,
  contentHash,
  createPackage,
  parsePackage,
  validatePackage,
  generatePackageId,
} from '@open-people/package';
import { signPackage, verifyPackage } from '@open-people/verify';
import { marsbotToOpkg, opkgToMarsbot, type MarsbotExport } from '@open-people/migrate';

// ---- 1. Identity round-trip ----

describe('Identity', () => {
  it('generates a valid Ed25519 keypair', async () => {
    const kp = await generateKeypair();
    expect(kp.publicKey).toBeInstanceOf(Uint8Array);
    expect(kp.privateKey).toBeInstanceOf(Uint8Array);
    expect(kp.publicKey.length).toBe(32);
    expect(kp.privateKey.length).toBe(32);
  });

  it('round-trips: publicKey → DID → publicKey', async () => {
    const kp = await generateKeypair();
    const did = publicKeyToDID(kp.publicKey);
    const recovered = didToPublicKey(did);
    expect(recovered).toEqual(kp.publicKey);
  });

  it('generates DIDs matching the did:key:z6Mk pattern', async () => {
    const kp = await generateKeypair();
    const did = publicKeyToDID(kp.publicKey);
    expect(did).toMatch(/^did:key:z6Mk/);
  });

  it('rejects invalid DID format', () => {
    expect(() => didToPublicKey('not-a-did')).toThrow('Invalid did:key format');
  });

  it('creates a DID Document with all fields', async () => {
    const kp = await generateKeypair();
    const doc = createDIDDocument(kp, {
      display_name: 'Test Agent',
      bio: 'A test agent',
      color: '#ff0000',
    });

    expect(doc.id).toMatch(/^did:key:z6Mk/);
    expect(doc.public_key).toHaveLength(64); // 32 bytes hex = 64 chars
    expect(doc.display_name).toBe('Test Agent');
    expect(doc.bio).toBe('A test agent');
    expect(doc.color).toBe('#ff0000');
    expect(doc.created_at).toBeTruthy();
  });

  it('supports rotation and revocation fields', async () => {
    const kp = await generateKeypair();
    const doc = createDIDDocument(kp, {
      rotation: { next_key_hash: 'abc123', rotated_at: '2025-01-01T00:00:00Z' },
      revocation: { revoked: false },
    });
    expect(doc.rotation?.next_key_hash).toBe('abc123');
    expect(doc.revocation?.revoked).toBe(false);
  });
});

// ---- 2. Canonical JSON ----

describe('Canonical JSON', () => {
  it('sorts keys lexicographically', () => {
    const result = canonicalize({ z: 1, a: 2, m: 3 });
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it('sorts nested keys recursively', () => {
    const result = canonicalize({ b: { z: 1, a: 2 }, a: 1 });
    expect(result).toBe('{"a":1,"b":{"a":2,"z":1}}');
  });

  it('handles arrays without reordering', () => {
    const result = canonicalize({ items: [3, 1, 2] });
    expect(result).toBe('{"items":[3,1,2]}');
  });

  it('produces no whitespace', () => {
    const result = canonicalize({ hello: 'world', nested: { a: 1 } });
    expect(result).not.toMatch(/\s/);
  });

  it('is deterministic across runs', () => {
    const obj = { name: 'test', value: 42, nested: { z: 1, a: 2 } };
    const a = canonicalize(obj);
    const b = canonicalize(obj);
    expect(a).toBe(b);
  });

  it('content hash is deterministic', () => {
    const content = { name: 'test', value: 42 };
    const h1 = contentHash(content);
    const h2 = contentHash(content);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // SHA-256 hex
  });
});

// ---- 3. Package creation ----

describe('Package', () => {
  it('generates valid UUIDv7 package IDs', () => {
    const id1 = generatePackageId();
    const id2 = generatePackageId();
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(id1).not.toBe(id2);
  });

  it('creates a package with all required fields', async () => {
    const kp = await generateKeypair();
    const did = publicKeyToDID(kp.publicKey);
    const content = { name: 'test', value: 42 };
    const sign = await signPackage(content, kp.privateKey);

    const pkg = createPackage({
      contentType: 'identity',
      content,
      authorDid: did,
      signature: sign.signature,
    });

    expect(pkg.open_people).toBe(1);
    expect(pkg.package_id).toBeTruthy();
    expect(pkg.created_at).toBeTruthy();
    expect(pkg.author.did).toBe(did);
    expect(pkg.author.signature).toBe(sign.signature);
    expect(pkg.content_hash).toHaveLength(64);
    expect(pkg.content_type).toBe('identity');
    expect(pkg.content).toEqual(content);
    expect(pkg.metadata.schema_version).toBe('1.0.0');
    expect(pkg.metadata.transmission_class).toBe('local');
    expect(pkg.metadata.compression).toBe('none');
  });

  it('validates a correct package', async () => {
    const kp = await generateKeypair();
    const did = publicKeyToDID(kp.publicKey);
    const content = { test: true };
    const sign = await signPackage(content, kp.privateKey);

    const pkg = createPackage({
      contentType: 'agent',
      content,
      authorDid: did,
      signature: sign.signature,
    });

    const result = validatePackage(pkg);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects content_hash mismatch in validation', async () => {
    const kp = await generateKeypair();
    const did = publicKeyToDID(kp.publicKey);
    const content = { test: true };
    const sign = await signPackage(content, kp.privateKey);

    const pkg = createPackage({
      contentType: 'agent',
      content,
      authorDid: did,
      signature: sign.signature,
    });

    // Tamper with content
    pkg.content = { test: false };

    const result = validatePackage(pkg);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('content_hash mismatch'))).toBe(true);
  });

  it('round-trips through JSON parse', async () => {
    const kp = await generateKeypair();
    const did = publicKeyToDID(kp.publicKey);
    const content = { name: 'test' };
    const sign = await signPackage(content, kp.privateKey);

    const pkg = createPackage({
      contentType: 'identity',
      content,
      authorDid: did,
      signature: sign.signature,
    });

    const json = JSON.stringify(pkg);
    const parsed = parsePackage(json);
    expect(parsed.package_id).toBe(pkg.package_id);
    expect(parsed.content).toEqual(pkg.content);
    expect(parsed.content_hash).toBe(pkg.content_hash);
  });
});

// ---- 4. Sign + Verify ----

describe('Sign & Verify', () => {
  it('signs and verifies a package', async () => {
    const kp = await generateKeypair();
    const did = publicKeyToDID(kp.publicKey);
    const content = { message: 'hello open_people' };
    const sign = await signPackage(content, kp.privateKey);

    const pkg = createPackage({
      contentType: 'identity',
      content,
      authorDid: did,
      signature: sign.signature,
    });

    const result = await verifyPackage(pkg);
    expect(result.valid).toBe(true);
    expect(result.integrity).toBe(true);
    expect(result.authenticity).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('detects tampered content (integrity failure)', async () => {
    const kp = await generateKeypair();
    const did = publicKeyToDID(kp.publicKey);
    const content = { message: 'original' };
    const sign = await signPackage(content, kp.privateKey);

    const pkg = createPackage({
      contentType: 'identity',
      content,
      authorDid: did,
      signature: sign.signature,
    });

    // Tamper with content after creation
    pkg.content = { message: 'tampered' };

    const result = await verifyPackage(pkg);
    expect(result.valid).toBe(false);
    expect(result.integrity).toBe(false);
    expect(result.error).toContain('Content hash mismatch');
  });

  it('detects wrong signer (authenticity failure)', async () => {
    const kpAuthor = await generateKeypair();
    const kpImposter = await generateKeypair();
    const authorDid = publicKeyToDID(kpAuthor.publicKey);
    const content = { secret: 'data' };

    // Sign with imposter's key but claim author's DID
    const sign = await signPackage(content, kpImposter.privateKey);

    const pkg = createPackage({
      contentType: 'identity',
      content,
      authorDid: authorDid,
      signature: sign.signature,
    });

    const result = await verifyPackage(pkg);
    expect(result.valid).toBe(false);
    expect(result.integrity).toBe(true);
    expect(result.authenticity).toBe(false);
  });
});

// ---- 5. Full round-trip ----

describe('Full Round-Trip', () => {
  it('generate → create → sign → serialize → parse → verify', async () => {
    // 1. Generate identity
    const kp = await generateKeypair();
    const did = publicKeyToDID(kp.publicKey);

    // 2. Create content
    const content = {
      name: 'Mars',
      capabilities: ['reasoning', 'code'],
      origin: { trigger: 'user_created', born_at: '2025-01-01T00:00:00Z' },
    };

    // 3. Sign
    const sign = await signPackage(content, kp.privateKey);

    // 4. Create package
    const pkg = createPackage({
      contentType: 'agent',
      content,
      authorDid: did,
      signature: sign.signature,
    });

    // 5. Serialize to JSON
    const json = JSON.stringify(pkg);

    // 6. Parse back
    const parsed = parsePackage(json);

    // 7. Verify
    const result = await verifyPackage(parsed);
    expect(result.valid).toBe(true);
    expect(result.integrity).toBe(true);
    expect(result.authenticity).toBe(true);

    // 8. Validate
    const validation = validatePackage(parsed);
    expect(validation.valid).toBe(true);
  });
});

// ---- 6. Migration round-trip ----

describe('Migration', () => {
  const sampleMarsbot: MarsbotExport = {
    version: 1,
    exportedAt: '2025-06-15T10:00:00Z',
    agent: {
      identity: { name: 'Atlas', color: '#3b82f6', expressiveState: 'idle' },
      personality: {
        verbosity: 0.3,
        formality: -0.2,
        carefulness: 0.8,
        curiosity: 0.9,
        tone: 'encouraging',
        vibeWords: ['curious', 'thorough'],
        roleModel: 'Ada Lovelace',
      },
      origin: { trigger: 'user_created', need: 'A research assistant', bornAt: '2025-01-01T00:00:00Z' },
      model: { provider: 'anthropic', model: 'claude-opus-4-6', temperature: 0.7, maxTokens: 4096 },
      systemPromptAdditions: ['Always cite sources'],
      guardrails: {
        blockedTopics: ['violence'],
        requireApprovalFor: ['external_api'],
        maxTokensPerTurn: 2048,
      },
    },
    memory: {
      reflections: [
        { content: 'User prefers concise answers', confidence: 0.9, source: 'observation', createdAt: '2025-03-01T00:00:00Z' },
      ],
      keyValueStore: { favorite_language: 'TypeScript', timezone: 'America/New_York' },
    },
    skills: ['code_review', 'research'],
  };

  it('converts .marsbot to .opkg with all three packages', async () => {
    const ownerKp = await generateKeypair();
    const agentKp = await generateKeypair();

    const result = await marsbotToOpkg(sampleMarsbot, ownerKp, agentKp);

    // Should produce agent, memory, and bundle
    expect(result.agent).toBeDefined();
    expect(result.memory).toBeDefined();
    expect(result.bundle).toBeDefined();

    // Agent package
    expect(result.agent.content_type).toBe('agent');
    expect((result.agent.content as any).profile.name).toBe('Atlas');
    expect((result.agent.content as any).agent_did).toMatch(/^did:key:z6Mk/);
    expect((result.agent.content as any).owner_did).toMatch(/^did:key:z6Mk/);

    // Memory package
    expect(result.memory!.content_type).toBe('memory');
    expect((result.memory!.content as any).format).toBe('mixed');
    expect((result.memory!.content as any).reflections).toHaveLength(1);
    expect((result.memory!.content as any).entries).toHaveLength(2);

    // Bundle package
    expect(result.bundle.content_type).toBe('bundle');
    expect((result.bundle.content as any).packages).toHaveLength(2);

    // All packages should verify
    for (const pkg of [result.agent, result.memory!, result.bundle]) {
      const v = await verifyPackage(pkg);
      expect(v.valid).toBe(true);
    }
  });

  it('round-trips .marsbot → .opkg → .marsbot preserving core fields', async () => {
    const ownerKp = await generateKeypair();
    const agentKp = await generateKeypair();

    const opkg = await marsbotToOpkg(sampleMarsbot, ownerKp, agentKp);
    const roundTripped = opkgToMarsbot(opkg.agent, opkg.memory);

    // Version and basic structure
    expect(roundTripped.version).toBe(1);

    // Agent identity
    expect(roundTripped.agent.identity.name).toBe(sampleMarsbot.agent.identity.name);
    expect(roundTripped.agent.identity.color).toBe(sampleMarsbot.agent.identity.color);
    expect(roundTripped.agent.identity.expressiveState).toBe(sampleMarsbot.agent.identity.expressiveState);

    // Personality
    expect(roundTripped.agent.personality.verbosity).toBe(sampleMarsbot.agent.personality.verbosity);
    expect(roundTripped.agent.personality.formality).toBe(sampleMarsbot.agent.personality.formality);
    expect(roundTripped.agent.personality.tone).toBe(sampleMarsbot.agent.personality.tone);
    expect(roundTripped.agent.personality.vibeWords).toEqual(sampleMarsbot.agent.personality.vibeWords);
    expect(roundTripped.agent.personality.roleModel).toBe(sampleMarsbot.agent.personality.roleModel);

    // Origin
    expect(roundTripped.agent.origin.trigger).toBe(sampleMarsbot.agent.origin.trigger);
    expect(roundTripped.agent.origin.need).toBe(sampleMarsbot.agent.origin.need);
    expect(roundTripped.agent.origin.bornAt).toBe(sampleMarsbot.agent.origin.bornAt);

    // Model
    expect(roundTripped.agent.model.provider).toBe(sampleMarsbot.agent.model.provider);
    expect(roundTripped.agent.model.model).toBe(sampleMarsbot.agent.model.model);
    expect(roundTripped.agent.model.temperature).toBe(sampleMarsbot.agent.model.temperature);
    expect(roundTripped.agent.model.maxTokens).toBe(sampleMarsbot.agent.model.maxTokens);

    // Guardrails
    expect(roundTripped.agent.guardrails.blockedTopics).toEqual(sampleMarsbot.agent.guardrails.blockedTopics);
    expect(roundTripped.agent.guardrails.requireApprovalFor).toEqual(sampleMarsbot.agent.guardrails.requireApprovalFor);
    expect(roundTripped.agent.guardrails.maxTokensPerTurn).toBe(sampleMarsbot.agent.guardrails.maxTokensPerTurn);

    // System prompt
    expect(roundTripped.agent.systemPromptAdditions).toEqual(sampleMarsbot.agent.systemPromptAdditions);

    // Memory
    expect(roundTripped.memory).toBeDefined();
    expect(roundTripped.memory!.reflections).toHaveLength(1);
    expect(roundTripped.memory!.reflections[0].content).toBe('User prefers concise answers');
    expect(roundTripped.memory!.reflections[0].confidence).toBe(0.9);
    expect(roundTripped.memory!.keyValueStore.favorite_language).toBe('TypeScript');
    expect(roundTripped.memory!.keyValueStore.timezone).toBe('America/New_York');

    // Skills
    expect(roundTripped.skills).toEqual(sampleMarsbot.skills);
  });

  it('handles .marsbot without memory', async () => {
    const noMemory: MarsbotExport = {
      ...sampleMarsbot,
      memory: undefined,
    };
    const ownerKp = await generateKeypair();
    const agentKp = await generateKeypair();

    const result = await marsbotToOpkg(noMemory, ownerKp, agentKp);
    expect(result.memory).toBeUndefined();
    expect((result.agent.content as any).memory_refs).toEqual([]);

    const roundTripped = opkgToMarsbot(result.agent);
    expect(roundTripped.memory).toBeUndefined();
  });
});
