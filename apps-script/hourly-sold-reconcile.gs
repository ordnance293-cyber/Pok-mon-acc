var SOLD_RECONCILE_HANDLER = 'hourlySoldReconcile';
var DEFAULT_SOLD_RECONCILE_TIMEZONE = 'Asia/Taipei';
var SOLD_SHEET_DELETE_QUEUE_PROPERTY = 'SOLD_SHEET_DELETE_QUEUE';

function hourlySoldReconcile() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    console.log(JSON.stringify({ event: 'hourlySoldReconcile', skipped: 'lock-held' }));
    return { skipped: true, reason: 'lock-held' };
  }

  var startedAt = Date.now();
  var counts = {
    soldFound: 0,
    legacyDeleteAtInitialized: 0,
    expiredFound: 0,
    expiredDeleted: 0,
    sheetRepainted: 0,
    errors: 0
  };

  try {
    var config = getSoldReconcileConfig_();
    var now = Date.now();
    var firebaseSnapshot = readFirebaseInventory_(config);
    var inventory = firebaseSnapshot.items;
    var plan = SoldReconcileLogic.planInventoryReconciliation(inventory, now);
    counts.soldFound = plan.sold.length;
    counts.legacyDeleteAtInitialized = plan.needsDeleteAt.length;
    counts.expiredFound = plan.expired.length;

    var protectedAccountIds = buildProtectedAccountIds_(inventory, plan);
    var safeExpired = plan.expired.filter(function (item) {
      var accountId = normalizeAccountId_(item.accountId);
      return accountId
        && protectedAccountIds[accountId] !== true;
    });
    var currentExpiredQueue = safeExpired.map(function (item) {
      return { uid: item.uid, accountId: normalizeAccountId_(item.accountId) };
    });
    var inventoryByUid = {};
    inventory.forEach(function (item) {
      if (item && item.uid) inventoryByUid[item.uid] = true;
    });
    var pendingQueue = readPendingSheetDeleteQueue_().filter(function (entry) {
      // A UID that is present again was restored or reused; never delete its
      // queued Sheet row based on an older Firebase snapshot.
      return !inventoryByUid[entry.uid];
    });
    var sheetDeleteQueue = mergeSheetDeleteQueues_(pendingQueue, currentExpiredQueue);
    savePendingSheetDeleteQueue_(sheetDeleteQueue);

    var firebasePlan = {
      needsDeleteAt: plan.needsDeleteAt,
      expired: safeExpired
    };
    var firebaseUpdates = SoldReconcileLogic.buildFirebaseInventoryUpdates(firebasePlan, now);
    if (Object.keys(firebaseUpdates).length > 0) {
      patchFirebaseInventory_(config, firebaseUpdates, firebaseSnapshot.etag);
    }
    counts.expiredDeleted = safeExpired.length;

    var sheet = null;
    if (sheetDeleteQueue.length > 0 || plan.sold.length > 0) {
      try {
        sheet = openSoldSheet_(config);
        if (sheetDeleteQueue.length > 0) {
          var deletionResult = deleteExpiredSheetRows_(sheet, sheetDeleteQueue, config);
          savePendingSheetDeleteQueue_(deletionResult.remaining);
          counts.errors += deletionResult.errors.length;
        }
      } catch (error) {
        counts.errors += 1;
        logSoldReconcileError_('sheet-adapter', error);
      }
    }

    if (sheet && plan.sold.length > 0) {
      var remainingSold = plan.retained.concat(plan.needsDeleteAt);
      if (remainingSold.length > 0) {
        try {
          var rowMap = readSoldSheetRowMap_(sheet, config);
          var repaintResult = applySoldFormattingBatch(sheet, rowMap, remainingSold, config);
          counts.sheetRepainted = Number(repaintResult && repaintResult.repainted) || remainingSold.length;
        } catch (error) {
          counts.errors += 1;
          logSoldReconcileError_('sold-formatter', error);
        }
      }
    }
  } catch (error) {
    counts.errors += 1;
    logSoldReconcileError_('hourly-run', error);
  } finally {
    counts.durationMs = Date.now() - startedAt;
    console.log(JSON.stringify({
      event: 'hourlySoldReconcile',
      soldFound: counts.soldFound,
      legacyDeleteAtInitialized: counts.legacyDeleteAtInitialized,
      expiredFound: counts.expiredFound,
      expiredDeleted: counts.expiredDeleted,
      sheetRepainted: counts.sheetRepainted,
      errors: counts.errors,
      durationMs: counts.durationMs
    }));
    lock.releaseLock();
  }

  return counts;
}

function removeDuplicateHourlySoldReconcileTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var matching = triggers.filter(function (trigger) {
    return trigger.getHandlerFunction() === SOLD_RECONCILE_HANDLER;
  });

  // Apps Script does not expose the configured interval on an existing trigger.
  // Removing all matching handlers lets the installer guarantee one known hourly
  // trigger instead of accidentally retaining a daily or legacy schedule.
  matching.forEach(function (trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
  return { removed: matching.length, remaining: 0 };
}

function installHourlySoldReconcileTrigger() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    console.log(JSON.stringify({ event: 'installHourlySoldReconcileTrigger', skipped: 'lock-held' }));
    return { skipped: true, reason: 'lock-held' };
  }
  try {
    var removed = removeDuplicateHourlySoldReconcileTriggers();
    var timezone = PropertiesService.getScriptProperties().getProperty('TIMEZONE')
      || DEFAULT_SOLD_RECONCILE_TIMEZONE;
    ScriptApp.newTrigger(SOLD_RECONCILE_HANDLER)
      .timeBased()
      .everyHours(1)
      .inTimezone(timezone)
      .create();
    return { removed: removed.removed, created: 1, timezone: timezone };
  } finally {
    lock.releaseLock();
  }
}

function getSoldReconcileConfig_() {
  var properties = PropertiesService.getScriptProperties();
  var firebaseDatabaseUrl = properties.getProperty('FIREBASE_DATABASE_URL');
  var firebaseAuthToken = properties.getProperty('FIREBASE_AUTH_TOKEN');
  if (!firebaseDatabaseUrl || !firebaseAuthToken) {
    throw new Error('FIREBASE_DATABASE_URL and FIREBASE_AUTH_TOKEN Script Properties are required');
  }

  var accountIdColumn = Number(properties.getProperty('ACCOUNT_ID_COLUMN'));
  return {
    firebaseDatabaseUrl: firebaseDatabaseUrl,
    firebaseAuthToken: firebaseAuthToken,
    spreadsheetId: properties.getProperty('SPREADSHEET_ID') || '',
    sheetName: properties.getProperty('SHEET_NAME') || '',
    accountIdColumn: Number.isInteger(accountIdColumn) && accountIdColumn > 0 ? accountIdColumn : null,
    timezone: properties.getProperty('TIMEZONE') || DEFAULT_SOLD_RECONCILE_TIMEZONE
  };
}

function readFirebaseInventory_(config) {
  var response = fetchFirebaseJson_(config, 'inventory.json', 'get', undefined, {
    returnResponse: true,
    requestHeaders: { 'X-Firebase-ETag': 'true' }
  });
  var payload = response.data;
  var items = !payload || typeof payload !== 'object' ? [] : Object.keys(payload).map(function (uid) {
    var item = payload[uid];
    return Object.assign({ uid: uid }, item && typeof item === 'object' ? item : {});
  });
  return { items: items, etag: getResponseHeader_(response.headers, 'ETag') };
}

function patchFirebaseInventory_(config, updates, etag) {
  if (!etag) throw new Error('Firebase inventory ETag was unavailable; refusing an unguarded mutation');
  fetchFirebaseJson_(config, 'inventory.json', 'patch', updates, {
    requestHeaders: { 'If-Match': etag }
  });
}

