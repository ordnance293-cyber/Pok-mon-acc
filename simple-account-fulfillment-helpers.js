(function (root, factory) {
  const helpers = factory();
  if (typeof module === 'object' && module.exports) module.exports = helpers;
  if (root) root.SimpleAccountFulfillmentHelpers = helpers;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  const PRODUCTS = Object.freeze(['1百神', '2百神', '3百神', '無極汰那', 'Mega烈空坐']);
  const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;
  const PENDING_STORAGE_KEY = 'simpleAccountPendingFulfillment';
  const CLEAR_CODES = new Set([
    'INVALID_REQUEST', 'UNAUTHORIZED', 'CONFIG_MISMATCH', 'SHEET_NOT_FOUND', 'OUT_OF_STOCK', 'BUSY'
  ]);

  function isProduct(product) {
    return typeof product === 'string' && PRODUCTS.includes(product);
  }

  function isRequestId(requestId) {
    return typeof requestId === 'string' && REQUEST_ID_PATTERN.test(requestId);
  }

  function toBase64Url(bytes) {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    if (typeof btoa === 'function') return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    throw new Error('Secure random encoding is unavailable.');
  }

  function createRequestId(cryptoLike) {
    const source = cryptoLike || (typeof crypto !== 'undefined' ? crypto : null);
    if (source && typeof source.randomUUID === 'function') {
      const uuid = source.randomUUID();
      if (isRequestId(uuid)) return uuid;
    }
    if (!source || typeof source.getRandomValues !== 'function') throw new Error('Secure random values are required.');
    const requestId = toBase64Url(source.getRandomValues(new Uint8Array(24)));
    if (!isRequestId(requestId)) throw new Error('Unable to create a valid request ID.');
    return requestId;
  }

  function buildRequestPayload(settings, product, requestId) {
    if (!isProduct(product)) throw new Error('Invalid product.');
    if (!isRequestId(requestId)) throw new Error('Invalid request ID.');
    const source = settings && typeof settings === 'object' ? settings : {};
    return {
      action: 'fulfillSimpleAccount',
      requestId,
      spreadsheetId: source.spreadsheetId,
      product,
      secret: source.secret
    };
  }

  function createPendingState(product, requestId, createdAt) {
    if (!isProduct(product)) throw new Error('Invalid product.');
    if (!isRequestId(requestId)) throw new Error('Invalid request ID.');
    if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) throw new Error('Invalid pending timestamp.');
    return { requestId, product, createdAt };
  }

  function parsePendingState(raw) {
    if (typeof raw !== 'string') return null;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    try {
      return createPendingState(parsed.product, parsed.requestId, parsed.createdAt);
    } catch (error) {
      return null;
    }
  }

  function shouldClearPending(code) {
    return CLEAR_CODES.has(code);
  }

  function classifyResponse(response) {
    if (response && typeof response === 'object' && response.ok === true && typeof response.account === 'string' && typeof response.password === 'string') {
      return { ok: true, code: 'DELIVERED', clearPending: true, account: response.account, password: response.password };
    }
    if (response && typeof response === 'object' && response.code === 'REPLAY_UNAVAILABLE') {
      return { ok: false, code: 'REPLAY_UNAVAILABLE', clearPending: false, requiresManualInspection: true };
    }
    if (response && typeof response === 'object' && shouldClearPending(response.code)) {
      return { ok: false, code: response.code, clearPending: true };
    }
    return { ok: false, code: 'UNKNOWN_OUTCOME', clearPending: false };
  }

  function classifyNetworkFailure() {
    return { ok: false, code: 'UNKNOWN_OUTCOME', clearPending: false };
  }

  function pendingBlocksProduct(pending, product) {
    return Boolean(pending && isProduct(pending.product) && isRequestId(pending.requestId) && pending.product !== product);
  }

  function safeUserMessage(result) {
    const code = result && result.code;
    const messages = {
      DELIVERED: '出貨完成，請確認帳號與密碼。',
      INVALID_REQUEST: '請確認簡帳出貨設定後再試。',
      UNAUTHORIZED: '簡帳出貨驗證失敗，請確認設定。',
      CONFIG_MISMATCH: '簡帳試算表設定不一致，請確認設定。',
      SHEET_NOT_FOUND: '找不到對應的簡帳資料表，請聯絡管理員。',
      OUT_OF_STOCK: '此商品目前無可出貨庫存。',
      BUSY: '出貨服務忙碌中，請稍後再試。',
      REPLAY_UNAVAILABLE: '請先依提示查閱出貨紀錄與來源列，再決定是否清除待處理請求。',
      UNKNOWN_OUTCOME: '出貨結果尚未確認，請保留待處理請求並稍後重試。'
    };
    return messages[code] || messages.UNKNOWN_OUTCOME;
  }

  return Object.freeze({
    PRODUCTS,
    REQUEST_ID_PATTERN,
    PENDING_STORAGE_KEY,
    createRequestId,
    buildRequestPayload,
    createPendingState,
    parsePendingState,
    classifyResponse,
    classifyNetworkFailure,
    shouldClearPending,
    pendingBlocksProduct,
    safeUserMessage
  });
}));
