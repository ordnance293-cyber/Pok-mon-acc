const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Logic = require('../apps-script/simple-account-fulfillment/fulfillment-logic.js');

assert.deepEqual(Logic.PRODUCT_SHEET_MAP, {
  '1百神': '1百神',
  '2百神': '2百神',
  '3百神': '3百神',
  '無極汰那': '無極汰那',
  'Mega烈空坐': 'Mega烈空坐'
});
assert.deepEqual(Logic.ALLOWED_PRODUCTS, Object.keys(Logic.PRODUCT_SHEET_MAP));
assert.equal(Logic.REQUEST_ID_PATTERN.test('A_valid-request_123456789'), true);
assert.equal(Logic.REQUEST_ID_PATTERN.test('too-short'), false);

for (const product of ['全部價格', '高預算帳號', 'arbitrary-product']) {
  assert.equal(Logic.validateRequest({ action: 'fulfillSimpleAccount', requestId: 'request-id-1234567890', product }, {}).ok, false);
}
assert.deepEqual(
  Logic.validateRequest({ action: 'fulfillSimpleAccount', requestId: 'request-id-1234567890', product: '3百神' }, {}),
  { ok: true, product: '3百神', sheetName: '3百神' }
);
assert.equal(Logic.validateRequest({ action: 'fulfillSimpleAccount', requestId: 'bad', product: '3百神' }, {}).ok, false);

assert.equal(Logic.normalizeColor('#FFFFFF'), '#ffffff');
assert.equal(Logic.normalizeColor('  #FfFfFf  '), '#ffffff');
assert.equal(Logic.normalizeColor('#ffff00'), '#ffff00');

const eligible = { rowNumber: 2, account: ' synthetic-account ', password: ' synthetic-password ', accountBackground: '#FFFFFF', passwordBackground: '#ffffff' };
assert.equal(Logic.isEligibleCredentialRow(eligible), true);
assert.equal(Logic.isEligibleCredentialRow({ ...eligible, rowNumber: 1 }), false);
assert.equal(Logic.isEligibleCredentialRow({ ...eligible, password: '   ' }), false);
assert.equal(Logic.isEligibleCredentialRow({ ...eligible, accountBackground: '#ffff00' }), false);
assert.equal(Logic.isEligibleCredentialRow({ ...eligible, passwordBackground: '#eeeeee' }), false);

assert.equal(Logic.selectFirstEligibleRow([
  { rowNumber: 1, account: 'header', password: 'header', accountBackground: '#ffffff', passwordBackground: '#ffffff' },
  { rowNumber: 2, account: 'sold', password: 'sold', accountBackground: '#ffff00', passwordBackground: '#ffff00' },
  { rowNumber: 3, account: 'reserved', password: 'synthetic-password', accountBackground: '#ffffff', passwordBackground: '#ffffff' },
  { rowNumber: 4, account: 'first', password: 'synthetic-password', accountBackground: '#FFFFFF', passwordBackground: '#ffffff' }
], new Set([3])).rowNumber, 4);
assert.equal(Logic.selectFirstEligibleRow([{ ...eligible, rowNumber: 2 }], new Set([2])), null);
assert.equal(Logic.selectFirstEligibleRow([
  { ...eligible, rowNumber: 8, account: 'synthetic-account-eight' },
  { ...eligible, rowNumber: 5, account: 'synthetic-account-five' }
], new Set()).rowNumber, 5);

const audit = Logic.buildAuditRecord({
  requestId: 'request-id-1234567890',
  state: 'RESERVED',
  requestedAt: 1,
  completedAt: '',
  product: '3百神',
  sourceSheet: '3百神',
  sourceRow: 4,
  account: 'synthetic-account'
});
assert.deepEqual(Object.keys(audit), ['request_id', 'state', 'requested_at', 'completed_at', 'product', 'source_sheet', 'source_row', 'account']);
assert.equal('password' in audit, false);
assert.deepEqual(Logic.AUDIT_HEADERS, Object.keys(audit));
assert.equal(Logic.AUDIT_SHEET_NAME, '簡帳出貨紀錄');
assert.equal(typeof Logic.createTransactionService({}).fulfill, 'function');

const VALID_REQUEST_ID = 'request-id-1234567890';
const VALID_REQUEST = Object.freeze({
  action: 'fulfillSimpleAccount',
  requestId: VALID_REQUEST_ID,
  product: '3百神',
  spreadsheetId: 'synthetic-spreadsheet-id',
  secret: 'synthetic-secret'
});
const VALID_CONFIG = Object.freeze({
  configuredSpreadsheetId: 'synthetic-spreadsheet-id',
  configuredSecret: 'synthetic-secret'
});

