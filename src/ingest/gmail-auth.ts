// src/ingest/gmail-auth.ts
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { OAuth2Client } from 'google-auth-library';
import keytar from 'keytar';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const SERVICE = 'Daybreak';
const ACCOUNT = 'gmail-refresh-token'; // sibling of the MSAL cache in keychain-cache.ts

// Credentials come from the environment in dev (DAYBREAK_GOOGLE_CLIENT_ID), or
// from values baked into the bundle at build time (..._BAKED) so a packaged app a
// tester launches from Finder works with no env set. The env var always wins, so a
// dev or tester can override the baked default. esbuild replaces the _BAKED reads
// with string literals at build time (see scripts/build-main.mjs); under tsx and
// vitest they are ordinary env lookups that resolve to undefined.
export function clientId(): string {
  const id = process.env.DAYBREAK_GOOGLE_CLIENT_ID || process.env.DAYBREAK_GOOGLE_CLIENT_ID_BAKED;
  if (!id) throw new Error('DAYBREAK_GOOGLE_CLIENT_ID is not set. See the plan Prerequisites.');
  return id;
}

export function clientSecret(): string {
  const secret = process.env.DAYBREAK_GOOGLE_CLIENT_SECRET || process.env.DAYBREAK_GOOGLE_CLIENT_SECRET_BAKED;
  if (!secret) throw new Error('DAYBREAK_GOOGLE_CLIENT_SECRET is not set. See the plan Prerequisites.');
  return secret;
}

// Resolve an access token. Prefer a cached refresh token (silent); otherwise run
// the interactive loopback consent flow once and persist the refresh token.
export async function getAccessToken(
  onAuthPrompt?: (info: { url: string }) => void,
): Promise<string> {
  const refresh = await keytar.getPassword(SERVICE, ACCOUNT);
  if (refresh) {
    try {
      const silent = new OAuth2Client({ clientId: clientId(), clientSecret: clientSecret() });
      silent.setCredentials({ refresh_token: refresh });
      const { token } = await silent.getAccessToken();
      if (token) return token;
    } catch (err) {
      // An expired/revoked refresh token falls through to interactive sign-in.
      // Surface other failures under a debug flag so a config problem is not
      // masked by the consent prompt.
      if (process.env.DAYBREAK_DEBUG) {
        console.error('[debug] Gmail silent token refresh failed:', err instanceof Error ? err.message : err);
      }
    }
  }
  return interactiveSignIn(onAuthPrompt);
}

// Loopback flow: spin up a localhost server on an ephemeral port (allowed for
// Desktop OAuth clients without pre-registering a redirect URL), open the consent
// URL, capture the authorization code on redirect, exchange it for tokens, and
// persist the refresh token to the keychain.
async function interactiveSignIn(onAuthPrompt?: (info: { url: string }) => void): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', async () => {
      try {
        const port = (server.address() as AddressInfo).port;
        const redirectUri = `http://127.0.0.1:${port}`;
        const client = new OAuth2Client({ clientId: clientId(), clientSecret: clientSecret(), redirectUri });
        const authUrl = client.generateAuthUrl({
          access_type: 'offline',
          prompt: 'consent', // force a refresh_token on every fresh sign-in
          scope: SCOPES,
        });

        server.on('request', async (req, res) => {
          try {
            const code = new URL(req.url ?? '', redirectUri).searchParams.get('code');
            if (!code) {
              res.writeHead(400).end('Daybreak: no authorization code received.');
              return;
            }
            const { tokens } = await client.getToken(code);
            if (tokens.refresh_token) {
              await keytar.setPassword(SERVICE, ACCOUNT, tokens.refresh_token);
            }
            res.writeHead(200, { 'Content-Type': 'text/html' }).end(
              '<html><body style="font-family:system-ui;padding:3rem;text-align:center">' +
                '<h2>Daybreak is connected to Gmail.</h2><p>You can close this tab.</p></body></html>',
            );
            server.close();
            if (!tokens.access_token) {
              reject(new Error('Google did not return an access token.'));
              return;
            }
            resolve(tokens.access_token);
          } catch (err) {
            server.close();
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });

        // Surface the URL so the caller can open a browser (Electron) or print it (CLI).
        console.log(`Daybreak: open this URL to sign in to Gmail:\n${authUrl}`);
        onAuthPrompt?.({ url: authUrl });
      } catch (err) {
        server.close();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}

export interface SignedInUser {
  address: string;
}

export async function getSignedInUser(token: string): Promise<SignedInUser> {
  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`Gmail /profile ${resp.status}: ${await resp.text()}`);
  }
  const me = (await resp.json()) as { emailAddress?: string };
  if (!me.emailAddress) {
    throw new Error('Could not determine the signed-in user address from Gmail /profile.');
  }
  return { address: me.emailAddress };
}

// Used by logout flows and tests to clear the persisted refresh token.
export async function clearTokenCache(): Promise<void> {
  await keytar.deletePassword(SERVICE, ACCOUNT);
}
