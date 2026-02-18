/**
 * @open-people/verify
 *
 * Sign .opkg packages with Ed25519 and verify signatures.
 * Handles content hash verification and signature validation.
 *
 * See docs/spec/02-data-package.md (Signing section) for the spec.
 */

import * as ed25519 from '@noble/ed25519';
import { didToPublicKey } from '@open-people/identity';
import { canonicalize, contentHash } from '@open-people/package';
import type { PackageEnvelope } from '@open-people/package';

// ---- Types ----

export interface SignResult {
  signature: string;
  content_hash: string;
}

export interface VerifyResult {
  valid: boolean;
  integrity: boolean;
  authenticity: boolean;
  error?: string;
}

// ---- Functions ----

/**
 * Sign package content with an Ed25519 private key.
 *
 * 1. Canonicalize the content (sorted keys, NFC, no whitespace)
 * 2. Compute SHA-256 content hash
 * 3. Sign the content hash with Ed25519
 * 4. Return the hex-encoded signature and content hash
 */
export async function signPackage(
  content: Record<string, unknown>,
  privateKey: Uint8Array,
): Promise<SignResult> {
  const hash = contentHash(content);
  const hashBytes = new TextEncoder().encode(hash);
  const signatureBytes = await ed25519.signAsync(hashBytes, privateKey);
  return {
    signature: bytesToHex(signatureBytes),
    content_hash: hash,
  };
}

/**
 * Verify a package's integrity and authenticity.
 *
 * Integrity: recompute content hash and compare to pkg.content_hash.
 * Authenticity: decode DID to public key, verify Ed25519 signature on content hash.
 *
 * Returns { valid, integrity, authenticity, error? }.
 */
export async function verifyPackage(pkg: PackageEnvelope): Promise<VerifyResult> {
  // Step 1: Integrity — recompute content hash
  let integrity = false;
  try {
    const computedHash = contentHash(pkg.content);
    integrity = computedHash === pkg.content_hash;
  } catch {
    return {
      valid: false,
      integrity: false,
      authenticity: false,
      error: 'Failed to compute content hash',
    };
  }

  if (!integrity) {
    return {
      valid: false,
      integrity: false,
      authenticity: false,
      error: `Content hash mismatch: content does not match content_hash`,
    };
  }

  // Step 2: Authenticity — verify Ed25519 signature
  let authenticity = false;
  try {
    const publicKey = didToPublicKey(pkg.author.did);
    const signatureBytes = hexToBytes(pkg.author.signature);
    const hashBytes = new TextEncoder().encode(pkg.content_hash);
    authenticity = await ed25519.verifyAsync(signatureBytes, hashBytes, publicKey);
  } catch (err) {
    return {
      valid: false,
      integrity: true,
      authenticity: false,
      error: `Signature verification failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    };
  }

  if (!authenticity) {
    return {
      valid: false,
      integrity: true,
      authenticity: false,
      error: 'Invalid signature: content hash was not signed by the claimed author',
    };
  }

  return {
    valid: true,
    integrity: true,
    authenticity: true,
  };
}

// ---- Helpers ----

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
