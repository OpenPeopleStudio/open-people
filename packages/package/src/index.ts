/**
 * @open-people/package
 *
 * Build, parse, and validate .opkg data packages.
 * Handles canonical JSON serialization, content hashing, and envelope construction.
 *
 * See docs/spec/02-data-package.md for the spec.
 */

import { sha256 } from '@noble/hashes/sha256';

// ---- Types ----

export type ContentType = 'identity' | 'agent' | 'memory' | 'workspace' | 'credential' | 'context' | 'bundle';
export type TransmissionClass = 'local' | 'network' | 'interplanetary';
export type Compression = 'none' | 'gzip' | 'zstd';

export interface PackageEnvelope {
  open_people: 1;
  package_id: string;
  created_at: string;
  author: {
    did: string;
    signature: string;
  };
  content_hash: string;
  content_type: ContentType;
  content: Record<string, unknown>;
  metadata: {
    schema_version: string;
    transmission_class: TransmissionClass;
    compression: Compression;
  };
}

export interface CreatePackageOptions {
  contentType: ContentType;
  content: Record<string, unknown>;
  authorDid: string;
  signature: string;
  schemaVersion?: string;
  transmissionClass?: TransmissionClass;
  compression?: Compression;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ---- Constants ----

const VALID_CONTENT_TYPES: ReadonlySet<string> = new Set([
  'identity', 'agent', 'memory', 'workspace', 'credential', 'context', 'bundle',
]);

const DID_PATTERN = /^did:key:z[1-9A-HJ-NP-Za-km-z]+$/;
const HEX_PATTERN = /^[0-9a-f]+$/;

// ---- Functions ----

/**
 * Canonical JSON serialization per the open_people spec.
 *
 * Rules:
 * - Keys sorted lexicographically by Unicode code point at every level
 * - No whitespace between tokens
 * - -0 normalized to 0
 * - String values normalized to Unicode NFC
 */
export function canonicalize(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}

/**
 * Compute the SHA-256 content hash of an object.
 *
 * Produces canonical JSON, encodes to UTF-8, hashes with SHA-256,
 * and returns the hex-encoded digest (64 characters).
 */
export function contentHash(content: Record<string, unknown>): string {
  const canonical = canonicalize(content);
  const bytes = new TextEncoder().encode(canonical);
  const hash = sha256(bytes);
  return bytesToHex(hash);
}

/**
 * Generate a UUIDv7 package ID.
 *
 * UUIDv7 format: 48-bit millisecond timestamp + version nibble (7) +
 * 12 random bits + variant bits (10) + 62 random bits.
 */
export function generatePackageId(): string {
  const now = Date.now();

  // 48-bit timestamp
  const timeHigh = Math.floor(now / 2 ** 16);
  const timeLow = now & 0xffff;

  // Random bytes for the rest
  const random = new Uint8Array(10);
  crypto.getRandomValues(random);

  // Build UUID hex string
  // Bytes 0-3: timestamp high 32 bits
  const b0 = (timeHigh >> 16) & 0xffff;
  const b1 = timeHigh & 0xffff;
  // Bytes 4-5: timestamp low 16 bits
  const b2 = timeLow;
  // Byte 6-7: version (0111) + 12 random bits
  const b3 = (0x7000) | (random[0] << 4 | random[1] >> 4) & 0x0fff;
  // Byte 8-9: variant (10) + 14 random bits
  const b4 = (0x8000) | ((random[1] & 0x0f) << 10 | random[2] << 2 | random[3] >> 6) & 0x3fff;
  // Bytes 10-15: 48 random bits
  const b5 = (random[3] & 0x3f) << 10 | random[4] << 2 | random[5] >> 6;
  const b6 = (random[5] & 0x3f) << 10 | random[6] << 2 | random[7] >> 6;
  const b7 = (random[7] & 0x3f) << 2 | random[8] >> 6;

  const hex = [
    b0.toString(16).padStart(4, '0'),
    b1.toString(16).padStart(4, '0'),
    '-',
    b2.toString(16).padStart(4, '0'),
    '-',
    b3.toString(16).padStart(4, '0'),
    '-',
    b4.toString(16).padStart(4, '0'),
    '-',
    random[4].toString(16).padStart(2, '0'),
    random[5].toString(16).padStart(2, '0'),
    random[6].toString(16).padStart(2, '0'),
    random[7].toString(16).padStart(2, '0'),
    random[8].toString(16).padStart(2, '0'),
    random[9].toString(16).padStart(2, '0'),
  ];

  return hex.join('');
}

/**
 * Create a complete .opkg package envelope.
 */
export function createPackage(opts: CreatePackageOptions): PackageEnvelope {
  const hash = contentHash(opts.content);

  return {
    open_people: 1,
    package_id: generatePackageId(),
    created_at: new Date().toISOString(),
    author: {
      did: opts.authorDid,
      signature: opts.signature,
    },
    content_hash: hash,
    content_type: opts.contentType,
    content: opts.content,
    metadata: {
      schema_version: opts.schemaVersion ?? '1.0.0',
      transmission_class: opts.transmissionClass ?? 'local',
      compression: opts.compression ?? 'none',
    },
  };
}

/**
 * Parse a JSON string into a PackageEnvelope.
 * Throws on invalid JSON or missing required fields.
 */
export function parsePackage(json: string): PackageEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON: failed to parse package');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid package: expected a JSON object');
  }

  const obj = parsed as Record<string, unknown>;

  // Check required top-level fields
  const required = ['open_people', 'package_id', 'created_at', 'author', 'content_hash', 'content_type', 'content', 'metadata'];
  for (const field of required) {
    if (!(field in obj)) {
      throw new Error(`Invalid package: missing required field "${field}"`);
    }
  }

  if (obj.open_people !== 1) {
    throw new Error(`Invalid package: "open_people" must be 1, got ${obj.open_people}`);
  }

  if (typeof obj.package_id !== 'string') {
    throw new Error('Invalid package: "package_id" must be a string');
  }

  if (typeof obj.created_at !== 'string') {
    throw new Error('Invalid package: "created_at" must be a string');
  }

  if (typeof obj.content_hash !== 'string') {
    throw new Error('Invalid package: "content_hash" must be a string');
  }

  if (typeof obj.content_type !== 'string') {
    throw new Error('Invalid package: "content_type" must be a string');
  }

  if (typeof obj.content !== 'object' || obj.content === null || Array.isArray(obj.content)) {
    throw new Error('Invalid package: "content" must be a JSON object');
  }

  // Check author structure
  const author = obj.author as Record<string, unknown>;
  if (typeof author !== 'object' || author === null) {
    throw new Error('Invalid package: "author" must be an object');
  }
  if (typeof author.did !== 'string' || typeof author.signature !== 'string') {
    throw new Error('Invalid package: "author" must have "did" (string) and "signature" (string)');
  }

  // Check metadata structure
  const meta = obj.metadata as Record<string, unknown>;
  if (typeof meta !== 'object' || meta === null) {
    throw new Error('Invalid package: "metadata" must be an object');
  }

  return obj as unknown as PackageEnvelope;
}

