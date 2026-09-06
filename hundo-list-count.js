(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.HundoListCount = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const normalizeParsingCopy = (value) => String(value ?? '')
        .replace(/[０-９]/g, digit => String(digit.charCodeAt(0) - 0xFF10))
        .replace(/＊/g, '*');

    const issue = (entry, index, reason = '數量格式未完成，請使用：蓋歐卡*2') => ({
        entry,
        index,
        message: reason
    });

    function parseHundoListCount(text) {
        const entries = String(text ?? '').split(/[,，\r\n]+/).map(value => value.trim()).filter(Boolean);
        let total = 0;
        const issues = [];

        entries.forEach((original, index) => {
            const value = normalizeParsingCopy(original);
            const markerPresent = /[*×]/.test(value);
            const match = value.match(/^(.*?)\s*[*×]\s*([0-9]+)\s*$/);
            let quantity = 1;

            if (markerPresent && !match) {
                issues.push(issue(original, index));
                return;
            }
            if (match) {
                if (!match[1].trim() || /[*×]/.test(match[1])) {
                    issues.push(issue(original, index, '數量前需要寶可夢名稱，例如：蓋歐卡*2'));
                    return;
                }
                quantity = Number(match[2]);
                if (!Number.isSafeInteger(quantity) || quantity <= 0) {
                    issues.push(issue(original, index, '數量必須是正整數，且不可超過安全整數範圍'));
                    return;
                }
            }
            if (!Number.isSafeInteger(total + quantity)) {
                issues.push(issue(original, index, '清單合計不可超過安全整數範圍'));
                return;
            }
            total += quantity;
        });

        return issues.length ? { valid: false, total: null, issues } : { valid: true, total, issues: [] };
    }

    function synchronizeHundoCount({ listInput, countInput, evidence = null, messageElement = null }) {
        const parsed = parseHundoListCount(listInput?.value);
        if (countInput) countInput.value = parsed.valid ? String(parsed.total) : '';
        if (listInput) {
            listInput.setAttribute?.('aria-invalid', parsed.valid ? 'false' : 'true');
            listInput.classList?.toggle('border-red-500', !parsed.valid);
        }
        if (messageElement) {
            let message = '';
            let kind = '';
            if (!parsed.valid) {
                message = parsed.issues[0]?.message || '數量格式未完成，請使用：蓋歐卡*2';
                kind = 'red';
            } else if (evidence?.conflicting) {
                message = '截圖總數證據互相衝突，請人工確認；清單合計仍以目前清單為準。';
                kind = 'amber';
            } else if (evidence && evidence.count !== parsed.total) {
                message = `截圖總數 ${evidence.count}，清單合計 ${parsed.total}，請確認是否漏列或已手動調整。`;
                kind = 'amber';
            }
            messageElement.textContent = message;
            messageElement.className = message
                ? `text-[10px] text-${kind}-700 mt-1`
                : 'hidden text-[10px] mt-1';
        }
        return parsed;
    }

    return { parseHundoListCount, synchronizeHundoCount, normalizeParsingCopy };
});
