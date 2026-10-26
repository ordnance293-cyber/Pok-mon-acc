'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = source.indexOf('const requestOpenAiJsonSchema = async');
const end = source.indexOf('const requestSmartHundoFormVerification = async', start);
assert(start >= 0 && end > start, 'OpenAI transport wrapper exists');
const transport = source.slice(start, end);
assert(source.includes('const formatAiTransportFailure ='), 'human-readable failure reason exists');
assert(source.includes('errorBody?.error?.code || errorBody?.error?.type'), 'API type fallback is preserved');
assert(source.includes("httpStatus ? `HTTP ${httpStatus}"), 'retry shows HTTP status');
assert(source.includes("errors.every(item => Number(item?.httpStatus || 0) === http"), 'repeated first-batch HTTP errors abort scan');

async function verify() {
  const requests = [];
  let responder;
  const sandbox = {
    OPENAI_MODEL: 'gpt-6-luna',
    OPENAI_REASONING_EFFORT: 'none',
    AI_IMAGE_DETAIL: 'auto',
    OPENAI_CHAT_COMPLETIONS_URL: 'https://api.openai.com/v1/chat/completions',
    buildAiRequestContent: () => [],
    recordAiDiagnosticRequest: () => {},
    parseJsonText: JSON.parse,
    parseOpenAIMessageContent: body => body.choices[0].message.content,
    fetch: async (_, options) => { requests.push(JSON.parse(options.body)); return responder(); },
    setTimeout: fn => fn()
  };
  vm.createContext(sandbox);
  vm.runInContext(transport.replace('const requestOpenAiJsonSchema =', 'requestOpenAiJsonSchema ='), sandbox);
  const run = () => sandbox.requestOpenAiJsonSchema('dummy-key', 'prompt', 'data:image/png;base64,AA==', { name: 'schema', schema: {} }, null);
  const failure = (status, code, type) => ({
    ok: false, status,
    headers: { get: () => null },
    json: async () => ({ error: { code, type } })
  });

  responder = () => failure(429, null, 'insufficient_quota');
  await assert.rejects(run(), error => error.httpStatus === 429 && error.apiErrorCode === 'insufficient_quota');
  assert.equal(requests.length, 1, 'billing quota errors must not retry');

  responder = () => failure(429, 'credit_balance_exhausted', 'insufficient_quota');
  await assert.rejects(run(), error => error.apiErrorCode === 'credit_balance_exhausted');
  assert.equal(requests.length, 2, 'credit exhaustion must not retry');

  responder = () => failure(401, 'invalid_api_key', 'invalid_request_error');
  await assert.rejects(run(), error => error.httpStatus === 401);
  assert.equal(requests.length, 3, 'invalid API keys must not retry');

  let attempt = 0;
  responder = () => {
    attempt++;
    return attempt === 1 ? failure(429, 'rate_limit_exceeded', 'rate_limit_error') : {
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] })
    };
  };
  const result = await run();
  assert.equal(result.ok, true);
  assert.equal(attempt, 2, 'temporary rate limits may be retried');
  assert.equal(requests.at(-1).model, 'gpt-6-luna');
  assert.equal(requests.at(-1).reasoning_effort, 'none');
  assert.equal(Object.hasOwn(requests.at(-1), 'temperature'), false);
  console.log('OpenAI API quota/type, retry and model compatibility tests passed.');
}
verify().catch(error => { console.error(error); process.exitCode = 1; });