/**
 * Validate a PackageEnvelope for correctness.
 * Checks field formats, content type enum, DID pattern, hex patterns,
 * and verifies the content hash matches a recomputed hash.
 */
export function validatePackage(pkg: PackageEnvelope): ValidationResult {
  const errors: string[] = [];

  // open_people version
  if (pkg.open_people !== 1) {
    errors.push(`"open_people" must be 1, got ${pkg.open_people}`);
  }

  // package_id format (UUID-like)
  if (typeof pkg.package_id !== 'string' || pkg.package_id.length === 0) {
    errors.push('"package_id" must be a non-empty string');
  }

  // created_at (ISO 8601)
  if (typeof pkg.created_at !== 'string' || isNaN(Date.parse(pkg.created_at))) {
    errors.push('"created_at" must be a valid ISO 8601 date string');
  }

  // author.did
  if (!DID_PATTERN.test(pkg.author?.did ?? '')) {
    errors.push('"author.did" must match did:key:z... pattern');
  }

  // author.signature (hex)
  if (typeof pkg.author?.signature !== 'string' || !HEX_PATTERN.test(pkg.author.signature)) {
    errors.push('"author.signature" must be a hex string');
  }

  // content_type enum
  if (!VALID_CONTENT_TYPES.has(pkg.content_type)) {
    errors.push(`"content_type" must be one of: ${[...VALID_CONTENT_TYPES].join(', ')}; got "${pkg.content_type}"`);
  }

  // content_hash format (64-char hex = SHA-256)
  if (typeof pkg.content_hash !== 'string' || pkg.content_hash.length !== 64 || !HEX_PATTERN.test(pkg.content_hash)) {
    errors.push('"content_hash" must be a 64-character hex string (SHA-256)');
  }

  // content_hash integrity check
  if (pkg.content && typeof pkg.content === 'object') {
    const computed = contentHash(pkg.content);
    if (pkg.content_hash !== computed) {
      errors.push(`content_hash mismatch: expected ${computed}, got ${pkg.content_hash}`);
    }
  }

  // metadata
  if (pkg.metadata) {
    if (typeof pkg.metadata.schema_version !== 'string') {
      errors.push('"metadata.schema_version" must be a string');
    }
    const validTransmission = new Set(['local', 'network', 'interplanetary']);
    if (!validTransmission.has(pkg.metadata.transmission_class)) {
      errors.push(`"metadata.transmission_class" must be one of: local, network, interplanetary`);
    }
    const validCompression = new Set(['none', 'gzip', 'zstd']);
    if (!validCompression.has(pkg.metadata.compression)) {
      errors.push(`"metadata.compression" must be one of: none, gzip, zstd`);
    }
  } else {
    errors.push('"metadata" is required');
  }

  return { valid: errors.length === 0, errors };
}

// ---- Internal helpers ----

/**
 * Recursively sort object keys lexicographically by Unicode code point.
 * Normalizes -0 to 0 and string values to NFC.
 */
function sortKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'number') {
    // Normalize -0 to 0
    return Object.is(obj, -0) ? 0 : obj;
  }

  if (typeof obj === 'string') {
    // Unicode NFC normalization
    return obj.normalize('NFC');
  }

  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }

  if (typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return obj;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}