function credentialRow(rowNumber, account, password, accountBackground, passwordBackground) {
  return {
    rowNumber,
    account,
    password,
    accountBackground: accountBackground || '#ffffff',
    passwordBackground: passwordBackground || '#ffffff'
  };
}

function createTransactionFake(options) {
  const settings = options || {};
  const events = [];
  const auditRecords = (settings.auditRecords || []).map((record, index) => ({
    ...record,
    auditRowNumber: record.auditRowNumber || index + 2
  }));
  const rowsBySheet = settings.rowsBySheet || {
    '3百神': [credentialRow(2, 'synthetic-account-2', 'synthetic-password-2')]
  };
  const sheets = settings.sheets === undefined ? { '3百神': { name: '3百神' } } : settings.sheets;
  const logs = [];
  let timestamp = 1000;
  const adapters = {
    openSpreadsheetById(id) {
      events.push(['open', id]);
      if (settings.openError) throw new Error('synthetic-open-error');
      return { id };
    },
    readAuditRecords() {
      events.push(['read-audit']);
      return auditRecords.map(record => ({ ...record }));
    },
    getProductSheet(sheetName) {
      events.push(['get-sheet', sheetName]);
      return sheets[sheetName] || null;
    },
    getRows(sheet) {
      events.push(['read-rows', sheet.name]);
      if (settings.readRowsError) throw new Error('synthetic-row-error');
      return (rowsBySheet[sheet.name] || []).map(row => ({ ...row }));
    },
    appendAudit(record) {
      events.push(['append', record.state, record.source_row]);
      const saved = { ...record, auditRowNumber: auditRecords.length + 2 };
      auditRecords.push(saved);
      return { ...saved };
    },
    updateAudit(record) {
      events.push(['update', record.state, record.source_row]);
      const index = auditRecords.findIndex(item => item.auditRowNumber === record.auditRowNumber);
      if (index !== -1) auditRecords[index] = { ...record };
    },
    paintFullRow(sheet, rowNumber) {
      events.push(['paint', sheet.name, rowNumber]);
    },
    flush() {
      events.push(['flush']);
    },
    now() {
      timestamp += 1;
      return timestamp;
    },
    logSafe(metadata) {
      logs.push({ ...metadata });
      events.push(['log', metadata && metadata.event]);
    }
  };
  return { adapters, auditRecords, events, logs };
}

function fulfillWithFake(options, request, config) {
  const fake = createTransactionFake(options);
  const response = Logic.createTransactionService(fake.adapters).fulfill(
    request || { ...VALID_REQUEST },
    config || { ...VALID_CONFIG }
  );
  return { ...fake, response };
}

// These checks fail if validation is moved behind any spreadsheet/audit adapter call.
for (const invalidRequest of [
  { ...VALID_REQUEST, action: 'wrong-action' },
  { ...VALID_REQUEST, requestId: 'too-short' },
  { ...VALID_REQUEST, product: '全部價格' }
]) {
  const result = fulfillWithFake({}, invalidRequest);
  assert.equal(result.response.code, 'INVALID_REQUEST');
  assert.deepEqual(result.events, []);
}
for (const mismatchedRequest of [
  { ...VALID_REQUEST, secret: 'wrong-synthetic-secret' },
  { ...VALID_REQUEST, spreadsheetId: 'wrong-synthetic-spreadsheet-id' }
]) {
  const result = fulfillWithFake({}, mismatchedRequest);
  assert.equal(result.response.ok, false);
  assert.ok(['UNAUTHORIZED', 'CONFIG_MISMATCH'].includes(result.response.code));
  assert.deepEqual(result.events, []);
}

const newFulfillment = fulfillWithFake({});
assert.deepEqual(newFulfillment.response, {
  ok: true,
  requestId: VALID_REQUEST_ID,
  product: '3百神',
  sheetName: '3百神',
  rowNumber: 2,
  account: 'synthetic-account-2',
  password: 'synthetic-password-2',
  replayed: false
});
assert.deepEqual(
  newFulfillment.events.filter(event => ['append', 'paint', 'update', 'flush'].includes(event[0])),
  [
    ['append', 'RESERVED', 2], ['flush'], ['paint', '3百神', 2], ['flush'],
    ['update', 'COMPLETED', 2], ['flush']
  ]
);
assert.deepEqual(
  Object.keys(newFulfillment.auditRecords[0]).filter(key => key !== 'auditRowNumber'),
  Logic.AUDIT_HEADERS
);
assert.equal('password' in newFulfillment.auditRecords[0], false);

const missingSheet = fulfillWithFake({ sheets: {} });
assert.equal(missingSheet.response.code, 'SHEET_NOT_FOUND');

