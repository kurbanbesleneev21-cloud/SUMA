// Two-account end-to-end test against a live Supabase project, driving the web build (NEXO_WEB_PREVIEW=1).
// Requires confirmed test users qa_alice@nexo-qa.test and qa_bob@nexo-qa.test, and data reset via tests/e2e/reset.sql.
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.NEXO_E2E_URL || 'http://localhost:8099';
const PW = process.env.NEXO_E2E_PASSWORD;
if (!PW) throw new Error('Set NEXO_E2E_PASSWORD (password of qa_alice / qa_bob test accounts)');
const OUT = process.argv[2] || 'e2e-screenshots';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ' — ' + detail : ''}`);
};

async function newUser(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU', hasTouch: false });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${label} pageerror]`, e.message));
  page.on('console', (m) => m.type() === 'error' && console.log(`[${label} console]`, m.text().slice(0, 200)));
  return page;
}

const T = (page, text, opts) => page.getByText(text, opts).locator('visible=true').last();
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

async function signIn(page, email) {
  await page.goto(BASE);
  await T(page, 'С возвращением').waitFor({ timeout: 20000 });
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(PW);
  await T(page, 'Войти', { exact: true }).click();
  await T(page, 'Чаты', { exact: true }).waitFor({ timeout: 20000 });
}

async function longPress(page, locator) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
}

