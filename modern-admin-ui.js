(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ModernAdminUI = api;

  if (root && root.document) {
    const start = () => api.bootstrap(root.document, root);
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', () => root.setTimeout(start, 0), { once: true });
    } else {
      root.setTimeout(start, 0);
    }
  }
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  const PAGE_DEFINITIONS = Object.freeze([
    Object.freeze({ number: 1, label: '快速建檔', icon: '＋' }),
    Object.freeze({ number: 2, label: '雲端清單', icon: '▤' }),
    Object.freeze({ number: 3, label: '簡帳出貨', icon: '⚡' })
  ]);

  const MODERN_ADMIN_STYLES = `
body.modern-admin-ui {
  --modern-primary: #4f46e5;
  --modern-primary-dark: #4338ca;
  --modern-primary-soft: #eef2ff;
  --modern-success: #059669;
  --modern-danger: #dc2626;
  --modern-text: #172033;
  --modern-muted: #64748b;
  --modern-border: #e2e8f0;
  --modern-surface: #ffffff;
  --modern-canvas: #f5f7fb;
  --modern-shadow: 0 12px 34px rgba(15, 23, 42, 0.07);
  --modern-shadow-soft: 0 4px 18px rgba(15, 23, 42, 0.05);
  background: var(--modern-canvas) !important;
  color: var(--modern-text) !important;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body.modern-admin-ui.modern-settings-open {
  overflow: hidden;
}

body.modern-admin-ui > header.modern-app-header {
  position: sticky !important;
  top: 0;
  z-index: 120 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 18px !important;
  min-height: 72px;
  padding: 12px 24px !important;
  border: 0 !important;
  border-bottom: 1px solid rgba(226, 232, 240, 0.9) !important;
  background: rgba(255, 255, 255, 0.94) !important;
  box-shadow: 0 8px 26px rgba(15, 23, 42, 0.055) !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

body.modern-admin-ui > header.modern-app-header > h1 {
  flex: 0 0 auto;
  margin: 0 !important;
  color: #312e81 !important;
  font-size: 19px !important;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.modern-header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  min-width: 0;
}

.modern-admin-nav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--modern-border);
  border-radius: 14px;
  background: #f8fafc;
}

.modern-nav-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  padding: 8px 14px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #64748b;
  font-size: 13px;
  font-weight: 750;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color .18s ease, color .18s ease, box-shadow .18s ease, transform .18s ease;
}

.modern-nav-button:hover {
  color: #3730a3;
  background: #eef2ff;
}

.modern-nav-button[aria-current="page"] {
  color: #fff;
  background: var(--modern-primary);
  box-shadow: 0 7px 16px rgba(79, 70, 229, 0.24);
}

.modern-settings-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 46px;
  padding: 10px 15px;
  border: 1px solid var(--modern-border);
  border-radius: 13px;
  color: #334155;
  background: #fff;
  font-size: 13px;
  font-weight: 750;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.045);
  cursor: pointer;
  transition: border-color .18s ease, color .18s ease, transform .18s ease, box-shadow .18s ease;
}

.modern-settings-trigger:hover {
  color: #3730a3;
  border-color: #a5b4fc;
  box-shadow: 0 8px 18px rgba(79, 70, 229, 0.11);
  transform: translateY(-1px);
}

body.modern-admin-ui main {
  width: 100%;
  max-width: 1480px !important;
  margin: 0 auto;
  padding: 24px 24px 56px !important;
}

body.modern-admin-ui #mainPage1,
body.modern-admin-ui #mainPage2,
body.modern-admin-ui #simpleAccountPage > section {
  border: 1px solid var(--modern-border) !important;
  border-radius: 20px !important;
  background: var(--modern-surface) !important;
  box-shadow: var(--modern-shadow) !important;
}

body.modern-admin-ui #mainPage1 {
  padding: 20px !important;
  margin-bottom: 26px !important;
}

.modern-page-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 16px !important;
  margin: 0 0 18px !important;
  padding: 0 0 16px !important;
  border-bottom: 1px solid var(--modern-border) !important;
  background: transparent !important;
}

.modern-page-header h2,
.modern-page-header span.text-indigo-900 {
  color: var(--modern-text) !important;
  font-size: 18px !important;
  letter-spacing: -0.015em;
}

.modern-page-header > div:last-child {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px !important;
  flex-wrap: wrap;
}

button[data-modern-legacy-nav] {
  display: none !important;
}

body.modern-admin-ui #submitBtn {
  min-height: 42px;
  padding: 9px 18px !important;
  border: 0 !important;
  border-radius: 11px !important;
  color: #fff !important;
  background: var(--modern-primary) !important;
  box-shadow: 0 8px 18px rgba(79, 70, 229, .23) !important;
}

body.modern-admin-ui #submitBtn:hover {
  background: var(--modern-primary-dark) !important;
}

body.modern-admin-ui #cancelEditBtn,
body.modern-admin-ui button[onclick*="resetForm"]:not(#submitBtn) {
  min-height: 42px;
  padding: 9px 14px !important;
  border: 1px solid var(--modern-border) !important;
  border-radius: 11px !important;
  color: #475569 !important;
  background: #fff !important;
  box-shadow: none !important;
}

body.modern-admin-ui #pokeInputForm {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

body.modern-admin-ui #pokeInputForm > * {
  margin-top: 0 !important;
}

.modern-account-card,
.modern-resource-card,
.modern-ai-card,
.modern-basic-card,
.modern-secondary-card {
  border: 1px solid var(--modern-border) !important;
  border-radius: 16px !important;
  background: #fff !important;
  box-shadow: var(--modern-shadow-soft) !important;
}

.modern-account-card {
  padding: 16px !important;
  background: linear-gradient(135deg, #ffffff 0%, #f8faff 100%) !important;
  border-color: #dbe3ff !important;
}

.modern-account-card > label {
  margin-bottom: 10px !important;
  padding-bottom: 8px !important;
  border-color: #dbe3ff !important;
  color: #3730a3 !important;
}

.modern-copy-toolbar {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  flex-wrap: wrap !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.modern-copy-toolbar button {
  min-height: 34px;
  padding: 7px 11px !important;
  border: 1px solid #d9def0 !important;
  border-radius: 9px !important;
  color: #4f46e5 !important;
  background: #fff !important;
  box-shadow: none !important;
}

.modern-copy-toolbar button:hover {
  border-color: #a5b4fc !important;
  background: #eef2ff !important;
}

.modern-work-grid,
.modern-secondary-grid {
  display: grid !important;
  grid-template-columns: minmax(0, .94fr) minmax(0, 1.06fr) !important;
  gap: 16px !important;
}

.modern-resource-card,
.modern-ai-card,
.modern-basic-card,
.modern-secondary-card {
  padding: 16px !important;
}

.modern-resource-card > label,
.modern-ai-card > label,
.modern-basic-card > label,
.modern-secondary-card > label {
  margin-bottom: 4px !important;
  padding-bottom: 10px !important;
  border-color: var(--modern-border) !important;
  color: #334155 !important;
}

.modern-resource-card > label i,
.modern-ai-card > label i {
  color: var(--modern-primary) !important;
}

.modern-resource-card > div {
  gap: 10px !important;
}

.modern-ai-card > div:first-of-type {
  border-color: #cbd5e1 !important;
  background: #f8fafc !important;
}

body.modern-admin-ui #aiAutoBtn {
  min-height: 42px;
  border: 0 !important;
  border-radius: 11px !important;
  background: var(--modern-primary) !important;
  box-shadow: 0 8px 18px rgba(79, 70, 229, .2) !important;
}

body.modern-admin-ui #aiAutoBtn:hover {
  background: var(--modern-primary-dark) !important;
}

body.modern-admin-ui input:not([type="checkbox"]):not([type="radio"]),
body.modern-admin-ui select,
body.modern-admin-ui textarea {
  border: 1px solid #d9e0ea !important;
  border-radius: 10px !important;
  background: #fff !important;
  color: #1e293b !important;
  box-shadow: none !important;
  transition: border-color .16s ease, box-shadow .16s ease, background-color .16s ease;
}

body.modern-admin-ui input:not([type="checkbox"]):not([type="radio"]):focus,
body.modern-admin-ui select:focus,
body.modern-admin-ui textarea:focus {
  outline: none !important;
  border-color: #818cf8 !important;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, .12) !important;
}

body.modern-admin-ui input[type="checkbox"] {
  accent-color: var(--modern-primary);
}

body.modern-admin-ui #g_id {
  min-height: 48px;
  padding: 11px 13px !important;
  font-size: 15px !important;
}

body.modern-admin-ui #g_price {
  border-color: #f3d28a !important;
  background: #fffaf0 !important;
}

body.modern-admin-ui #g_item_status {
  border-color: #a7dfca !important;
  background: #f0fdf8 !important;
}

body.modern-admin-ui #mainPage2 {
  overflow: hidden;
  margin-top: 0 !important;
}

body.modern-admin-ui #mainPage2 > .modern-page-header {
  margin: 0 !important;
  padding: 16px 18px !important;
  background: #fff !important;
}

body.modern-admin-ui #mainPage2 table thead {
  background: #f8fafc !important;
}

body.modern-admin-ui #mainPage2 table th {
  color: #64748b;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .055em;
}

body.modern-admin-ui #simpleAccountPage {
  margin-top: 0 !important;
}

body.modern-admin-ui #simpleAccountPage > section {
  overflow: hidden;
}

body.modern-admin-ui #simpleAccountPage .modern-page-header {
  margin: 0 !important;
  padding: 17px 20px !important;
  background: #fff !important;
}

body.modern-admin-ui #simpleAccountPage .modern-page-header h2 {
  color: #1e293b !important;
}

body.modern-admin-ui #simpleAccountPage .modern-page-header p {
  color: #64748b !important;
}

body.modern-admin-ui #simpleAccountPage > section > div:last-child {
  padding: 20px !important;
}

body.modern-admin-ui #simpleAccountFulfillmentStatus {
  border: 1px solid #fde3a7 !important;
  border-radius: 12px !important;
  background: #fffbeb !important;
  color: #92400e !important;
}

.modern-product-grid {
  gap: 12px !important;
}

.modern-product-button {
  position: relative;
  min-height: 78px;
  padding: 16px !important;
  border: 1px solid transparent !important;
  border-radius: 14px !important;
  color: #fff !important;
  background: linear-gradient(135deg, var(--modern-primary), var(--modern-primary-dark)) !important;
  box-shadow: 0 9px 20px rgba(79, 70, 229, .19) !important;
  font-size: 14px !important;
  letter-spacing: .01em;
  transform: none !important;
}

.modern-product-button:hover {
  border-color: #c7d2fe !important;
  box-shadow: 0 13px 25px rgba(79, 70, 229, .25) !important;
  transform: translateY(-2px) !important;
}

.modern-product-button:disabled {
  color: #94a3b8 !important;
  background: #e2e8f0 !important;
  box-shadow: none !important;
}

.modern-settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 290;
  visibility: hidden;
  opacity: 0;
  background: rgba(15, 23, 42, .42);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  transition: opacity .22s ease, visibility .22s ease;
}

.modern-settings-drawer {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 300;
  display: flex;
  flex-direction: column;
  width: min(460px, 92vw);
  height: 100dvh;
  border-left: 1px solid var(--modern-border);
  background: #fff;
  box-shadow: -22px 0 54px rgba(15, 23, 42, .16);
  transform: translateX(102%);
  transition: transform .24s ease;
}

body.modern-settings-open .modern-settings-overlay {
  visibility: visible;
  opacity: 1;
}

body.modern-settings-open .modern-settings-drawer {
  transform: translateX(0);
}

.modern-settings-drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  border-bottom: 1px solid var(--modern-border);
}

.modern-settings-drawer-header h2 {
  margin: 0;
  color: #1e293b;
  font-size: 18px;
  font-weight: 800;
}

.modern-settings-drawer-header p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.55;
}

.modern-settings-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border: 1px solid var(--modern-border);
  border-radius: 10px;
  color: #475569;
  background: #fff;
  font-size: 21px;
  cursor: pointer;
}

.modern-settings-drawer-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px 20px 28px;
  overflow-y: auto;
}

.modern-settings-section {
  padding: 16px;
  border: 1px solid var(--modern-border);
  border-radius: 14px;
  background: #f8fafc;
}

.modern-settings-section-title {
  margin: 0 0 3px;
  color: #1e293b;
  font-size: 14px;
  font-weight: 800;
}

.modern-settings-section-note {
  margin: 0 0 14px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.5;
}

#modernSettingsDrawer [aria-label="系統連線設定"] {
  display: grid !important;
  grid-template-columns: 1fr !important;
  align-items: stretch !important;
  gap: 13px !important;
  width: 100% !important;
}

#modernSettingsDrawer [aria-label="系統連線設定"] > div {
  width: 100% !important;
}

#modernSettingsDrawer [aria-label="系統連線設定"] label,
#modernSettingsDrawer [aria-label="簡帳連線設定"] label {
  color: #475569 !important;
  font-size: 11px !important;
}

#modernSettingsDrawer [aria-label="系統連線設定"] p,
#modernSettingsDrawer [aria-label="簡帳連線設定"] p {
  color: #64748b !important;
}

#modernSettingsDrawer [aria-label="簡帳連線設定"] {
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
}

#modernSettingsDrawer [aria-label="簡帳連線設定"] > h3 {
  display: none;
}

#modernSettingsDrawer [aria-label="簡帳連線設定"] > div {
  display: grid !important;
  grid-template-columns: 1fr !important;
  gap: 13px !important;
}

#modernSettingsDrawer #saveBtn,
#modernSettingsDrawer #saveSimpleAccountSettingsBtn {
  width: 100%;
  min-height: 42px;
  margin-top: 2px !important;
  border: 0 !important;
  border-radius: 10px !important;
  color: #fff !important;
  background: var(--modern-primary) !important;
  box-shadow: none !important;
}

@media (max-width: 1023px) {
  body.modern-admin-ui > header.modern-app-header {
    align-items: stretch !important;
    flex-direction: column !important;
    gap: 10px !important;
    padding: 10px 16px !important;
  }

  .modern-header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .modern-admin-nav {
    max-width: calc(100vw - 110px);
    overflow-x: auto;
  }

  .modern-work-grid,
  .modern-secondary-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 767px) {
  body.modern-admin-ui > header.modern-app-header {
    padding: 9px 12px !important;
  }

  body.modern-admin-ui > header.modern-app-header > h1 {
    font-size: 16px !important;
    white-space: normal;
  }

  .modern-header-actions {
    gap: 8px;
  }

  .modern-admin-nav {
    flex: 1 1 auto;
    max-width: none;
  }

  .modern-nav-button {
    flex: 1 0 auto;
    min-height: 36px;
    padding: 7px 10px;
    font-size: 12px;
  }

  .modern-settings-trigger {
    width: 42px;
    min-height: 42px;
    padding: 8px;
    font-size: 0;
  }

  .modern-settings-trigger::before {
    content: "⚙";
    font-size: 18px;
  }

  body.modern-admin-ui main {
    padding: 12px 10px 42px !important;
  }

  body.modern-admin-ui #mainPage1 {
    padding: 14px !important;
    border-radius: 16px !important;
  }

  .modern-page-header {
    align-items: stretch !important;
    flex-direction: column !important;
    gap: 10px !important;
  }

  .modern-page-header > div:last-child {
    justify-content: stretch;
  }

  .modern-page-header > div:last-child > button:not([hidden]) {
    flex: 1 1 auto;
  }

  .modern-account-card,
  .modern-resource-card,
  .modern-ai-card,
  .modern-basic-card,
  .modern-secondary-card {
    padding: 13px !important;
    border-radius: 14px !important;
  }

  .modern-copy-toolbar {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .modern-copy-toolbar button {
    width: 100%;
  }

  .modern-product-grid {
    grid-template-columns: 1fr !important;
  }

  .modern-product-button {
    min-height: 64px;
  }

  .modern-settings-drawer {
    width: 100%;
    max-width: none;
  }
}
`;

  function toArray(collection) {
    return collection ? Array.from(collection) : [];
  }

  function addClasses(element, classNames) {
    if (!element || !element.classList) return element;
    String(classNames || '').split(/\s+/).filter(Boolean).forEach(className => element.classList.add(className));
    return element;
  }

  function createElement(documentLike, tagName, options = {}) {
    const element = documentLike.createElement(tagName);
    if (options.id) element.setAttribute('id', options.id);
    if (options.className) addClasses(element, options.className);
    if (options.text !== undefined) element.textContent = String(options.text);
    Object.entries(options.attributes || {}).forEach(([name, value]) => element.setAttribute(name, value));
    if (options.type) {
      element.type = options.type;
      element.setAttribute('type', options.type);
    }
    return element;
  }

  function nodeContains(root, target) {
    if (!root || !target) return false;
    if (root === target) return true;
    return toArray(root.children).some(child => nodeContains(child, target));
  }

  function findDirectChildContaining(parent, target) {
    if (!parent || !target) return null;
    let current = target;
    while (current && current.parentNode && current.parentNode !== parent) current = current.parentNode;
    return current && current.parentNode === parent ? current : null;
  }

  function findPairedGridChild(anchor, pairedAnchor, boundary) {
    if (!anchor || !pairedAnchor) return null;
    let current = anchor;
    while (current && current.parentNode && current.parentNode !== boundary) {
      if (nodeContains(current.parentNode, pairedAnchor)) return current;
      current = current.parentNode;
    }
    return null;
  }

  function getNextElementSibling(element) {
    if (!element || !element.parentNode) return null;
    if (element.nextElementSibling) return element.nextElementSibling;
    const siblings = toArray(element.parentNode.children);
    const index = siblings.indexOf(element);
    return index >= 0 ? siblings[index + 1] || null : null;
  }

  function firstChild(element) {
    return element && element.children ? element.children[0] || null : null;
  }

  function findPageHeader(page, pageNumber) {
    if (!page) return null;
    if (pageNumber === 3) return firstChild(firstChild(page));
    return firstChild(page);
  }

  function detectVisiblePage(documentLike) {
    for (const page of PAGE_DEFINITIONS) {
      const id = page.number === 1 ? 'mainPage1' : page.number === 2 ? 'mainPage2' : 'simpleAccountPage';
      const element = documentLike.getElementById(id);
      if (element && (!element.classList || !element.classList.contains('hidden'))) return page.number;
    }
    return 1;
  }

  function updateActiveNavigation(documentLike, pageNumber) {
    toArray(documentLike.querySelectorAll('[data-modern-page]')).forEach(button => {
      const active = button.getAttribute('data-modern-page') === String(pageNumber);
      button.setAttribute('aria-current', active ? 'page' : 'false');
      if (button.classList) button.classList.toggle('is-active', active);
    });
  }

  function setSettingsOpen(documentLike, open) {
    const body = documentLike.body;
    const drawer = documentLike.getElementById('modernSettingsDrawer');
    const trigger = documentLike.getElementById('modernSettingsTrigger');
    if (!body || !drawer || !trigger) return false;
    body.classList.toggle('modern-settings-open', Boolean(open));
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    return true;
  }

  function createSettingsSection(documentLike, title, note) {
    const section = createElement(documentLike, 'section', { className: 'modern-settings-section' });
    section.appendChild(createElement(documentLike, 'h3', {
      className: 'modern-settings-section-title',
      text: title
    }));
    section.appendChild(createElement(documentLike, 'p', {
      className: 'modern-settings-section-note',
      text: note
    }));
    return section;
  }

  function buildSettingsDrawer(documentLike, systemSettings, simpleSettings) {
    const overlay = createElement(documentLike, 'div', {
      id: 'modernSettingsOverlay',
      className: 'modern-settings-overlay',
      attributes: { 'aria-hidden': 'true' }
    });
    const drawer = createElement(documentLike, 'aside', {
      id: 'modernSettingsDrawer',
      className: 'modern-settings-drawer',
      attributes: {
        'aria-hidden': 'true',
        'aria-label': '系統設定',
        role: 'dialog'
      }
    });
    const header = createElement(documentLike, 'div', { className: 'modern-settings-drawer-header' });
    const titleBlock = createElement(documentLike, 'div');
    titleBlock.appendChild(createElement(documentLike, 'h2', { text: '系統設定' }));
    titleBlock.appendChild(createElement(documentLike, 'p', {
      text: '連線資料預設收起，需要修改時再開啟。'
    }));
    const closeButton = createElement(documentLike, 'button', {
      id: 'modernSettingsClose',
      className: 'modern-settings-close',
      text: '×',
      type: 'button',
      attributes: { 'aria-label': '關閉系統設定' }
    });
    header.appendChild(titleBlock);
    header.appendChild(closeButton);

    const body = createElement(documentLike, 'div', { className: 'modern-settings-drawer-body' });
    if (systemSettings) {
      const section = createSettingsSection(
        documentLike,
        '進銷存與 AI 連線',
        '設定試算表、Apps Script 與 OpenAI API Key。'
      );
      section.appendChild(systemSettings);
      body.appendChild(section);
    }
    if (simpleSettings) {
      const section = createSettingsSection(
        documentLike,
        '簡帳自動出貨連線',
        '設定簡帳試算表、獨立 Apps Script 與出貨密鑰。'
      );
      section.appendChild(simpleSettings);
      body.appendChild(section);
    }

    drawer.appendChild(header);
    drawer.appendChild(body);
    return { overlay, drawer, closeButton };
  }

  function buildHeaderNavigation(documentLike, windowLike) {
    const actions = createElement(documentLike, 'div', {
      id: 'modernHeaderActions',
      className: 'modern-header-actions'
    });
    const nav = createElement(documentLike, 'nav', {
      id: 'modernAdminNav',
      className: 'modern-admin-nav',
      attributes: { 'aria-label': '主要頁面' }
    });

    PAGE_DEFINITIONS.forEach(page => {
      const button = createElement(documentLike, 'button', {
        className: 'modern-nav-button',
        text: `${page.icon} ${page.label}`,
        type: 'button',
        attributes: { 'data-modern-page': String(page.number), 'aria-current': 'false' }
      });
      button.addEventListener('click', () => {
        if (windowLike && typeof windowLike.togglePage === 'function') windowLike.togglePage(page.number);
      });
      nav.appendChild(button);
    });

    const settingsButton = createElement(documentLike, 'button', {
      id: 'modernSettingsTrigger',
      className: 'modern-settings-trigger',
      text: '⚙ 系統設定',
      type: 'button',
      attributes: { 'aria-expanded': 'false', 'aria-controls': 'modernSettingsDrawer' }
    });
    actions.appendChild(nav);
    actions.appendChild(settingsButton);
    return { actions, nav, settingsButton };
  }

  function markPageRegions(documentLike) {
    const page1 = documentLike.getElementById('mainPage1');
    const page2 = documentLike.getElementById('mainPage2');
    const page3 = documentLike.getElementById('simpleAccountPage');
    [
      [page1, 1],
      [page2, 2],
      [page3, 3]
    ].forEach(([page, number]) => addClasses(findPageHeader(page, number), 'modern-page-header'));

    const form = documentLike.getElementById('pokeInputForm');
    if (form) {
      const accountInput = documentLike.getElementById('g_id');
      const accountCard = findDirectChildContaining(form, accountInput);
      addClasses(accountCard, 'modern-account-card');
      addClasses(getNextElementSibling(accountCard), 'modern-copy-toolbar');

      const resourceAnchor = documentLike.getElementById('st_old_poke');
      const aiAnchor = documentLike.getElementById('imageInput');
      const resourceCard = findPairedGridChild(resourceAnchor, aiAnchor, form);
      const aiCard = findPairedGridChild(aiAnchor, resourceAnchor, form);
      addClasses(resourceCard, 'modern-resource-card');
      addClasses(aiCard, 'modern-ai-card');
      if (resourceCard && resourceCard.parentNode === (aiCard && aiCard.parentNode)) {
        addClasses(resourceCard.parentNode, 'modern-work-grid');
      }

      const basicCard = findDirectChildContaining(form, documentLike.getElementById('g_level'));
      addClasses(basicCard, 'modern-basic-card');

      const specialAnchor = documentLike.getElementById('chk_sp_1');
      const megaAnchor = documentLike.getElementById('chk_kyurem');
      const specialCard = findPairedGridChild(specialAnchor, megaAnchor, form);
      const megaCard = findPairedGridChild(megaAnchor, specialAnchor, form);
      addClasses(specialCard, 'modern-secondary-card');
      addClasses(megaCard, 'modern-secondary-card');
      if (specialCard && specialCard.parentNode === (megaCard && megaCard.parentNode)) {
        addClasses(specialCard.parentNode, 'modern-secondary-grid');
      }
    }

    const productGrid = documentLike.querySelector('[aria-label="簡帳商品"]');
    addClasses(productGrid, 'modern-product-grid');
    toArray(documentLike.querySelectorAll('[data-simple-account-product]')).forEach(button => {
      addClasses(button, 'modern-product-button');
    });
  }

  function hideLegacyNavigation(documentLike) {
    toArray(documentLike.querySelectorAll('button[onclick*="togglePage"]')).forEach(button => {
      button.setAttribute('data-modern-legacy-nav', 'true');
      button.hidden = true;
    });
  }

  function wrapTogglePage(documentLike, windowLike) {
    if (!windowLike || typeof windowLike.togglePage !== 'function') return;
    if (windowLike.togglePage.__modernAdminWrapped) return;
    const originalTogglePage = windowLike.togglePage;
    const wrapped = function modernTogglePage(pageNumber) {
      const result = originalTogglePage.apply(this, arguments);
      updateActiveNavigation(documentLike, pageNumber);
      return result;
    };
    wrapped.__modernAdminWrapped = true;
    wrapped.__modernAdminOriginal = originalTogglePage;
    windowLike.togglePage = wrapped;
  }

  function bootstrap(documentLike, windowLike) {
    if (!documentLike || !documentLike.body || !documentLike.head) return { initialized: false, reason: 'missing_document' };
    if (documentLike.body.classList.contains('modern-admin-ui-initialized')) {
      return { initialized: false, reason: 'already_initialized' };
    }

    const header = documentLike.querySelector('header');
    const main = documentLike.querySelector('main');
    if (!header || !main) return { initialized: false, reason: 'missing_shell' };

    documentLike.body.classList.add('modern-admin-ui', 'modern-admin-ui-initialized');
    addClasses(header, 'modern-app-header');

    if (!documentLike.getElementById('modernAdminStyles')) {
      const style = createElement(documentLike, 'style', { id: 'modernAdminStyles' });
      style.textContent = MODERN_ADMIN_STYLES;
      documentLike.head.appendChild(style);
    }

    const systemSettings = documentLike.querySelector('[aria-label="系統連線設定"]');
    const simpleSettings = documentLike.querySelector('[aria-label="簡帳連線設定"]');
    const { overlay, drawer, closeButton } = buildSettingsDrawer(documentLike, systemSettings, simpleSettings);
    documentLike.body.appendChild(overlay);
    documentLike.body.appendChild(drawer);

    const { actions, settingsButton } = buildHeaderNavigation(documentLike, windowLike);
    header.appendChild(actions);

    settingsButton.addEventListener('click', () => {
      const currentlyOpen = drawer.getAttribute('aria-hidden') === 'false';
      setSettingsOpen(documentLike, !currentlyOpen);
    });
    closeButton.addEventListener('click', () => setSettingsOpen(documentLike, false));
    overlay.addEventListener('click', () => setSettingsOpen(documentLike, false));
    if (documentLike.addEventListener) {
      documentLike.addEventListener('keydown', event => {
        if (event && event.key === 'Escape') setSettingsOpen(documentLike, false);
      });
    }

    hideLegacyNavigation(documentLike);
    markPageRegions(documentLike);
    wrapTogglePage(documentLike, windowLike);
    updateActiveNavigation(documentLike, detectVisiblePage(documentLike));
    setSettingsOpen(documentLike, false);

    return {
      initialized: true,
      header,
      main,
      drawer,
      overlay
    };
  }

  return Object.freeze({
    PAGE_DEFINITIONS,
    MODERN_ADMIN_STYLES,
    detectVisiblePage,
    updateActiveNavigation,
    setSettingsOpen,
    bootstrap
  });
}));
