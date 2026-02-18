/**
 * @open-people/migrate
 *
 * Convert between .marsbot v1 and .opkg formats.
 * See docs/reference/marsbot-mapping.md for the field-by-field mapping.
 */

import type { Keypair } from '@open-people/identity';
import { publicKeyToDID } from '@open-people/identity';
import {
  createPackage,
  contentHash,
  type PackageEnvelope,
  type ContentType,
} from '@open-people/package';
import { signPackage } from '@open-people/verify';

// ---- Types ----

export interface MarsbotExport {
  version: 1;
  exportedAt: string;
  agent: {
    identity: { name: string; color: string; expressiveState: string };
    personality: {
      verbosity: number;
      formality: number;
      carefulness: number;
      curiosity: number;
      tone: string;
      vibeWords: string[];
      roleModel?: string;
    };
    origin: { trigger: string; need: string; bornAt: string };
    model: { provider: string; model: string; temperature: number; maxTokens: number };
    systemPromptAdditions: string[];
    guardrails: {
      blockedTopics: string[];
      requireApprovalFor: string[];
      maxTokensPerTurn: number;
    };
  };
  memory?: {
    reflections: Array<{ content: string; confidence: number; source: string; createdAt: string }>;
    keyValueStore: Record<string, unknown>;
  };
  skills?: string[];
}

export interface MigrateResult {
  agent: PackageEnvelope;
  memory?: PackageEnvelope;
  bundle: PackageEnvelope;
}

// ---- Functions ----

/**
 * Convert a .marsbot v1 export to .opkg format.
 *
 * Produces up to 3 packages:
 * - Agent package (always)
 * - Memory package (if marsbot.memory exists)
 * - Bundle package (references both)
 *
 * All packages are signed with the ownerKeypair.
 * The agent gets its own DID from agentKeypair.
 */
export async function marsbotToOpkg(
  marsbot: MarsbotExport,
  ownerKeypair: Keypair,
  agentKeypair: Keypair,
): Promise<MigrateResult> {
  const ownerDid = publicKeyToDID(ownerKeypair.publicKey);
  const agentDid = publicKeyToDID(agentKeypair.publicKey);

  let memoryPkg: PackageEnvelope | undefined;

  // 1. Create memory package (if memory exists)
  if (marsbot.memory) {
    const memFormat = determineMemoryFormat(marsbot.memory);
    const memoryContent: Record<string, unknown> = {
      owner_did: agentDid,
      format: memFormat,
    };

    // Flatten keyValueStore to entries array
    if (marsbot.memory.keyValueStore && Object.keys(marsbot.memory.keyValueStore).length > 0) {
      memoryContent.entries = Object.entries(marsbot.memory.keyValueStore).map(
        ([key, value]) => ({
          key,
          value,
          recorded_at: marsbot.exportedAt,
        }),
      );
    }

    // Map reflections with field renames
    if (marsbot.memory.reflections && marsbot.memory.reflections.length > 0) {
      memoryContent.reflections = marsbot.memory.reflections.map((r) => ({
        content: r.content,
        confidence: r.confidence,
        source: r.source,
        reflected_at: r.createdAt,
      }));
    }

    const memSign = await signPackage(memoryContent, ownerKeypair.privateKey);
    memoryPkg = createPackage({
      contentType: 'memory',
      content: memoryContent,
      authorDid: ownerDid,
      signature: memSign.signature,
    });
  }

  // 2. Create agent package
  const agentContent: Record<string, unknown> = {
    agent_did: agentDid,
    owner_did: ownerDid,
    version: 1,
    profile: {
      name: marsbot.agent.identity.name,
      capabilities: marsbot.skills ?? [],
      origin: {
        trigger: marsbot.agent.origin.trigger,
        description: marsbot.agent.origin.need,
        born_at: marsbot.agent.origin.bornAt,
      },
      memory_format: 'open_people_v1',
    },
    model_preferences: {
      preferred_provider: marsbot.agent.model.provider,
      preferred_model: marsbot.agent.model.model,
      temperature: marsbot.agent.model.temperature,
      max_tokens: marsbot.agent.model.maxTokens,
    },
    system_prompt_additions: marsbot.agent.systemPromptAdditions,
    memory_refs: memoryPkg
      ? [{ package_id: memoryPkg.package_id, content_hash: memoryPkg.content_hash }]
      : [],
    extensions: {
      'mars-hq': {
        personality: {
          verbosity: marsbot.agent.personality.verbosity,
          formality: marsbot.agent.personality.formality,
          carefulness: marsbot.agent.personality.carefulness,
          curiosity: marsbot.agent.personality.curiosity,
          tone: marsbot.agent.personality.tone,
          vibe_words: marsbot.agent.personality.vibeWords,
          ...(marsbot.agent.personality.roleModel !== undefined
            ? { role_model: marsbot.agent.personality.roleModel }
            : {}),
        },
        guardrails: {
          blocked_topics: marsbot.agent.guardrails.blockedTopics,
          require_approval_for: marsbot.agent.guardrails.requireApprovalFor,
          max_tokens_per_turn: marsbot.agent.guardrails.maxTokensPerTurn,
        },
        identity: {
          color: marsbot.agent.identity.color,
          expressive_state: marsbot.agent.identity.expressiveState,
        },
      },
    },
  };

  const agentSign = await signPackage(agentContent, ownerKeypair.privateKey);
  const agentPkg = createPackage({
    contentType: 'agent',
    content: agentContent,
    authorDid: ownerDid,
    signature: agentSign.signature,
  });

  // 3. Create bundle
  const bundlePackages: Array<{ package_id: string; content_hash: string; content_type: ContentType }> = [];
  bundlePackages.push({
    package_id: agentPkg.package_id,
    content_hash: agentPkg.content_hash,
    content_type: 'agent',
  });
  if (memoryPkg) {
    bundlePackages.push({
      package_id: memoryPkg.package_id,
      content_hash: memoryPkg.content_hash,
      content_type: 'memory',
    });
  }

  const bundleContent: Record<string, unknown> = {
    name: `${marsbot.agent.identity.name} Export`,
    packages: bundlePackages,
  };

  const bundleSign = await signPackage(bundleContent, ownerKeypair.privateKey);
  const bundlePkg = createPackage({
    contentType: 'bundle',
    content: bundleContent,
    authorDid: ownerDid,
    signature: bundleSign.signature,
  });

  return {
    agent: agentPkg,
    ...(memoryPkg ? { memory: memoryPkg } : {}),
    bundle: bundlePkg,
  };
}