const replay = fulfillWithFake({
  auditRecords: [{
    request_id: VALID_REQUEST_ID,
    state: 'COMPLETED',
    requested_at: 1,
    completed_at: 2,
    product: '3百神',
    source_sheet: '3百神',
    source_row: 2,
    account: 'synthetic-account-2'
  }],
  rowsBySheet: { '3百神': [credentialRow(2, ' synthetic-account-2 ', 'fresh-synthetic-password')] }
});
assert.deepEqual(replay.response, {
  ok: true,
  requestId: VALID_REQUEST_ID,
  product: '3百神',
  sheetName: '3百神',
  rowNumber: 2,
  account: 'synthetic-account-2',
  password: 'fresh-synthetic-password',
  replayed: true
});
assert.equal(replay.events.some(event => event[0] === 'append' || event[0] === 'paint'), false);

const replayUnavailable = fulfillWithFake({
  auditRecords: [{
    request_id: VALID_REQUEST_ID,
    state: 'COMPLETED',
    requested_at: 1,
    completed_at: 2,
    product: '3百神',
    source_sheet: '3百神',
    source_row: 2,
    account: 'synthetic-account-2'
  }],
  rowsBySheet: {
    '3百神': [
      credentialRow(2, 'moved-synthetic-account', 'synthetic-password'),
      credentialRow(3, 'replacement-must-not-be-used', 'synthetic-password')
    ]
  }
});
assert.equal(replayUnavailable.response.code, 'REPLAY_UNAVAILABLE');
assert.equal(replayUnavailable.events.some(event => event[0] === 'append' || event[0] === 'paint'), false);

const reservationExcluded = fulfillWithFake({
  auditRecords: [{
    request_id: 'different-request-1234567890',
    state: 'RESERVED',
    requested_at: 1,
    completed_at: '',
    product: '3百神',
    source_sheet: '3百神',
    source_row: 2,
    account: 'synthetic-account-2'
  }],
  rowsBySheet: {
    '3百神': [
      credentialRow(2, 'changed-synthetic-account', 'synthetic-password'),
      credentialRow(3, 'synthetic-account-3', 'synthetic-password-3')
    ]
  }
}, { ...VALID_REQUEST, requestId: 'different-new-request-123456' });
assert.equal(reservationExcluded.response.ok, true);
assert.equal(reservationExcluded.response.rowNumber, 3);
assert.equal(reservationExcluded.auditRecords[0].state, 'RESERVED');

const recoveredReservation = fulfillWithFake({
  auditRecords: [{
    request_id: 'old-reservation-1234567890',
    state: 'RESERVED',
    requested_at: 1,
    completed_at: '',
    product: '3百神',
    source_sheet: '3百神',
    source_row: 2,
    account: 'synthetic-account-2'
  }],
  rowsBySheet: { '3百神': [credentialRow(2, 'synthetic-account-2', 'synthetic-password-2')] }
});
assert.equal(recoveredReservation.auditRecords[0].state, 'COMPLETED');
assert.equal(recoveredReservation.response.code, 'OUT_OF_STOCK');
assert.deepEqual(
  recoveredReservation.events.filter(event => ['paint', 'update', 'flush'].includes(event[0])).slice(0, 3),
  [['paint', '3百神', 2], ['flush'], ['update', 'COMPLETED', 2]]
);

const internalError = fulfillWithFake({ readRowsError: true });
assert.deepEqual(internalError.response, {
  ok: false,
  code: 'INTERNAL_ERROR',
  message: 'Unable to fulfill the request.'
});
assert.equal(JSON.stringify(internalError.response).includes('synthetic-secret'), false);
assert.equal(JSON.stringify(internalError.logs).includes('synthetic-secret'), false);
assert.equal(JSON.stringify(internalError.logs).includes('synthetic-password-2'), false);

