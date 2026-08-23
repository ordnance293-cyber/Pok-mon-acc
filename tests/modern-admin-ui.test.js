'use strict';

const assert = require('assert');
const UI = require('../modern-admin-ui.js');

class FakeClassList {
  constructor(initial = '') {
    this.values = new Set(String(initial).split(/\s+/).filter(Boolean));
  }
  add(...tokens) { tokens.forEach(token => this.values.add(token)); }
  remove(...tokens) { tokens.forEach(token => this.values.delete(token)); }
  contains(token) { return this.values.has(token); }
  toggle(token, force) {
    if (force === true) { this.values.add(token); return true; }
    if (force === false) { this.values.delete(token); return false; }
    if (this.values.has(token)) { this.values.delete(token); return false; }
    this.values.add(token); return true;
  }
  toString() { return [...this.values].join(' '); }
}

function selectorMatches(element, selector) {
  if (!element || !selector) return false;
  if (selector.startsWith('#')) return element.id === selector.slice(1);
  const attrMatch = selector.match(/^([a-zA-Z0-9_-]+)?\[([^\]=*]+)(\*?=)?["']?([^\]"']*)["']?\]$/);
  if (attrMatch) {
    const [, tag, attr, operator, value] = attrMatch;
    if (tag && element.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    const actual = element.getAttribute(attr);
    if (!operator) return actual !== null;
    if (operator === '=') return actual === value;
    if (operator === '*=') return typeof actual === 'string' && actual.includes(value);
    return false;
  }
  return element.tagName.toLowerCase() === selector.toLowerCase();
}

class FakeElement {
  constructor(tagName = 'div', options = {}) {
    this.tagName = String(tagName).toUpperCase();
    this.id = options.id || '';
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.classList = new FakeClassList(options.className || '');
    this.dataset = {};
    this.style = {};
    this.textContent = options.textContent || '';
    this.innerHTML = '';
    this.listeners = new Map();
    this.hidden = false;
    this.type = '';
    if (this.id) this.attributes.set('id', this.id);
    Object.entries(options.attributes || {}).forEach(([key, value]) => this.setAttribute(key, value));
  }
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    this.children.push(child);
    child.parentNode = this;
    return child;
  }
  prepend(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    this.children.unshift(child);
    child.parentNode = this;
    return child;
  }
  insertBefore(child, reference) {
    if (!reference) return this.appendChild(child);
    if (child.parentNode) child.parentNode.removeChild(child);
    const index = this.children.indexOf(reference);
    if (index < 0) return this.appendChild(child);
    this.children.splice(index, 0, child);
    child.parentNode = this;
    return child;
  }
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name === 'id') this.id = stringValue;
    if (name === 'class') this.classList = new FakeClassList(stringValue);
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      this.dataset[key] = stringValue;
    }
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  addEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type, list);
  }
  dispatchEvent(event) {
    const evt = event || { type: '' };
    if (!evt.target) evt.target = this;
    (this.listeners.get(evt.type) || []).forEach(handler => handler.call(this, evt));
  }
  click() { this.dispatchEvent({ type: 'click', target: this }); }
  matches(selector) { return selectorMatches(this, selector); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const selectors = String(selector).split(',').map(item => item.trim()).filter(Boolean);
    const found = [];
    const visit = node => {
      node.children.forEach(child => {
        if (selectors.some(item => selectorMatches(child, item))) found.push(child);
        visit(child);
      });
    };
    visit(this);
    return found;
  }
  closest(selector) {
    let current = this;
    while (current) {
      if (selectorMatches(current, selector)) return current;
      current = current.parentNode;
    }
    return null;
  }
}

class FakeDocument extends FakeElement {
  constructor() {
    super('#document');
    this.readyState = 'complete';
    this.head = new FakeElement('head');
    this.body = new FakeElement('body');
    this.appendChild(this.head);
    this.appendChild(this.body);
  }
  createElement(tagName) { return new FakeElement(tagName); }
  getElementById(id) {
    if (this.id === id) return this;
    return this.querySelector(`#${id}`);
  }
  addEventListener() {}
}

function add(parent, tagName, options) {
  return parent.appendChild(new FakeElement(tagName, options));
}

