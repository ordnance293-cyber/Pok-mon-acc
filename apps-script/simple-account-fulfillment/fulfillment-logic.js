(function (root, factory) {
  const logic = factory();
  if (typeof module === 'object' && module.exports) module.exports = logic;
  if (root) root.SimpleAccountFulfillmentLogic = logic;
})(typeof window !== 'undefined' ? window : undefined, function () {
  const PRODUCT_SHEET_MAP = Object.freeze({
    '1百神': '1百神',
    '2百神': '2百神',
    '3百神': '3百神',
    '無極汰那': '無極汰那',
    'Mega烈空坐': 'Mega烈空坐'
  });
  const ALLOWED_PRODUCTS = Object.freeze(Object.keys(PRODUCT_SHEET_MAP));
  const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;
  const AUDIT_SHEET_NAME = '簡帳出貨紀錄';
  const AUDIT_HEADERS = Object.freeze([
    'request_id', 'state', 'requested_at', 'completed_at',
    'product', 'source_sheet', 'source_row', 'account'
  ]);

  function validateRequest(request, config) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'Request must be an object.' };
    }
    if (request.action !== 'fulfillSimpleAccount') {
      return { ok: false, code: 'INVALID_REQUEST', message: 'Unsupported action.' };
    }
    if (typeof request.requestId !== 'string' || !REQUEST_ID_PATTERN.test(request.requestId)) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'Invalid request ID.' };
    }
    if (!Object.prototype.hasOwnProperty.call(PRODUCT_SHEET_MAP, request.product)) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'Unsupported product.' };
    }
    if (config !== undefined && (config === null || typeof config !== 'object' || Array.isArray(config))) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'Invalid configuration.' };
    }
    return { ok: true, product: request.product, sheetName: PRODUCT_SHEET_MAP[request.product] };
  }

  function normalizeColor(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  function isEligibleCredentialRow(row) {
    return !!row && Number.isInteger(row.rowNumber) && row.rowNumber >= 2 &&
      typeof row.account === 'string' && row.account.trim() !== '' &&
      typeof row.password === 'string' && row.password.trim() !== '' &&
      normalizeColor(row.accountBackground) === '#ffffff' &&
      normalizeColor(row.passwordBackground) === '#ffffff';
  }

  function selectFirstEligibleRow(rows, reservedRows) {
    const reserved = reservedRows instanceof Set ? reservedRows : new Set(reservedRows || []);
    return (Array.isArray(rows) ? rows : [])
      .slice()
      .sort((left, right) => left.rowNumber - right.rowNumber)
      .find(row => !reserved.has(row.rowNumber) && isEligibleCredentialRow(row)) || null;
  }

  function buildAuditRecord({ requestId, state, requestedAt, completedAt, product, sourceSheet, sourceRow, account }) {
    return {
      request_id: requestId,
      state,
      requested_at: requestedAt,
      completed_at: completedAt,
      product,
      source_sheet: sourceSheet,
      source_row: sourceRow,
      account
    };
  }

  function createTransactionService(adapters) {
    return {
      adapters,
      fulfill(request, config) {
        const validation = validateRequest(request, config);
        if (!validation.ok) return validation;
        return { ok: false, code: 'NOT_IMPLEMENTED', message: 'Transaction fulfillment is implemented in a later task.' };
      }
    };
  }

  return {
    PRODUCT_SHEET_MAP, ALLOWED_PRODUCTS, REQUEST_ID_PATTERN,
    AUDIT_SHEET_NAME, AUDIT_HEADERS, validateRequest, normalizeColor,
    isEligibleCredentialRow, selectFirstEligibleRow, buildAuditRecord,
    createTransactionService
  };
});
