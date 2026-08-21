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
    const safeAdapters = adapters || {};

    function failure(code, message) {
      return { ok: false, code, message };
    }

    function validateConfiguration(request, config) {
      if (!config || typeof config !== 'object' || Array.isArray(config) ||
        typeof config.configuredSpreadsheetId !== 'string' || config.configuredSpreadsheetId.trim() === '' ||
        typeof config.configuredSecret !== 'string' || config.configuredSecret === '') {
        return failure('UNAUTHORIZED', 'Server configuration is unavailable.');
      }
      if (request.secret !== config.configuredSecret) {
        return failure('UNAUTHORIZED', 'Authorization failed.');
      }
      if (request.spreadsheetId !== config.configuredSpreadsheetId) {
        return failure('CONFIG_MISMATCH', 'Spreadsheet configuration does not match.');
      }
      return null;
    }

    function trimmedCredential(value) {
      return typeof value === 'string' ? value.trim() : '';
    }

    function findRow(rows, rowNumber) {
      return (Array.isArray(rows) ? rows : []).find(function (row) {
        return row && Number(row.rowNumber) === Number(rowNumber);
      }) || null;
    }

    function sourceMatchesRecord(record, row) {
      return !!record && !!row && Number(record.source_row) >= 2 &&
        trimmedCredential(row.account) !== '' &&
        trimmedCredential(row.password) !== '' &&
        trimmedCredential(row.account) === trimmedCredential(record.account);
    }

    function buildSuccess(record, row, replayed) {
      return {
        ok: true,
        requestId: record.request_id,
        product: record.product,
        sheetName: record.source_sheet,
        rowNumber: Number(record.source_row),
        account: trimmedCredential(row.account),
        password: trimmedCredential(row.password),
        replayed: replayed === true
      };
    }

    function getRecordedSource(record) {
      if (!record || !Object.prototype.hasOwnProperty.call(PRODUCT_SHEET_MAP, record.product) ||
        PRODUCT_SHEET_MAP[record.product] !== record.source_sheet || Number(record.source_row) < 2) {
        return null;
      }
      const sheet = safeAdapters.getProductSheet(record.source_sheet);
      if (!sheet) return null;
      const row = findRow(safeAdapters.getRows(sheet), record.source_row);
      return sourceMatchesRecord(record, row) ? { sheet, row } : null;
    }

    function completeReservation(record, source) {
      safeAdapters.paintFullRow(source.sheet, Number(record.source_row));
      safeAdapters.flush();
      const completed = Object.assign({}, record, {
        state: 'COMPLETED',
        completed_at: safeAdapters.now()
      });
      safeAdapters.updateAudit(completed);
      safeAdapters.flush();
      return completed;
    }

    function safeLog(metadata) {
      if (typeof safeAdapters.logSafe === 'function') safeAdapters.logSafe(metadata);
    }

    return {
      adapters: safeAdapters,
      fulfill(request, config) {
        const validation = validateRequest(request, config);
        if (!validation.ok) return validation;
        const configurationError = validateConfiguration(request, config);
        if (configurationError) return configurationError;

        try {
          safeAdapters.openSpreadsheetById(config.configuredSpreadsheetId);
          const readAuditRecords = safeAdapters.readAuditRecords();
          const auditRecords = Array.isArray(readAuditRecords) ? readAuditRecords : [];
          const existing = auditRecords.find(function (record) {
            return record && record.request_id === request.requestId;
          });

          if (existing) {
            if (existing.product !== validation.product || existing.source_sheet !== validation.sheetName) {
              return failure('REPLAY_UNAVAILABLE', 'The original fulfillment cannot be safely replayed.');
            }
            const source = getRecordedSource(existing);
            if (!source) return failure('REPLAY_UNAVAILABLE', 'The original fulfillment cannot be safely replayed.');
            const completed = existing.state === 'RESERVED'
              ? completeReservation(existing, source)
              : existing;
            return buildSuccess(completed, source.row, true);
          }

          const unresolvedReservations = new Set();
          auditRecords.filter(function (record) {
            return record && record.state === 'RESERVED';
          }).forEach(function (reservation) {
            let source = null;
            try {
              source = getRecordedSource(reservation);
            } catch (error) {
              source = null;
            }
            if (source) {
              completeReservation(reservation, source);
            } else if (reservation.source_sheet === validation.sheetName && Number(reservation.source_row) >= 2) {
              unresolvedReservations.add(Number(reservation.source_row));
            }
          });

          const productSheet = safeAdapters.getProductSheet(validation.sheetName);
          if (!productSheet) return failure('SHEET_NOT_FOUND', 'Configured product sheet was not found.');
          const selected = selectFirstEligibleRow(safeAdapters.getRows(productSheet), unresolvedReservations);
          if (!selected) return failure('OUT_OF_STOCK', 'No eligible account is available.');

          const reservation = buildAuditRecord({
            requestId: request.requestId,
            state: 'RESERVED',
            requestedAt: safeAdapters.now(),
            completedAt: '',
            product: validation.product,
            sourceSheet: validation.sheetName,
            sourceRow: selected.rowNumber,
            account: selected.account.trim()
          });
          const savedReservation = safeAdapters.appendAudit(reservation) || reservation;
          safeAdapters.flush();
          safeAdapters.paintFullRow(productSheet, selected.rowNumber);
          safeAdapters.flush();
          const completedReservation = Object.assign({}, savedReservation, {
            state: 'COMPLETED',
            completed_at: safeAdapters.now()
          });
          safeAdapters.updateAudit(completedReservation);
          safeAdapters.flush();
          return buildSuccess(completedReservation, selected, false);
        } catch (error) {
          safeLog({
            event: 'simpleAccountFulfillmentError',
            requestId: request.requestId,
            product: request.product,
            state: 'INTERNAL_ERROR',
            rowNumber: null
          });
          return failure('INTERNAL_ERROR', 'Unable to fulfill the request.');
        }
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