function buildFixture() {
  const document = new FakeDocument();
  const header = add(document.body, 'header');
  add(header, 'h1', { textContent: '寶可夢進銷存 V94 極致旗艦版' });
  const systemSettings = add(header, 'div', { attributes: { 'aria-label': '系統連線設定' } });
  add(systemSettings, 'input', { id: 'googleSheetId' });
  add(systemSettings, 'input', { id: 'gasUrl' });
  add(systemSettings, 'input', { id: 'openaiApiKey' });
  add(systemSettings, 'button', { id: 'saveBtn' });

  const main = add(document.body, 'main');
  const page1 = add(main, 'div', { id: 'mainPage1' });
  const page1Header = add(page1, 'div');
  add(page1Header, 'h2', { textContent: '快速建檔區' });
  const page1Actions = add(page1Header, 'div');
  add(page1Actions, 'button', { attributes: { onclick: 'window.togglePage(3)' } });
  add(page1Actions, 'button', { attributes: { onclick: 'window.togglePage(2)' } });
  add(page1Actions, 'button', { id: 'submitBtn' });
  const form = add(page1, 'form', { id: 'pokeInputForm' });
  const accountCard = add(form, 'div');
  add(accountCard, 'input', { id: 'g_id' });
  const copyToolbar = add(form, 'div');
  add(copyToolbar, 'button');
  const workGrid = add(form, 'div');
  const resourceCard = add(workGrid, 'div');
  add(resourceCard, 'input', { id: 'st_old_poke' });
  const aiCard = add(workGrid, 'div');
  add(aiCard, 'input', { id: 'imageInput' });
  const basicCard = add(form, 'div');
  add(basicCard, 'input', { id: 'g_level' });

  const page2 = add(main, 'div', { id: 'mainPage2', className: 'hidden' });
  const page2Header = add(page2, 'div');
  add(page2Header, 'button', { attributes: { onclick: 'window.togglePage(1)' } });
  add(page2Header, 'button', { attributes: { onclick: 'window.togglePage(3)' } });

  const page3 = add(main, 'div', { id: 'simpleAccountPage', className: 'hidden' });
  const page3Section = add(page3, 'section');
  const page3Header = add(page3Section, 'div');
  add(page3Header, 'button', { attributes: { onclick: 'window.togglePage(1)' } });
  const page3Body = add(page3Section, 'div');
  const simpleSettings = add(page3Body, 'section', { attributes: { 'aria-label': '簡帳連線設定' } });
  add(simpleSettings, 'input', { id: 'simpleAccountSpreadsheetId' });
  add(simpleSettings, 'input', { id: 'simpleAccountGasUrl' });
  add(simpleSettings, 'input', { id: 'simpleAccountFulfillmentSecret' });
  add(simpleSettings, 'button', { id: 'saveSimpleAccountSettingsBtn' });
  const products = add(page3Body, 'section', { attributes: { 'aria-label': '簡帳商品' } });
  ['1百神', '2百神', '3百神', '無極汰那', 'Mega烈空坐'].forEach(product => {
    add(products, 'button', { attributes: { 'data-simple-account-product': product } });
  });

  const window = {
    document,
    togglePage(pageNumber) {
      page1.classList.toggle('hidden', pageNumber !== 1);
      page2.classList.toggle('hidden', pageNumber !== 2);
      page3.classList.toggle('hidden', pageNumber !== 3);
    },
    addEventListener() {}
  };

  return {
    document, window, page1, page2, page3, systemSettings, simpleSettings,
    accountCard, copyToolbar, workGrid, resourceCard, aiCard, basicCard, products
  };
}

