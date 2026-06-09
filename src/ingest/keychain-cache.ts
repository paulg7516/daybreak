// src/ingest/keychain-cache.ts
import keytar from 'keytar';
import type { ICachePlugin, TokenCacheContext } from '@azure/msal-node';

const SERVICE = 'Daybreak';
const ACCOUNT = 'msal-token-cache';

// Persists the MSAL token cache in the OS keychain. The cache contains refresh
// tokens, so keychain (not a plaintext file) is the correct home for it.
export const keychainCachePlugin: ICachePlugin = {
  async beforeCacheAccess(context: TokenCacheContext): Promise<void> {
    const cached = await keytar.getPassword(SERVICE, ACCOUNT);
    if (cached) {
      context.tokenCache.deserialize(cached);
    }
  },
  async afterCacheAccess(context: TokenCacheContext): Promise<void> {
    if (context.cacheHasChanged) {
      await keytar.setPassword(SERVICE, ACCOUNT, context.tokenCache.serialize());
    }
  },
};

// Used by `daybreak logout` style flows and tests to clear the persisted cache.
export async function clearTokenCache(): Promise<void> {
  await keytar.deletePassword(SERVICE, ACCOUNT);
}