function createAppsScriptContext(options) {
  const settings = options || {};
  const events = [];
  const logs = [];
  const properties = {
    SIMPLE_ACCOUNT_SPREADSHEET_ID: 'synthetic-spreadsheet-id',
    SIMPLE_ACCOUNT_FULFILLMENT_SECRET: 'synthetic-secret',
    ...(settings.properties || {})
  };
  const productRows = settings.productRows || [[
    'unused', 'synthetic-account-2', 'synthetic-password-2', '', ''
  ]];
  const productBackgrounds = settings.productBackgrounds || [[
    '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'
  ]];
  const sheets = {};

  function makeSheet(name, values, backgrounds) {
    const data = values.map(row => row.slice());
    const colors = backgrounds.map(row => row.slice());
    return {
      name,
      hidden: false,
      getName() { return name; },
      getLastRow() { return data.length; },
      getMaxColumns() { return Math.max(1, ...data.map(row => row.length)); },
      hideSheet() { this.hidden = true; events.push(['hide', name]); return this; },
      appendRow(row) { data.push(row.slice()); colors.push(row.map(() => '#ffffff')); events.push(['append-row', name]); return this; },
      getRange(row, column, numRows, numColumns) {
        return {
          getValues() {
            return data.slice(row - 1, row - 1 + numRows).map(source => {
              const result = [];
              for (let index = 0; index < numColumns; index += 1) result.push(source[column - 1 + index] || '');
              return result;
            });
          },
          getBackgrounds() {
            return colors.slice(row - 1, row - 1 + numRows).map(source => {
              const result = [];
              for (let index = 0; index < numColumns; index += 1) result.push(source[column - 1 + index] || '#ffffff');
              return result;
            });
          },
          setValues(nextValues) {
            nextValues.forEach((nextRow, rowIndex) => {
              for (let index = 0; index < numColumns; index += 1) data[row - 1 + rowIndex][column - 1 + index] = nextRow[index];
            });
            events.push(['set-values', name, row, numColumns]);
          },
          setBackground(color) {
            for (let rowIndex = 0; rowIndex < numRows; rowIndex += 1) {
              for (let index = 0; index < numColumns; index += 1) colors[row - 1 + rowIndex][column - 1 + index] = color;
            }
            events.push(['paint', name, row, numColumns, color]);
          }
        };
      }
    };
  }

  sheets['3百神'] = makeSheet('3百神', [['header', 'account', 'password', '', ''], ...productRows], [
    ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'], ...productBackgrounds
  ]);
  const spreadsheet = {
    getSheetByName(name) { events.push(['get-sheet', name]); return sheets[name] || null; },
    insertSheet(name) {
      events.push(['insert-sheet', name]);
      const sheet = makeSheet(name, [], []);
      sheets[name] = sheet;
      return sheet;
    }
  };
  const lock = {
    tryLock(milliseconds) { events.push(['try-lock', milliseconds]); return settings.lockAvailable !== false; },
    releaseLock() { events.push(['release-lock']); }
  };
  const context = {
    SimpleAccountFulfillmentLogic: Logic,
    PropertiesService: { getScriptProperties() { return { getProperty(name) { return properties[name] || ''; } }; } },
    LockService: { getScriptLock() { events.push(['get-lock']); return lock; } },
    SpreadsheetApp: {
      openById(id) { events.push(['open', id]); return spreadsheet; },
      flush() { events.push(['flush']); }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) {
        return {
          text,
          mimeType: null,
          setMimeType(mimeType) { this.mimeType = mimeType; return this; },
          getContent() { return this.text; }
        };
      }
    },
    Logger: { log(value) { logs.push(value); events.push(['log']); } },
    JSON,
    Date,
    Object,
    Array,
    String,
    Number,
    Error
  };
  return { context, events, logs, sheets };
}

const codeSource = fs.readFileSync('apps-script/simple-account-fulfillment/Code.gs', 'utf8');
assert.ok(codeSource.includes("SIMPLE_ACCOUNT_SPREADSHEET_ID"));
assert.ok(codeSource.includes("SIMPLE_ACCOUNT_FULFILLMENT_SECRET"));
assert.ok(codeSource.includes('tryLock(10000)'));
assert.ok(codeSource.includes("setBackground('#ffff00')"));

const lockTimeout = createAppsScriptContext({ lockAvailable: false });
vm.createContext(lockTimeout.context);
vm.runInContext(codeSource, lockTimeout.context);
const busyOutput = lockTimeout.context.doPost({ postData: { contents: JSON.stringify(VALID_REQUEST) } });
assert.deepEqual(JSON.parse(busyOutput.getContent()), { ok: false, code: 'BUSY', message: 'Service is busy. Please retry.' });
assert.equal(lockTimeout.events.some(event => ['open', 'insert-sheet', 'append-row', 'paint', 'set-values'].includes(event[0])), false);

const appScriptSuccess = createAppsScriptContext();
vm.createContext(appScriptSuccess.context);
vm.runInContext(codeSource, appScriptSuccess.context);
const successOutput = appScriptSuccess.context.doPost({ postData: { contents: JSON.stringify(VALID_REQUEST) } });
const successResponse = JSON.parse(successOutput.getContent());
assert.equal(successResponse.ok, true);
assert.equal(successResponse.password, 'synthetic-password-2');
assert.equal(appScriptSuccess.sheets['簡帳出貨紀錄'].hidden, true);
assert.deepEqual(
  appScriptSuccess.events.find(event => event[0] === 'paint'),
  ['paint', '3百神', 2, 5, '#ffff00']
);
const releaseIndex = appScriptSuccess.events.findIndex(event => event[0] === 'release-lock');
assert.equal(appScriptSuccess.events[releaseIndex - 1][0], 'flush');
assert.equal(JSON.stringify(appScriptSuccess.logs).includes('synthetic-secret'), false);
assert.equal(JSON.stringify(appScriptSuccess.logs).includes('synthetic-password-2'), false);

console.log('simple-account fulfillment domain tests: passed');
