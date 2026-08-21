function doPost(event) {
  var request;
  var response;
  var lock = null;
  var lockAcquired = false;
  try {
    try {
      request = JSON.parse(event && event.postData && event.postData.contents || '');
    } catch (error) {
      response = { ok: false, code: 'INVALID_REQUEST', message: 'Request must be valid JSON.' };
    }
    if (!response) {
      var requestValidation = SimpleAccountFulfillmentLogic.validateRequest(request);
      if (!requestValidation.ok) response = requestValidation;
    }
    if (!response) {
      var properties = PropertiesService.getScriptProperties();
      var config = {
        configuredSpreadsheetId: properties.getProperty('SIMPLE_ACCOUNT_SPREADSHEET_ID') || '',
        configuredSecret: properties.getProperty('SIMPLE_ACCOUNT_FULFILLMENT_SECRET') || ''
      };
      lock = LockService.getScriptLock();
      if (!lock.tryLock(10000)) {
        response = { ok: false, code: 'BUSY', message: 'Service is busy. Please retry.' };
      } else {
        lockAcquired = true;
        var service = SimpleAccountFulfillmentLogic.createTransactionService(
          createSimpleAccountAdapters_(config)
        );
        response = service.fulfill(request, config);
        logSimpleAccountMetadata_({
          event: 'simpleAccountFulfillment',
          requestId: request && request.requestId,
          product: request && request.product,
          state: response.ok ? 'COMPLETED' : response.code,
          rowNumber: response.ok ? response.rowNumber : null
        });
      }
    }
  } catch (error) {
    response = { ok: false, code: 'INTERNAL_ERROR', message: 'Unable to fulfill the request.' };
    logSimpleAccountMetadata_({
      event: 'simpleAccountFulfillment',
      requestId: request && request.requestId,
      product: request && request.product,
      state: 'INTERNAL_ERROR',
      rowNumber: null
    });
  } finally {
    if (lockAcquired) {
      try {
        SpreadsheetApp.flush();
      } catch (error) {}
      try {
        lock.releaseLock();
      } catch (error) {}
    }
  }
  return simpleAccountJsonOutput_(response || {
    ok: false,
    code: 'INTERNAL_ERROR',
    message: 'Unable to fulfill the request.'
  });
}

function createSimpleAccountAdapters_(config) {
  var spreadsheet = null;
  var auditSheet = null;

  function getSpreadsheet_() {
    if (!spreadsheet) spreadsheet = SpreadsheetApp.openById(config.configuredSpreadsheetId);
    return spreadsheet;
  }

  function getAuditSheet_() {
    if (auditSheet) return auditSheet;
    var book = getSpreadsheet_();
    auditSheet = book.getSheetByName(SimpleAccountFulfillmentLogic.AUDIT_SHEET_NAME);
    if (!auditSheet) {
      auditSheet = book.insertSheet(SimpleAccountFulfillmentLogic.AUDIT_SHEET_NAME);
      auditSheet.appendRow(SimpleAccountFulfillmentLogic.AUDIT_HEADERS);
      SpreadsheetApp.flush();
      auditSheet.hideSheet();
      SpreadsheetApp.flush();
    }
    return auditSheet;
  }

  return {
    openSpreadsheetById: function (id) {
      if (id !== config.configuredSpreadsheetId) throw new Error('configured spreadsheet mismatch');
      return getSpreadsheet_();
    },
    readAuditRecords: function () {
      var sheet = getAuditSheet_();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];
      var values = sheet.getRange(2, 1, lastRow - 1, SimpleAccountFulfillmentLogic.AUDIT_HEADERS.length).getValues();
      return values.reduce(function (records, row, index) {
        if (String(row[0] || '').trim() === '') return records;
        var record = { auditRowNumber: index + 2 };
        SimpleAccountFulfillmentLogic.AUDIT_HEADERS.forEach(function (header, column) {
          record[header] = row[column];
        });
        records.push(record);
        return records;
      }, []);
    },
    getProductSheet: function (sheetName) {
      return getSpreadsheet_().getSheetByName(sheetName);
    },
    getRows: function (sheet) {
      var lastRow = sheet.getLastRow();
      if (lastRow < 1) return [];
      var values = sheet.getRange(1, 1, lastRow, 3).getDisplayValues();
      var backgrounds = sheet.getRange(1, 1, lastRow, 3).getBackgrounds();
      return values.map(function (row, index) {
        return {
          rowNumber: index + 1,
          account: row[1],
          password: row[2],
          accountBackground: backgrounds[index][1],
          passwordBackground: backgrounds[index][2]
        };
      });
    },
    appendAudit: function (record) {
      var sheet = getAuditSheet_();
      sheet.appendRow(SimpleAccountFulfillmentLogic.AUDIT_HEADERS.map(function (header) {
        return record[header];
      }));
      return Object.assign({}, record, { auditRowNumber: sheet.getLastRow() });
    },
    updateAudit: function (record) {
      var sheet = getAuditSheet_();
      sheet.getRange(record.auditRowNumber, 1, 1, SimpleAccountFulfillmentLogic.AUDIT_HEADERS.length)
        .setValues([SimpleAccountFulfillmentLogic.AUDIT_HEADERS.map(function (header) {
          return record[header];
        })]);
    },
    paintFullRow: function (sheet, rowNumber) {
      sheet.getRange(rowNumber, 1, 1, sheet.getMaxColumns()).setBackground('#ffff00');
    },
    flush: function () {
      SpreadsheetApp.flush();
    },
    now: function () {
      return new Date().toISOString();
    },
    logSafe: logSimpleAccountMetadata_
  };
}

function logSimpleAccountMetadata_(metadata) {
  try {
    Logger.log(JSON.stringify({
      event: metadata && metadata.event || 'simpleAccountFulfillment',
      requestId: metadata && metadata.requestId || null,
      product: metadata && metadata.product || null,
      state: metadata && metadata.state || null,
      rowNumber: metadata && metadata.rowNumber || null
    }));
  } catch (error) {}
}

function simpleAccountJsonOutput_(response) {
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}
