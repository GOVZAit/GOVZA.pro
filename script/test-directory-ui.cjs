/* Run against the production frontend build with isolated HTTP fixtures. No production API is contacted.
   UI_FIXTURES=/tmp/fixtures.json UI_REPORT=/tmp/ui PLAYWRIGHT_MODULE=/path/to/playwright node script/test-directory-ui.cjs */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const engines = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.UI_BROWSER || 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine), 'Unsupported test browser');
const fixture = JSON.parse(fs.readFileSync(process.env.UI_FIXTURES, 'utf8'));
const output = process.env.UI_REPORT || '/tmp/govza-ui-report';
fs.mkdirSync(output, { recursive: true });
const root = path.resolve('dist/public');
const results = []; let browser;
const features = require('../shared/product-features.json');
const server = http.createServer((req, res) => {
  let target = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!target.startsWith(root + path.sep) && target !== root) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) target = path.join(root, 'index.html');
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
  res.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream'); fs.createReadStream(target).pipe(res);
});
async function check(name, fn) {
  try { await fn(); results.push({ name, status: 'passed' }); console.log('PASS', name); }
  catch (error) { results.push({ name, status: 'failed', error: error.message }); console.error('FAIL', name, error.message); }
}
async function context(signedIn = false, dark = false, role = 'client') {
  const ctx = await browser.newContext({ serviceWorkers: 'block', colorScheme: dark ? 'dark' : 'light' });
  const state = { favorites: [], posts: [], failRequest: false, failMessage: false };
  await ctx.addInitScript(({ dark }) => {
    localStorage.setItem('welcome-onboarding-seen', '1');
    localStorage.setItem('govza-install-dismissed-at', String(Date.now()));
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, { dark });
  await ctx.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname, q = url.searchParams;
    // Allow the existing public font assets; all external app/API traffic is blocked.
    if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return route.continue();
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (!p.startsWith('/api/')) return route.continue();
    let data = [], status = 200;
    if (req.method() !== 'GET') {
      state.posts.push({ path: p, method: req.method(), body: req.postDataJSON() });
      if (p === '/api/auth/login') {
        signedIn = true;
        data = { user: { id: 901, name: 'Тестовый клиент', role: 'client', email: 'fixture@example.invalid' } };
      } else if (p.startsWith('/api/favorites/')) {
        const id = Number(p.split('/').at(-1)); state.favorites = req.method() === 'DELETE' ? state.favorites.filter(x => x !== id) : [...state.favorites, id];
        data = {};
      } else if (p === '/api/requests') { status = state.failRequest ? 500 : 200; data = { id: 991 }; }
      else if (p.startsWith('/api/messages/')) { status = state.failMessage ? 500 : 200; data = {}; }
      else data = {};
    } else if (p === '/api/auth/me') data = { user: signedIn ? { id: 901, name: 'Тестовый клиент', role, email: 'fixture@example.invalid' } : null };
    else if (p === '/api/masters') data = fixture.masters;
    else if (p === '/api/categories') data = fixture.categories;
    else if (p === '/api/directory/doctors') data = fixture.doctors;
    else if (p === '/api/catalog/availability-today') data = { providers: {} };
    else if (p === '/api/favorites') data = state.favorites;
    else if (p === '/api/order-reviews/mine') data = { orderIds: [] };
    else if (p.includes('count')) data = { count: 0 };
    else if (p === '/api/auto-parts/suppliers') {
      data = fixture.suppliers.filter(s => s.supplierType === q.get('type'));
      if (q.has('city')) data = data.filter(s => s.city === q.get('city'));
      if (q.has('q')) data = data.filter(s => s.name.toLowerCase().includes(q.get('q').toLowerCase()));
      if (q.has('brand')) data = data.filter(s => s.brands.some(b => b.toLowerCase().includes(q.get('brand').toLowerCase())));
      if (q.has('condition')) data = data.filter(s => [q.get('condition'), 'mixed'].includes(s.partsCondition));
      if (q.has('vehicleType')) data = data.filter(s => s.vehicleTypes.includes(q.get('vehicleType')));
      if (q.has('vehicleOrigin')) data = data.filter(s => s.vehicleOrigins.includes(q.get('vehicleOrigin')));
    }
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return { ctx, state };
}
(async () => {
  await new Promise(resolve => server.listen(4174, '127.0.0.1', resolve));
  browser = await engines[engine].launch({ headless: true });
  const { ctx } = await context();
  const page = await ctx.newPage(); page.setDefaultTimeout(5000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const pages = [['/', 'masters'], ['/doctors', 'doctors'], ['/organizations', 'organizations'], ['/organizations?kind=medical', 'clinics'], ['/auto-parts', features.autoParts ? 'parts' : 'parts-paused'], ['/more', 'more'], ['/profile', 'profile']];
  const sizes = [[320, 720], [390, 844], [430, 932], [768, 1024], [1024, 768], [1440, 1000]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const [url, label] of pages) await check(`${label}: ${width}px layout`, async () => {
      await page.goto(`http://127.0.0.1:4174${url}`);
      await page.locator('.directory-title-row h1').waitFor(); await page.waitForTimeout(450);
      await page.screenshot({ animations: 'disabled', path: `${output}/${label}-${width}.png` });
      const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
      assert.ok(dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions));
      if (label !== 'more' && label !== 'profile' && label !== 'parts-paused') {
        const box = await page.locator('.directory-search').boundingBox(); assert.equal(Math.round(box.height), 52);
        const inputSize = await page.locator('.directory-search input').evaluate(el => parseFloat(getComputedStyle(el).fontSize)); assert.ok(inputSize >= 16);
      }
      if (width < 1024) {
        const nav = await page.locator('.primary-bottom-nav').boundingBox(); assert.ok(Math.abs(nav.y + nav.height - height) < 2, `nav: ${JSON.stringify(nav)}`);
        if (label === 'parts') { await page.evaluate(() => scrollTo(0, 1600)); await page.waitForTimeout(200);
          const moved = await page.locator('.primary-bottom-nav').boundingBox(); assert.ok(Math.abs(moved.y + moved.height - height) < 2, 'Navigation moves with document'); }
      }
    });
  }
  for (const width of [390, 844, 1440]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
    for (const [url, id, label] of [['/', 'button-filter', 'masters'], ['/doctors', 'button-doctor-filters', 'doctors'], ...(features.autoParts ? [['/auto-parts', 'auto-parts-filters', 'parts']] : [])]) await check(`${label}: ${width}px filter panel`, async () => {
      await page.goto(`http://127.0.0.1:4174${url}`); await page.getByTestId(id).click();
      const dialog = page.getByRole('dialog'); await dialog.waitFor(); await page.waitForTimeout(250);
      await page.screenshot({ animations: 'disabled', path: `${output}/${label}-filter-${width}.png` });
      assert.equal(await dialog.evaluate(el => getComputedStyle(el).opacity), "1", "Panel must be fully opaque after opening");
      const box = await dialog.boundingBox(); const size = page.viewportSize();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width + 1 && box.y + box.height <= size.height + 1, JSON.stringify(box));
      if (width >= 720) assert.equal(Math.round(box.width), 420);
      const footer = await dialog.locator('.govza-panel-footer').boundingBox(); assert.ok(footer.y + footer.height <= size.height + 1);
      await dialog.locator('.govza-panel-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
      const after = await dialog.locator('.govza-panel-footer').boundingBox(); assert.equal(Math.round(after.y), Math.round(footer.y));
      for (let i = 0; i < 18; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => Boolean(document.activeElement.closest('[role=dialog]'))), 'Focus escaped modal'); }
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      await page.waitForFunction(expected => document.activeElement?.dataset.testid === expected, id, { timeout: 2000 });
      assert.equal(await page.evaluate(() => document.activeElement.dataset.testid), id);
    });
  }
  await check('doctor filters: Cancel discards and Apply commits', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto('http://127.0.0.1:4174/doctors');
    await page.getByTestId('button-doctor-filters').click(); await page.getByTestId('doctor-filter-children').click(); await page.keyboard.press('Escape');
    await page.getByTestId('button-doctor-filters').click(); assert.equal(await page.getByTestId('doctor-filter-children').getAttribute('aria-pressed'), 'false');
    await page.getByTestId('doctor-filter-children').click(); await page.getByTestId('doctor-filter-apply').click();
    assert.equal(await page.locator('[data-testid^=doctor-card-]').count(), fixture.doctors.filter(d => d.acceptsChildren).length);
  });
  if (features.autoParts) await check('parts: draft and section retained on Apply', async () => {
    await page.goto('http://127.0.0.1:4174/auto-parts'); await page.getByTestId('auto-parts-section-dismantler').click();
    await page.getByTestId('auto-parts-filters').click(); await page.getByTestId('auto-parts-brand').fill('Toyota'); await page.keyboard.press('Escape');
    await page.getByTestId('auto-parts-filters').click(); assert.equal(await page.getByTestId('auto-parts-brand').inputValue(), '');
    await page.getByTestId('auto-parts-filter-apply').click(); assert.equal(await page.getByTestId('auto-parts-section-dismantler').getAttribute('aria-pressed'), 'true');
  });
  else await check('paused parts routes show an explanation and menus hide entry points', async () => {
    for (const path of ['/auto-parts', '/auto-parts/requests', '/auto-parts/requests/1']) {
      await page.goto(`http://127.0.0.1:4174${path}`);
      await page.getByRole('heading', { name: 'Раздел временно недоступен', level: 1 }).waitFor();
      assert.equal(await page.getByRole('button', { name: /Запросить запчасть/ }).count(), 0);
    }
    await page.goto('http://127.0.0.1:4174/more');
    await page.getByRole('heading', { name: 'Ещё', level: 1 }).waitFor();
    assert.equal(await page.locator('a[href^="/auto-parts"]').count(), 0);
  });
  await check('menu: favorites link reaches saved masters', async () => {
    await page.goto('http://127.0.0.1:4174/more'); assert.equal(await page.getByRole('link', { name: /Избранное/ }).getAttribute('href'), '/saved');
  });
  await check('primary destinations, new-request action and service shortcuts remain reachable', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:4174/');
    const nav = page.getByRole('navigation', { name: 'Основные разделы' });
    await nav.getByRole('link', { name: 'Главная', exact: true }).waitFor();
    assert.deepEqual(await nav.getByRole('link').allTextContents(), ['Главная', 'Заказы', 'Новая заявка', 'Чаты', 'Профиль']);
    assert.equal(await nav.getByRole('link', { name: 'Заказы', exact: true }).getAttribute('href'), '/orders');
    assert.equal(await nav.getByRole('link', { name: 'Новая заявка', exact: true }).getAttribute('href'), '/requests?new=1');
    assert.equal(await nav.getByRole('link', { name: 'Чаты', exact: true }).getAttribute('href'), '/messages');
    const services = page.getByRole('navigation', { name: 'Другие услуги' });
    if (features.autoParts) assert.equal(await services.getByRole('link', { name: 'Запчасти' }).getAttribute('href'), '/auto-parts');
    else assert.equal(await services.getByRole('link', { name: 'Запчасти' }).count(), 0);
    const catalogs = page.getByRole('navigation', { name: 'Каталоги услуг' });
    assert.deepEqual(await catalogs.getByRole('link').allTextContents(), ['Специалисты', 'Врачи', 'Организации']);
    assert.equal(await catalogs.getByRole('link', { name: 'Врачи', exact: true }).getAttribute('href'), '/doctors');
  });
  await check('specialists and organizations are distinct, and catalog searches stay separate', async () => {
    await page.goto('http://127.0.0.1:4174/');
    await page.getByTestId(`master-card-${fixture.masters[0].id}`).waitFor();
    for (const id of [9001, 9002, 9003]) assert.equal(await page.getByTestId(`master-card-${id}`).count(), 0);
    await page.getByTestId('input-search').fill(fixture.masters[0].name);
    await page.waitForTimeout(400);
    await page.getByRole('navigation', { name: 'Каталоги услуг' }).getByRole('link', { name: 'Организации', exact: true }).click();
    await page.getByTestId('master-card-9001').waitFor();
    assert.equal(await page.getByTestId('input-search').inputValue(), '');
    assert.equal(await page.getByTestId(`master-card-${fixture.masters[0].id}`).count(), 0);
    await page.getByTestId('master-card-9003').getByRole('heading', { name: 'Тестовая старая компания', exact: true }).waitFor();
    assert.equal(await page.getByTestId('master-card-9001').getByText('Организация', { exact: true }).count(), 1);
    await page.getByTestId('input-search').fill('Тестовая сервисная компания');
    await page.waitForTimeout(400);
    await page.reload();
    await page.getByTestId('master-card-9001').waitFor();
    assert.equal(await page.getByTestId('input-search').inputValue(), 'Тестовая сервисная компания');
    assert.equal(new URL(page.url()).pathname, '/organizations');
    await page.getByRole('navigation', { name: 'Каталоги услуг' }).getByRole('link', { name: 'Специалисты', exact: true }).click();
    await page.getByTestId(`master-card-${fixture.masters[0].id}`).waitFor();
    assert.equal(await page.getByTestId('input-search').inputValue(), fixture.masters[0].name);
    await page.getByTestId('input-search').fill('');
  });
  await check('clinic places lead to only the doctors at that exact address', async () => {
    await page.goto('http://127.0.0.1:4174/doctors');
    await page.getByRole('link', { name: 'Клиники и медцентры', exact: true }).click();
    await page.getByTestId('master-card-9002').waitFor();
    assert.equal(await page.getByTestId('master-card-9001').count(), 0);
    const place = page.locator('[data-testid^="clinic-place-"]').first();
    await place.waitFor();
    const href = await place.getByRole('link').getAttribute('href');
    const key = JSON.parse(new URL(href, 'http://127.0.0.1').searchParams.get('clinic'));
    const expected = fixture.doctors.filter(doctor => doctor.locations.some(location => [location.clinic, location.city, location.address].map(text => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU')).every((text, index) => text === key[index])));
    await place.getByRole('link').click();
    await page.getByRole('link', { name: 'Все врачи', exact: true }).waitFor();
    await page.locator('[data-testid^="doctor-card-"]').first().waitFor();
    assert.ok(expected.length > 0);
    assert.equal(await page.locator('[data-testid^="doctor-card-"]').count(), expected.length);
    for (const doctor of expected) await page.getByTestId(`doctor-card-${doctor.id}`).waitFor();
    await page.getByRole('link', { name: 'Все врачи', exact: true }).click();
    await page.locator('[data-testid^="doctor-card-"]').first().waitFor();
    assert.equal(await page.locator('[data-testid^="doctor-card-"]').count(), fixture.doctors.length);
  });
  await check('compare up to three masters without navigating or losing selections', async () => {
    await page.goto('http://127.0.0.1:4174/');
    await page.getByRole('button', { name: 'Сравнить мастеров', exact: true }).click();
    const selected = fixture.masters.slice(0, 3);
    for (const master of selected) await page.getByTestId(`compare-master-${master.id}`).click();
    assert.equal(new URL(page.url()).pathname, '/');
    assert.equal(await page.getByTestId(`compare-master-${fixture.masters[3].id}`).isDisabled(), true);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.getByRole('button', { name: 'Открыть сравнение (3)', exact: true }).click();
      const dialog = page.getByRole('dialog'); await dialog.waitFor();
      assert.equal(await dialog.locator('[data-testid^="comparison-row-"]').count(), 3);
      for (const master of selected) assert.equal(await dialog.getByTestId(`comparison-row-${master.id}`).getByText(master.price, { exact: true }).count(), 1);
      await page.waitForTimeout(250);
      const bounds = await dialog.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= 845);
      await page.screenshot({ animations: 'disabled', path: `${output}/comparison-${width}.png` });
      await dialog.getByRole('button', { name: 'Продолжить выбор', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Открыть сравнение (3)', exact: true }).click();
    await page.getByRole('button', { name: `Убрать из сравнения: ${selected[0].name}`, exact: true }).click();
    assert.equal(await page.getByRole('dialog').locator('[data-testid^="comparison-row-"]').count(), 2);
    await page.getByRole('button', { name: 'Продолжить выбор', exact: true }).click();
    await page.getByRole('button', { name: 'Отмена сравнения', exact: true }).click();
    assert.equal(await page.locator('[data-testid^="compare-master-"]').count(), 0);
  });
  await ctx.close();
  if (!features.autoParts) {
    const org = await context(true, false, 'organization'); const orgPage = await org.ctx.newPage();
    await check('organization parts route is paused and its navigation entry is hidden', async () => {
      await orgPage.goto('http://127.0.0.1:4174/organization/parts-requests');
      await orgPage.getByRole('heading', { name: 'Раздел временно недоступен', level: 1 }).waitFor();
      assert.equal(await orgPage.locator('a[href="/organization/parts-requests"]').count(), 0);
    });
    await org.ctx.close();
  }
  const registration = await context(false); const registrationPage = await registration.ctx.newPage();
  registrationPage.setDefaultTimeout(5000);
  await registrationPage.setViewportSize({ width: 390, height: 844 });
  await check('registration name accepts typing after switching from login; forms remain isolated', async () => {
    await registrationPage.goto('http://127.0.0.1:4174/auth');
    await registrationPage.getByRole('button', { name: 'Регистрация', exact: true }).click();
    const name = registrationPage.getByLabel('Имя', { exact: true });
    // Type key by key: the former reused Controller discarded real keyboard input.
    await name.pressSequentially('Тестовое имя');
    assert.equal(await name.inputValue(), 'Тестовое имя');
    await registrationPage.getByRole('button', { name: /Организация Компания или бригада/ }).click();
    assert.equal(await registrationPage.getByLabel('Название организации', { exact: true }).inputValue(), 'Тестовое имя');
    await registrationPage.getByRole('button', { name: 'Вход', exact: true }).click();
    assert.equal(await registrationPage.getByLabel('Телефон или email', { exact: true }).inputValue(), '');
    assert.equal(await registrationPage.getByLabel('Пароль', { exact: true }).inputValue(), '');
    await registrationPage.getByRole('button', { name: 'Регистрация', exact: true }).click();
    assert.equal(await registrationPage.getByLabel('Название организации', { exact: true }).inputValue(), 'Тестовое имя');
    await registrationPage.getByRole('button', { name: /Клиент Ищу мастера/ }).click();
    await registrationPage.getByLabel('Имя', { exact: true }).press('ControlOrMeta+A');
    await registrationPage.getByLabel('Имя', { exact: true }).pressSequentially('Тестовое имя клиента');
    assert.equal(await registrationPage.getByLabel('Имя', { exact: true }).inputValue(), 'Тестовое имя клиента');
    await registrationPage.screenshot({ animations: 'disabled', path: `${output}/registration-name-390.png` });
    assert.equal(registration.state.posts.length, 0, 'Typing must not create accounts');
  });
  await registration.ctx.close();
  const guest = await context(false); const guestPage = await guest.ctx.newPage(); guestPage.setDefaultTimeout(5000);
  await guestPage.setViewportSize({ width: 390, height: 844 });
  await check('guest describes task before login; login restores without automatic submission', async () => {
    await guestPage.goto('http://127.0.0.1:4174/');
    await guestPage.getByTestId('button-broadcast').click();
    await guestPage.getByTestId('category-1').click();
    await guestPage.getByTestId('button-next-category').click();
    await guestPage.getByTestId('input-description').fill('Заменить смеситель на кухне');
    await guestPage.getByRole('button', { name: 'Сохранить и войти' }).click();
    await guestPage.getByRole('heading', { name: 'Войдите в аккаунт' }).waitFor();
    await guestPage.reload();
    await guestPage.getByLabel('Телефон или email', { exact: true }).fill('fixture@example.invalid');
    await guestPage.getByLabel('Пароль', { exact: true }).fill('fixture-password');
    await guestPage.getByRole('button', { name: 'Войти', exact: true }).click();
    await guestPage.getByTestId('input-description').waitFor();
    assert.equal(await guestPage.getByTestId('input-description').inputValue(), 'Заменить смеситель на кухне');
    assert.equal(guest.state.posts.filter(p => p.path === '/api/requests').length, 0);
    await guestPage.screenshot({ animations: 'disabled', path: `${output}/request-restored-390.png` });
    await guestPage.getByTestId('button-next-details').click();
    await guestPage.getByTestId('input-location').fill('Грозный, тестовый адрес');
    await guestPage.getByTestId('button-submit-request').click();
    await guestPage.getByRole('heading', { name: 'Заявка отправлена' }).waitFor();
    assert.equal(guest.state.posts.filter(p => p.path === '/api/requests').length, 1);
  });
  await guest.ctx.close();
  const signed = await context(true); const userPage = await signed.ctx.newPage(); userPage.setDefaultTimeout(5000); await userPage.setViewportSize({ width: 390, height: 844 });
  await check('request: fixed footer, back preserves fields, error keeps draft', async () => {
    await userPage.goto('http://127.0.0.1:4174/'); await userPage.getByTestId('button-broadcast').click();
    await userPage.getByTestId('category-1').click(); await userPage.getByTestId('button-next-category').click();
    await userPage.getByTestId('input-description').fill('Заменить смеситель на кухне');
    await userPage.screenshot({ animations: 'disabled', path: `${output}/request-details-390.png` });
    await userPage.getByTestId('button-next-details').click(); await userPage.getByTestId('input-location').fill('Грозный, тестовый адрес');
    await userPage.getByRole('button', { name: 'Назад', exact: true }).click(); assert.equal(await userPage.getByTestId('input-description').inputValue(), 'Заменить смеситель на кухне');
    await userPage.getByTestId('button-next-details').click(); assert.equal(await userPage.getByTestId('input-location').inputValue(), 'Грозный, тестовый адрес');
    signed.state.failRequest = true; await userPage.getByTestId('button-submit-request').click(); await userPage.getByRole('alert').waitFor();
    assert.equal(await userPage.getByTestId('input-location').inputValue(), 'Грозный, тестовый адрес');
    signed.state.failRequest = false; await userPage.getByTestId('button-submit-request').click(); await userPage.getByRole('heading', { name: 'Заявка отправлена' }).waitFor();
    assert.equal(signed.state.posts.filter(p => p.path === '/api/requests').length, 2);
  });
  await check('favorites: one click changes state, not navigation', async () => {
    await userPage.goto('http://127.0.0.1:4174/'); const favorite = userPage.locator('[data-testid^=favorite-master-]').first(); await favorite.click();
    await userPage.waitForTimeout(300); assert.equal(await favorite.getAttribute('aria-pressed'), 'true'); assert.ok(new URL(userPage.url()).pathname === '/');
  });
  await signed.ctx.close();
  const dark = await context(false, true); const darkPage = await dark.ctx.newPage(); await darkPage.setViewportSize({ width: 390, height: 844 });
  await check('dark theme', async () => { await darkPage.goto('http://127.0.0.1:4174/'); await darkPage.locator('.directory-card').first().waitFor(); await darkPage.screenshot({ animations: 'disabled', path: `${output}/masters-dark-390.png` }); assert.ok(await darkPage.locator('html').evaluate(el => el.classList.contains('dark'))); });
  await dark.ctx.close();
  await check('no frontend runtime exceptions', async () => assert.deepEqual(errors, []));
})().catch(error => { results.push({ name: 'runner', status: 'failed', error: error.stack }); console.error(error); }).finally(async () => {
  fs.writeFileSync(`${output}/results.json`, JSON.stringify({ basis: `Production frontend build + isolated fixture APIs; no production DB. Engine: ${engine}. Public fonts allowed; external APIs blocked.`, results }, null, 2));
  if (browser) await browser.close(); server.close(); process.exitCode = results.some(r => r.status !== 'passed') ? 1 : 0;
});
