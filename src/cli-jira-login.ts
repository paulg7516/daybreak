// src/cli-jira-login.ts
import { storeJiraToken } from './ingest/jsm-auth';

const token = process.argv[2];
if (!token) {
  console.error('Usage: npm run jira:login -- <api-token>');
  process.exit(1);
}
storeJiraToken(token)
  .then(() => console.log('Jira API token stored in the OS keychain.'))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
