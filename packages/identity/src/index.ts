/**
 * @open-people/identity
 *
 * Ed25519 keypair generation, DID encoding/decoding, and DID Document management.
 * Uses the Noble crypto stack (pure TypeScript, audited, isomorphic).
 *
 * See docs/spec/01-identity.md for the spec.
 */

import * as ed25519 from '@noble/ed25519';
import { base58 } from '@scure/base';

// ---- Types ----

export interface Keypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface DIDDocument {
  id: string;
  public_key: string;
  created_at: string;
  display_name?: string;
  color?: string;
  avatar_hash?: string;
  bio?: string;
  urls?: string[];
  rotation?: {
    next_key_hash?: string;
    rotated_at?: string;
    previous_did?: string;
  };
  revocation?: {
    revoked: boolean;
    revoked_at?: string;
    reason?: string;
  };
  extensions?: Record<string, unknown>;
}

// ---- Multicodec prefix for Ed25519 public keys ----
// 0xed = ed25519-pub codec, 0x01 = varint length of codec
const ED25519_MULTICODEC_PREFIX = new Uint8Array([0xed, 0x01]);

// ---- Functions ----

/**
 * Generate an Ed25519 keypair using a CSPRNG.
 * Returns 32-byte private key and 32-byte public key.
 */
export async function generateKeypair(): Promise<Keypair> {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await ed25519.getPublicKeyAsync(privateKey);
  return { publicKey, privateKey };
}

/**
 * Encode a 32-byte Ed25519 public key as a did:key: DID string.
 *
 * Format: "did:key:z" + base58btc(multicodec_prefix + public_key)
 * The multicodec prefix for Ed25519 is [0xed, 0x01].
 */
export function publicKeyToDID(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) {
    throw new Error(`Expected 32-byte public key, got ${publicKey.length} bytes`);
  }
  const prefixed = new Uint8Array(ED25519_MULTICODEC_PREFIX.length + publicKey.length);
  prefixed.set(ED25519_MULTICODEC_PREFIX);
  prefixed.set(publicKey, ED25519_MULTICODEC_PREFIX.length);
  const encoded = base58.encode(prefixed);
  return `did:key:z${encoded}`;
}

/**
 * Decode a did:key: DID string back to a 32-byte Ed25519 public key.
 *
 * Strips the "did:key:z" prefix, decodes base58btc, strips the
 * 2-byte multicodec prefix, and returns the raw 32-byte key.
 */
export function didToPublicKey(did: string): Uint8Array {
  if (!did.startsWith('did:key:z')) {
    throw new Error(`Invalid did:key format: must start with "did:key:z", got "${did.substring(0, 20)}"`);
  }
  const encoded = did.slice('did:key:z'.length);
  const decoded = base58.decode(encoded);
  if (decoded.length !== 34) {
    throw new Error(`Invalid did:key: expected 34 bytes after decode, got ${decoded.length}`);
  }
  if (decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error('Invalid multicodec prefix: expected Ed25519 (0xed01)');
  }
  return decoded.slice(2);
}

/**
 * Create a DID Document from a keypair with optional metadata.
 *
 * The DID is derived from the public key. The document includes
 * the hex-encoded public key, creation timestamp, and any
 * additional metadata fields provided.
 */
export function createDIDDocument(
  keypair: Keypair,
  metadata?: Partial<Omit<DIDDocument, 'id' | 'public_key' | 'created_at'>>,
): DIDDocument {
  const id = publicKeyToDID(keypair.publicKey);
  const publicKeyHex = bytesToHex(keypair.publicKey);

  const doc: DIDDocument = {
    id,
    public_key: publicKeyHex,
    created_at: new Date().toISOString(),
  };

  if (metadata) {
    if (metadata.display_name !== undefined) doc.display_name = metadata.display_name;
    if (metadata.color !== undefined) doc.color = metadata.color;
    if (metadata.avatar_hash !== undefined) doc.avatar_hash = metadata.avatar_hash;
    if (metadata.bio !== undefined) doc.bio = metadata.bio;
    if (metadata.urls !== undefined) doc.urls = metadata.urls;
    if (metadata.rotation !== undefined) doc.rotation = metadata.rotation;
    if (metadata.revocation !== undefined) doc.revocation = metadata.revocation;
    if (metadata.extensions !== undefined) doc.extensions = metadata.extensions;
  }

  return doc;
}

// ---- Helpers ----

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}
