import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invalidRefreshSession,sessionCookieNames} from '../lib/auth-session.js';
test('v66 only expired or revoked session errors trigger cookie removal',()=>{
 for(const code of ['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired'])assert.equal(invalidRefreshSession({code}),true);
 for(const error of [null,undefined,new Error('Failed to fetch'),{code:'over_request_rate_limit'},{status:503},{code:'invalid_credentials'}])assert.equal(invalidRefreshSession(error),false);
});
test('v66 session cleanup targets only current project cookies and all numbered chunks',()=>{
 const names=['sb-project-auth-token','sb-project-auth-token.0','sb-project-auth-token.1','sb-project-auth-token-user','sb-project-auth-token-user.0','sb-project-auth-token-code-verifier','sb-other-auth-token','sb-project-auth-token.malicious','preferences'];
 assert.deepEqual(sessionCookieNames(names.map(name=>({name})),'https://project.supabase.co'),names.slice(0,5));
 assert.deepEqual(sessionCookieNames(names.map(name=>({name})),'invalid-url'),[]);
});