let alice, bob;
(async () => {
  const browser = await chromium.launch();
  alice = await newUser(browser, 'alice');
  bob = await newUser(browser, 'bob');

  // Splash + sign-in screen
  await alice.goto(BASE);
  await alice.waitForTimeout(600);
  await shot(alice, '01-splash');
  await T(alice, 'С возвращением').waitFor({ timeout: 20000 });
  await shot(alice, '02-sign-in');
  check('splash then sign-in screen', true);

  await signIn(alice, 'qa_alice@nexo-qa.test');
  await alice.waitForTimeout(1500);
  await shot(alice, '03-chats-empty');
  check('Alice signs in', true);

  await signIn(bob, 'qa_bob@nexo-qa.test');
  check('Bob signs in', true);

  // Alice starts a chat with Bob via the pencil button
  await alice.getByLabel('Новая переписка').click();
  await alice.getByPlaceholder('Поиск по username').fill('qa_bo');
  await T(alice, 'Боб Тест').waitFor({ timeout: 15000 });
  await shot(alice, '04-new-chat-search');
  await T(alice, 'Боб Тест').click();
  await alice.getByPlaceholder('Сообщение').waitFor({ timeout: 15000 });
  const secret = 'Привет, Боб! Секретное слово: лазурит-' + Date.now();
  await alice.getByPlaceholder('Сообщение').fill(secret);
  await alice.getByLabel('Отправить').click();
  await T(alice, secret).waitFor({ timeout: 15000 });
  await alice.waitForTimeout(800);
  await shot(alice, '05-alice-sent');
  check('Alice sends encrypted message', true);

  // Bob receives it in realtime in his chat list, decrypted on device, with unread badge
  await T(bob, 'Алиса Тест').waitFor({ timeout: 20000 });
  await T(bob, secret).waitFor({ timeout: 10000 });
  await bob.waitForTimeout(500);
  await shot(bob, '06-bob-chat-list');
  check('Bob sees decrypted preview in chat list (realtime)', true);

  await T(bob, 'Алиса Тест').click();
  await T(bob, secret, { exact: true }).waitFor({ timeout: 15000 });
  await bob.getByPlaceholder('Сообщение').fill('Привет, Алиса! Получил, всё расшифровалось ✅');
  await bob.getByLabel('Отправить').click();
  await bob.waitForTimeout(1000);
  await shot(bob, '07-bob-chat');

  await T(alice, 'Привет, Алиса! Получил, всё расшифровалось ✅').waitFor({ timeout: 20000 });
  await alice.waitForTimeout(1500);
  await shot(alice, '08-alice-got-reply');
  check('Alice receives Bob reply in realtime', true);

  // Message actions: long-press → reply
  await longPress(alice, T(alice, 'Привет, Алиса! Получил, всё расшифровалось ✅'));
  await T(alice, 'Ответить', { exact: true }).waitFor({ timeout: 5000 });
  await shot(alice, '09-message-menu');
  await T(alice, 'Ответить', { exact: true }).click();
  await alice.getByPlaceholder('Сообщение').fill('Отлично! Проверяем ответ на сообщение.');
  await alice.getByLabel('Отправить').click();
  await T(bob, 'Отлично! Проверяем ответ на сообщение.').waitFor({ timeout: 20000 });
  check('Reply delivered', true);

  // Back to list: long-press chat → pin
  await alice.getByLabel('Назад').locator('visible=true').last().click();
  await T(alice, 'Боб Тест').waitFor({ timeout: 10000 });
  await alice.waitForTimeout(900);
  await longPress(alice, T(alice, /Вы: Отлично/));
  await T(alice, 'Закрепить', { exact: true }).waitFor({ timeout: 5000 });
  await shot(alice, '10-chat-actions');
  await T(alice, 'Закрепить', { exact: true }).click();
  await alice.waitForTimeout(1500);
  await shot(alice, '11-chat-pinned');
  check('Pin chat via long-press menu', true);

  // Settings screens
  await alice.getByLabel('Настройки').click();
  await T(alice, 'Изменить профиль').waitFor({ timeout: 10000 });
  await alice.waitForTimeout(700);
  await shot(alice, '12-settings');
  await T(alice, 'Конфиденциальность', { exact: true }).click();
  await T(alice, 'Кто может мне писать').waitFor({ timeout: 10000 });
  await alice.waitForTimeout(500);
  await shot(alice, '13-privacy');
  await alice.getByLabel('Назад').locator('visible=true').last().click();
  await T(alice, 'Внешний вид', { exact: true }).click();
  await T(alice, 'Акцентный цвет').waitFor({ timeout: 10000 });
  await T(alice, 'Светлая', { exact: true }).click();
  await alice.waitForTimeout(600);
  await shot(alice, '14-appearance-light');
  await T(alice, 'Тёмная', { exact: true }).click();
  await alice.getByLabel('Назад').locator('visible=true').last().click();

  // Contacts + user profile with safety code
  await alice.getByLabel('Контакты').click();
  await alice.getByPlaceholder('Поиск по username').fill('qa_bob');
  await T(alice, /@qa_bob ·/).waitFor({ timeout: 10000 });
  await T(alice, /@qa_bob ·/).click();
  await T(alice, 'Добавить в контакты').waitFor({ timeout: 10000 });
  await T(alice, 'Добавить в контакты').click();
  await T(alice, 'Удалить из контактов').waitFor({ timeout: 10000 });
  await alice.waitForTimeout(500);
  await shot(alice, '15-user-profile');
  check('Add contact', true);

  // Bob hides "who can message" from non-contacts... Bob has not added Alice, so Alice must be refused.
  await bob.getByLabel('Назад').locator('visible=true').last().click();
  await bob.getByLabel('Настройки').click();
  await T(bob, 'Конфиденциальность', { exact: true }).click();
  await T(bob, 'Кто может мне писать').click();
  await T(bob, 'Никто', { exact: true }).click();
  await bob.waitForTimeout(1500);
  await alice.getByLabel('Назад').locator('visible=true').last().click();
  await alice.getByLabel('Чаты').click();
  await T(alice, /Вы: Отлично/).click();
  await alice.getByPlaceholder('Сообщение').fill('Это сообщение не должно дойти');
  await alice.getByLabel('Отправить').click();
  await alice.waitForTimeout(2500);
  const refused = (await alice.getByPlaceholder('Сообщение').locator('visible=true').last().inputValue()) === 'Это сообщение не должно дойти';
  await shot(alice, '16-privacy-refused');
  check('Server refuses message when recipient set "who can message" = nobody', refused);

  // English UI
  await alice.getByLabel('Назад').locator('visible=true').last().click();
  await alice.getByLabel('Настройки').click();
  await T(alice, 'Язык', { exact: true }).click();
  await T(alice, 'English', { exact: true }).click();
  await alice.getByLabel('Back').locator('visible=true').last().click();
  await T(alice, 'Edit profile').waitFor({ timeout: 10000 });
  await shot(alice, '17-settings-en');
  check('Switch UI to English', true);

  await browser.close();
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
  console.log('SECRET=' + secret);
})().catch(async (e) => {
  console.error('E2E ERROR:', e.message.split('\n').slice(0, 14).join('\n'));
  await alice?.screenshot({ path: `${OUT}/zz-fail-alice.png` }).catch(() => {});
  await bob?.screenshot({ path: `${OUT}/zz-fail-bob.png` }).catch(() => {});
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  process.exit(1);
});
