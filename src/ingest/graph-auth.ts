// src/ingest/graph-auth.ts
import { PublicClientApplication } from '@azure/msal-node';
import { keychainCachePlugin } from './keychain-cache';

const SCOPES = ['Mail.Read', 'User.Read'];

function clientId(): string {
  const id = process.env.DAYBREAK_CLIENT_ID;
  if (!id) throw new Error('DAYBREAK_CLIENT_ID is not set. See the plan Prerequisites.');
  return id;
}

function tenantId(): string {
  const id = process.env.DAYBREAK_TENANT_ID;
  if (!id) throw new Error('DAYBREAK_TENANT_ID is not set. See the plan Prerequisites.');
  return id;
}

let pca: PublicClientApplication | undefined;
function app(): PublicClientApplication {
  if (!pca) {
    pca = new PublicClientApplication({
      auth: {
        clientId: clientId(),
        authority: `https://login.microsoftonline.com/${tenantId()}`,
      },
      cache: { cachePlugin: keychainCachePlugin },
    });
  }
  return pca;
}

export async function getAccessToken(): Promise<string> {
  const pcaApp = app();

  const accounts = await pcaApp.getTokenCache().getAllAccounts();
  if (accounts.length > 0) {
    try {
      // Use the first cached account. v1 is single-tenant, single-account.
      const silent = await pcaApp.acquireTokenSilent({ account: accounts[0], scopes: SCOPES });
      if (silent?.accessToken) return silent.accessToken;
    } catch (err) {
      // An expired token here is expected and falls through to the device-code
      // flow. Surface other failures (bad client/tenant, network) under a debug
      // flag so a first-run config problem is not masked by the device prompt.
      if (process.env.DAYBREAK_DEBUG) {
        console.error('[debug] silent token acquisition failed:', err instanceof Error ? err.message : err);
      }
    }
  }

  const result = await pcaApp.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (info) => {
      // info.message instructs the user to visit a URL and enter the code.
      console.log(info.message);
    },
  });
  if (!result?.accessToken) {
    throw new Error('Device-code authentication did not return an access token.');
  }
  return result.accessToken;
}

export interface SignedInUser {
  address: string; // mail, or userPrincipalName as fallback
}

export async function getSignedInUser(token: string): Promise<SignedInUser> {
  const resp = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`Graph /me ${resp.status}: ${await resp.text()}`);
  }
  const me = (await resp.json()) as { mail?: string; userPrincipalName?: string };
  const address = me.mail ?? me.userPrincipalName;
  if (!address) {
    throw new Error('Could not determine the signed-in user address from Graph /me.');
  }
  return { address };
}