function test(name, callback) {
  try {
    callback();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.stack || error}`);
    process.exitCode = 1;
  }
}

test('exposes the approved three-page modern admin contract', () => {
  assert.deepStrictEqual(UI.PAGE_DEFINITIONS.map(page => [page.number, page.label]), [
    [1, '快速建檔'],
    [2, '雲端清單'],
    [3, '簡帳出貨']
  ]);
  assert.match(UI.MODERN_ADMIN_STYLES, /--modern-primary:\s*#4f46e5/);
  assert.match(UI.MODERN_ADMIN_STYLES, /@media \(max-width: 767px\)/);
});

test('builds one compact shell and moves both settings groups into a closed drawer', () => {
  const fixture = buildFixture();
  const result = UI.bootstrap(fixture.document, fixture.window);

  assert.equal(result.initialized, true);
  assert.equal(fixture.document.body.classList.contains('modern-admin-ui'), true);
  assert.ok(fixture.document.getElementById('modernAdminNav'));
  assert.ok(fixture.document.getElementById('modernSettingsDrawer'));
  assert.equal(fixture.document.getElementById('modernSettingsDrawer').getAttribute('aria-hidden'), 'true');
  assert.equal(fixture.systemSettings.closest('#modernSettingsDrawer') !== null, true);
  assert.equal(fixture.simpleSettings.closest('#modernSettingsDrawer') !== null, true);
  assert.equal(fixture.document.getElementById('googleSheetId') !== null, true);
  assert.equal(fixture.document.getElementById('simpleAccountFulfillmentSecret') !== null, true);
});

test('keeps only the new top navigation visible and updates its active page', () => {
  const fixture = buildFixture();
  UI.bootstrap(fixture.document, fixture.window);

  const legacyButtons = fixture.document.querySelectorAll('button[data-modern-legacy-nav]');
  assert.equal(legacyButtons.length, 5);
  legacyButtons.forEach(button => assert.equal(button.hidden, true));

  fixture.window.togglePage(3);
  const active = fixture.document.querySelector('button[data-modern-page="3"]');
  assert.equal(active.getAttribute('aria-current'), 'page');
  assert.equal(fixture.page3.classList.contains('hidden'), false);
  assert.equal(fixture.page1.classList.contains('hidden'), true);
});

test('opens and closes system settings without changing field IDs', () => {
  const fixture = buildFixture();
  UI.bootstrap(fixture.document, fixture.window);

  const trigger = fixture.document.getElementById('modernSettingsTrigger');
  const drawer = fixture.document.getElementById('modernSettingsDrawer');
  trigger.click();
  assert.equal(drawer.getAttribute('aria-hidden'), 'false');
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');

  fixture.document.getElementById('modernSettingsClose').click();
  assert.equal(drawer.getAttribute('aria-hidden'), 'true');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.ok(fixture.document.getElementById('openaiApiKey'));
});

test('marks the existing work areas and product buttons without replacing functional elements', () => {
  const fixture = buildFixture();
  UI.bootstrap(fixture.document, fixture.window);

  assert.equal(fixture.accountCard.classList.contains('modern-account-card'), true);
  assert.equal(fixture.copyToolbar.classList.contains('modern-copy-toolbar'), true);
  assert.equal(fixture.workGrid.classList.contains('modern-work-grid'), true);
  assert.equal(fixture.resourceCard.classList.contains('modern-resource-card'), true);
  assert.equal(fixture.aiCard.classList.contains('modern-ai-card'), true);
  assert.equal(fixture.basicCard.classList.contains('modern-basic-card'), true);
  fixture.document.querySelectorAll('[data-simple-account-product]').forEach(button => {
    assert.equal(button.classList.contains('modern-product-button'), true);
  });
});

test('loads the modern admin enhancer from the existing browser helper without affecting Node exports', () => {
  const fs = require('fs');
  const source = fs.readFileSync(require.resolve('../simple-account-fulfillment-helpers.js'), 'utf8');
  assert.match(source, /data-modern-admin-ui-loader/);
  assert.match(source, /modern-admin-ui\.js/);
  assert.match(source, /typeof document === 'undefined'/);

  const helpers = require('../simple-account-fulfillment-helpers.js');
  assert.deepStrictEqual(helpers.PRODUCTS, ['1百神', '2百神', '3百神', '無極汰那', 'Mega烈空坐']);

  const vm = require('vm');
  const scripts = [];
  const document = {
    currentScript: { src: 'https://example.test/app/simple-account-fulfillment-helpers.js' },
    baseURI: 'https://example.test/app/',
    head: { appendChild(script) { scripts.push(script); } },
    querySelector(selector) {
      return selector === 'script[data-modern-admin-ui-loader]'
        ? scripts.find(script => script.attributes['data-modern-admin-ui-loader'] === 'true') || null
        : null;
    },
    createElement(tagName) {
      return {
        tagName,
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = String(value); }
      };
    }
  };
  const context = { document, URL, Uint8Array, console };
  context.window = context;
  vm.runInNewContext(source, context);
  vm.runInNewContext(source, context);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://example.test/app/modern-admin-ui.js');
  assert.equal(scripts[0].async, false);
});

test('is idempotent and does not create duplicate shell elements', () => {
  const fixture = buildFixture();
  UI.bootstrap(fixture.document, fixture.window);
  const second = UI.bootstrap(fixture.document, fixture.window);

  assert.equal(second.initialized, false);
  assert.equal(fixture.document.querySelectorAll('#modernAdminNav').length, 1);
  assert.equal(fixture.document.querySelectorAll('#modernSettingsDrawer').length, 1);
});