function fetchFirebaseJson_(config, path, method, payload, requestOptions) {
  var baseUrl = String(config.firebaseDatabaseUrl).replace(/\/+$/, '');
  var url = baseUrl + '/' + String(path).replace(/^\/+/, '')
    + '?auth=' + encodeURIComponent(config.firebaseAuthToken);
  var options = {
    method: method,
    muteHttpExceptions: true,
    contentType: 'application/json'
  };
  if (payload !== undefined) options.payload = JSON.stringify(payload);
  if (requestOptions && requestOptions.requestHeaders) options.headers = requestOptions.requestHeaders;

  var response = UrlFetchApp.fetch(url, options);
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('Firebase request failed with HTTP ' + status);
  }
  var text = response.getContentText();
  var data = text ? JSON.parse(text) : null;
  if (requestOptions && requestOptions.returnResponse) {
    return { data: data, headers: response.getHeaders() };
  }
  return data;
}

function getResponseHeader_(headers, name) {
  var target = String(name).toLowerCase();
  var keys = Object.keys(headers || {});
  for (var index = 0; index < keys.length; index += 1) {
    if (keys[index].toLowerCase() === target) {
      var value = headers[keys[index]];
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return '';
}

function openSoldSheet_(config) {
  if (!config.spreadsheetId || !config.sheetName || !config.accountIdColumn) {
    throw new Error('SPREADSHEET_ID, SHEET_NAME, and ACCOUNT_ID_COLUMN Script Properties are required for Sheet reconciliation');
  }
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  var sheet = spreadsheet.getSheetByName(config.sheetName);
  if (!sheet) throw new Error('configured Sheet tab was not found');
  return sheet;
}

function readSoldSheetRowMap_(sheet, config) {
  var values = sheet.getDataRange().getValues();
  var rows = [];
  for (var index = 1; index < values.length; index += 1) {
    rows.push({
      rowNumber: index + 1,
      accountId: values[index][config.accountIdColumn - 1]
    });
  }
  return SoldReconcileLogic.mapAccountIdsToSheetRows(rows, 'accountId');
}

function deleteExpiredSheetRows_(sheet, queue, config) {
  var normalizedQueue = Array.isArray(queue) ? queue : [];
  var rowMap = readSoldSheetRowEntries_(sheet, config);
  var rowEntries = [];
  var requestedAccountIds = {};
  normalizedQueue.forEach(function (entry) {
    var accountId = normalizeAccountId_(entry && entry.accountId);
    if (accountId) {
      requestedAccountIds[accountId] = true;
    }
  });

  Object.keys(requestedAccountIds).forEach(function (accountId) {
    (rowMap[accountId] || []).forEach(function (rowNumber) {
      rowEntries.push({ rowNumber: rowNumber, accountId: accountId });
    });
  });

  var uniqueRows = {};
  rowEntries.forEach(function (entry) {
    uniqueRows[entry.rowNumber] = entry;
  });
  var sortedRows = Object.keys(uniqueRows).map(Number).sort(function (a, b) { return b - a; });
  var deletedRows = {};
  var failedRows = {};
  var errors = [];

  groupDescendingRows_(sortedRows).forEach(function (range) {
    try {
      sheet.deleteRows(range.start, range.count);
      for (var row = range.start; row < range.start + range.count; row += 1) deletedRows[row] = true;
    } catch (error) {
      for (var failed = range.start; failed < range.start + range.count; failed += 1) failedRows[failed] = true;
      errors.push(safeErrorMessage_(error));
    }
  });

  var remaining = normalizedQueue.filter(function (entry) {
    var rows = rowMap[normalizeAccountId_(entry && entry.accountId)] || [];
    return rows.some(function (rowNumber) {
      return failedRows[rowNumber] === true || deletedRows[rowNumber] !== true;
    });
  });

  return { remaining: remaining, deleted: normalizedQueue.length - remaining.length, errors: errors };
}

function readPendingSheetDeleteQueue_() {
  var raw = PropertiesService.getScriptProperties().getProperty(SOLD_SHEET_DELETE_QUEUE_PROPERTY);
  if (!raw) return [];
  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(function (entry) {
      return entry && entry.uid && normalizeAccountId_(entry.accountId);
    }).map(function (entry) {
      return { uid: String(entry.uid), accountId: normalizeAccountId_(entry.accountId) };
    }) : [];
  } catch (error) {
    logSoldReconcileError_('sheet-delete-queue', error);
    return [];
  }
}

function mergeSheetDeleteQueues_(first, second) {
  var merged = [];
  var seen = {};
  (Array.isArray(first) ? first : []).concat(Array.isArray(second) ? second : []).forEach(function (entry) {
    if (!entry || !entry.uid || !normalizeAccountId_(entry.accountId)) return;
    var normalized = { uid: String(entry.uid), accountId: normalizeAccountId_(entry.accountId) };
    var key = normalized.uid + '\u0000' + normalized.accountId;
    if (seen[key]) return;
    seen[key] = true;
    merged.push(normalized);
  });
  return merged;
}

function savePendingSheetDeleteQueue_(queue) {
  var properties = PropertiesService.getScriptProperties();
  if (!queue || queue.length === 0) {
    properties.deleteProperty(SOLD_SHEET_DELETE_QUEUE_PROPERTY);
    return;
  }
  properties.setProperty(SOLD_SHEET_DELETE_QUEUE_PROPERTY, JSON.stringify(queue));
}

function buildProtectedAccountIds_(inventory, plan) {
  var expiredUids = {};
  plan.expired.forEach(function (item) {
    if (item && item.uid) expiredUids[item.uid] = true;
  });

  var protectedAccountIds = {};
  (Array.isArray(inventory) ? inventory : []).forEach(function (item) {
    var accountId = normalizeAccountId_(item && item.accountId);
    if (accountId && (!item || item.status !== 'sold' || expiredUids[item.uid] !== true)) {
      protectedAccountIds[accountId] = true;
    }
  });
  return protectedAccountIds;
}

function readSoldSheetRowEntries_(sheet, config) {
  var values = sheet.getDataRange().getValues();
  var rowMap = {};
  for (var index = 1; index < values.length; index += 1) {
    var accountId = normalizeAccountId_(values[index][config.accountIdColumn - 1]);
    if (!accountId) continue;
    if (!rowMap[accountId]) rowMap[accountId] = [];
    rowMap[accountId].push(index + 1);
  }
  return rowMap;
}

function groupDescendingRows_(rows) {
  var groups = [];
  rows.forEach(function (rowNumber) {
    var previous = groups[groups.length - 1];
    if (previous && previous.start === rowNumber + 1) {
      previous.start = rowNumber;
      previous.count += 1;
    } else {
      groups.push({ start: rowNumber, count: 1 });
    }
  });
  return groups;
}

function normalizeAccountId_(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function applySoldFormattingBatch(sheet, rowsByAccountId, soldItems, config) {
  if (typeof applyExistingSoldFormattingBatch === 'function') {
    return applyExistingSoldFormattingBatch(sheet, rowsByAccountId, soldItems, config);
  }
  throw new Error('applyExistingSoldFormattingBatch adapter must be supplied from the production SOLD formatter');
}

function logSoldReconcileError_(stage, error) {
  console.warn(JSON.stringify({
    event: 'hourlySoldReconcileError',
    stage: stage,
    message: safeErrorMessage_(error)
  }));
}

function safeErrorMessage_(error) {
  var message = error && error.message ? error.message : String(error || 'unknown error');
  return message
    .replace(/(auth|token|password|secret|key)=([^&\s]+)/gi, '$1=[redacted]')
    .replace(/\S+;\S+/g, '[redacted-credential]')
    .replace(/[A-Za-z0-9+/=_-]{20,}/g, '[redacted]')
    .slice(0, 240);
}
