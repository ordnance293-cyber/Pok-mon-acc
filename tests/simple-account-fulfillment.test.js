const assert = require('node:assert/strict');
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

console.log('simple-account fulfillment domain tests: passed');