/**
 * Convert .opkg agent (and optional memory) packages back to .marsbot v1 format.
 *
 * This is a lossy conversion — fields unique to .opkg (DIDs, signatures,
 * content addressing) are dropped since .marsbot has no equivalent.
 */
export function opkgToMarsbot(
  agentPkg: PackageEnvelope,
  memoryPkg?: PackageEnvelope,
): MarsbotExport {
  const c = agentPkg.content as Record<string, unknown>;
  const profile = c.profile as Record<string, unknown>;
  const origin = profile.origin as Record<string, unknown>;
  const modelPrefs = c.model_preferences as Record<string, unknown>;
  const extensions = c.extensions as Record<string, unknown> | undefined;
  const marsHq = extensions?.['mars-hq'] as Record<string, unknown> | undefined;
  const personality = marsHq?.personality as Record<string, unknown> | undefined;
  const guardrails = marsHq?.guardrails as Record<string, unknown> | undefined;
  const identity = marsHq?.identity as Record<string, unknown> | undefined;

  const result: MarsbotExport = {
    version: 1,
    exportedAt: agentPkg.created_at,
    agent: {
      identity: {
        name: profile.name as string,
        color: (identity?.color as string) ?? '#000000',
        expressiveState: (identity?.expressive_state as string) ?? 'idle',
      },
      personality: {
        verbosity: (personality?.verbosity as number) ?? 0,
        formality: (personality?.formality as number) ?? 0,
        carefulness: (personality?.carefulness as number) ?? 0,
        curiosity: (personality?.curiosity as number) ?? 0,
        tone: (personality?.tone as string) ?? 'neutral',
        vibeWords: (personality?.vibe_words as string[]) ?? [],
        ...(personality?.role_model !== undefined
          ? { roleModel: personality.role_model as string }
          : {}),
      },
      origin: {
        trigger: origin.trigger as string,
        need: origin.description as string,
        bornAt: origin.born_at as string,
      },
      model: {
        provider: modelPrefs.preferred_provider as string,
        model: modelPrefs.preferred_model as string,
        temperature: modelPrefs.temperature as number,
        maxTokens: modelPrefs.max_tokens as number,
      },
      systemPromptAdditions: (c.system_prompt_additions as string[]) ?? [],
      guardrails: {
        blockedTopics: (guardrails?.blocked_topics as string[]) ?? [],
        requireApprovalFor: (guardrails?.require_approval_for as string[]) ?? [],
        maxTokensPerTurn: (guardrails?.max_tokens_per_turn as number) ?? 4096,
      },
    },
  };

  // Reconstruct memory from memory package
  if (memoryPkg) {
    const mc = memoryPkg.content as Record<string, unknown>;
    const memory: MarsbotExport['memory'] = {
      reflections: [],
      keyValueStore: {},
    };

    // Map reflections back
    const reflections = mc.reflections as Array<Record<string, unknown>> | undefined;
    if (reflections) {
      memory.reflections = reflections.map((r) => ({
        content: r.content as string,
        confidence: r.confidence as number,
        source: r.source as string,
        createdAt: r.reflected_at as string,
      }));
    }

    // Reconstruct keyValueStore from entries
    const entries = mc.entries as Array<{ key: string; value: unknown }> | undefined;
    if (entries) {
      for (const entry of entries) {
        memory.keyValueStore[entry.key] = entry.value;
      }
    }

    result.memory = memory;
  }

  // Map capabilities back to skills
  const capabilities = profile.capabilities as string[] | undefined;
  if (capabilities && capabilities.length > 0) {
    result.skills = capabilities;
  }

  return result;
}

// ---- Helpers ----

function determineMemoryFormat(memory: NonNullable<MarsbotExport['memory']>): string {
  const hasReflections = memory.reflections && memory.reflections.length > 0;
  const hasKV = memory.keyValueStore && Object.keys(memory.keyValueStore).length > 0;
  if (hasReflections && hasKV) return 'mixed';
  if (hasReflections) return 'reflections';
  if (hasKV) return 'key_value';
  return 'empty';
}
