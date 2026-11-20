/**
 * Integration tests for the student side: public register, claim submission,
 * my claims, withdraw, and unread updates.
 *
 * Needs a real PostgreSQL database — run against one with:
 *   DATABASE_URL=postgres://... JWT_SECRET=<32+ chars> npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL;
const skip = DATABASE_URL ? false : 'DATABASE_URL is not set — start PostgreSQL and re-run.';

process.env.JWT_SECRET ??= 'test-secret-that-is-definitely-long-enough-32';
process.env.BCRYPT_ROUNDS ??= '4';

let baseUrl;

async function request(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

test('student slice: register, claim, my claims, withdraw, updates', { skip }, async (t) => {
  const { createApp } = await import('../src/app.js');
  const { pool } = await import('../src/db.js');

  const schema = await readFile(fileURLToPath(new URL('../db/schema.sql', import.meta.url)), 'utf8');
  await pool.query(schema);
  await pool.query('TRUNCATE audit_log, handovers, claims, items, users RESTART IDENTITY CASCADE');
  await pool.query('ALTER SEQUENCE item_ref_seq RESTART WITH 149');

  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ('Help Desk', 'staff@campus.edu', $1, 'staff')`,
    [await bcrypt.hash('staff-password-1', 4)]
  );
  const login = async (email, password) =>
    (await request('/api/auth/login', { method: 'POST', body: { email, password } })).body.token;
  const signup = async (name, email) =>
    (await request('/api/auth/signup', {
      method: 'POST',
      body: { name, studentId: `S-${name}`, email, password: 'student-pass-1' },
    })).body.token;

  const staff = await login('staff@campus.edu', 'staff-password-1');
  const asha = await signup('Asha', 'asha@campus.edu');
  const ben = await signup('Ben', 'ben@campus.edu');

  const register = async (body) =>
    (await request('/api/items', { method: 'POST', token: staff, body })).body.item.ref;
  const bottle = await register({
    title: 'Blue steel bottle', description: 'Insulated bottle, 100% steel', category: 'Bottles',
    location: 'Library', privateNote: 'Cat sticker under the lid',
  });
  const hoodie = await register({
    title: 'Grey hoodie', description: 'Plain pullover', category: 'Clothing', location: 'Sports hall',
  });

  await t.test('the register is public and never shows the private note', async () => {
    const res = await request('/api/items');
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 2);
    assert.ok(!JSON.stringify(res.body).includes('Cat sticker'));
    assert.ok(res.body.items.every((i) => !('privateNote' in i) && !('private_note' in i)));
  });

  await t.test('search needs every keyword, and filters by category and location', async () => {
    assert.equal((await request('/api/items?q=blue%20library')).body.items.length, 1);
    assert.equal((await request('/api/items?q=blue%20hoodie')).body.items.length, 0);
    assert.equal((await request('/api/items?category=Clothing')).body.items[0].ref, hoodie);
    assert.equal((await request('/api/items?location=Library')).body.items[0].ref, bottle);
    // A % in the search is text, not a wildcard.
    assert.equal((await request('/api/items?q=100%25')).body.items.length, 1);
    assert.equal((await request('/api/items?q=%25')).body.items.length, 1);
  });

  await t.test('locations and one item are public; an unknown ref is a 404', async () => {
    assert.deepEqual((await request('/api/items/locations')).body.locations, ['Library', 'Sports hall']);
    const one = await request(`/api/items/${bottle.toLowerCase()}`);
    assert.equal(one.status, 200);
    assert.equal(one.body.item.ref, bottle);
    assert.ok(!('privateNote' in one.body.item));
    assert.equal((await request('/api/items/RF-9999')).status, 404);
  });

  let ashaClaim, benClaim;

  await t.test('only a signed-in student can claim', async () => {
    const body = { description: 'Blue steel bottle, dented', identifying: 'Cat sticker' };
    assert.equal((await request(`/api/items/${bottle}/claims`, { method: 'POST', body })).status, 401);
    const asStaff = await request(`/api/items/${bottle}/claims`, { method: 'POST', token: staff, body });
    assert.equal(asStaff.status, 403);
  });

  await t.test('a claim needs both answers', async () => {
    const res = await request(`/api/items/${bottle}/claims`, {
      method: 'POST', token: asha, body: { description: 'Mine', identifying: '  ' },
    });
    assert.equal(res.status, 400);
  });

  await t.test('a student files a claim, once', async () => {
    const res = await request(`/api/items/${bottle}/claims`, {
      method: 'POST', token: asha,
      body: { description: 'Blue steel bottle, dented', identifying: 'Cat sticker under the lid', lostOn: '2026-11-07', lostWhere: 'Library' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.claim.status, 'pending');
    ashaClaim = res.body.claim.id;

    const again = await request(`/api/items/${bottle}/claims`, {
      method: 'POST', token: asha, body: { description: 'x', identifying: 'y' },
    });
    assert.equal(again.status, 409);

    benClaim = (await request(`/api/items/${bottle}/claims`, {
      method: 'POST', token: ben, body: { description: 'My bottle', identifying: 'A scratch' },
    })).body.claim.id;
  });

  await t.test('the audit log records the claim but not the answers', async () => {
    const { rows } = await pool.query(`SELECT detail FROM audit_log WHERE action = 'claim.submitted'`);
    assert.equal(rows.length, 2);
    assert.ok(!JSON.stringify(rows).includes('Cat sticker'));
  });

  await t.test('my claims lists only my own, with my answers', async () => {
    const res = await request('/api/claims/mine', { token: asha });
    assert.equal(res.status, 200);
    assert.equal(res.body.claims.length, 1);
    assert.equal(res.body.claims[0].identifying, 'Cat sticker under the lid');
    assert.equal(res.body.claims[0].item.ref, bottle);
    assert.ok(!('privateNote' in res.body.claims[0].item));
  });

  await t.test("another student's claim is a 404, not a leak", async () => {
    assert.equal((await request(`/api/claims/mine/${benClaim}`, { token: asha })).status, 404);
    assert.equal((await request(`/api/claims/mine/${ashaClaim}`, { token: asha })).status, 200);
  });

  await t.test('approving one claim closes the other, and both students get an update', async () => {
    const res = await request(`/api/claims/${ashaClaim}`, { method: 'PATCH', token: staff, body: { status: 'approved' } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.closedIds, [benClaim]);

    const ashaUpdates = (await request('/api/claims/mine/updates', { token: asha })).body.updates;
    assert.equal(ashaUpdates.length, 1);
    assert.equal(ashaUpdates[0].status, 'approved');

    const benMine = (await request(`/api/claims/mine/${benClaim}`, { token: ben })).body.claim;
    assert.equal(benMine.status, 'rejected');
    assert.equal(benMine.autoClosed, true);
    assert.match(benMine.reason, /Another claim/);
  });

  await t.test('opening an update marks it read', async () => {
    await request('/api/claims/mine/seen', { method: 'POST', token: ben, body: { ids: [benClaim] } });
    assert.equal((await request('/api/claims/mine/updates', { token: ben })).body.updates.length, 0);
    // Marking someone else's claim does nothing.
    await request('/api/claims/mine/seen', { method: 'POST', token: ben, body: { ids: [ashaClaim] } });
    assert.equal((await request('/api/claims/mine/updates', { token: asha })).body.updates.length, 1);
  });

  await t.test('a handover reads as "returned" and is a fresh update', async () => {
    await request('/api/claims/mine/seen', { method: 'POST', token: asha, body: {} });
    assert.equal((await request('/api/claims/mine/updates', { token: asha })).body.updates.length, 0);
    await request(`/api/claims/${ashaClaim}/handover`, { method: 'POST', token: staff, body: { identityChecked: true } });
    const updates = (await request('/api/claims/mine/updates', { token: asha })).body.updates;
    assert.equal(updates[0].status, 'returned');
    assert.equal((await request('/api/items')).body.items.some((i) => i.ref === bottle), false, 'returned items leave the register');
    assert.equal((await request(`/api/items/${bottle}`)).status, 200, 'but the record stays readable');
  });

  await t.test('a claim on a reserved or returned item is refused', async () => {
    const res = await request(`/api/items/${bottle}/claims`, {
      method: 'POST', token: await signup('Cara', 'cara@campus.edu'), body: { description: 'x', identifying: 'y' },
    });
    assert.equal(res.status, 409);
  });

  await t.test('withdraw: only pending, only mine, and the item can be claimed again', async () => {
    const filed = (await request(`/api/items/${hoodie}/claims`, {
      method: 'POST', token: ben, body: { description: 'Grey hoodie', identifying: 'Torn left cuff' },
    })).body.claim.id;

    assert.equal((await request(`/api/claims/mine/${filed}/withdraw`, { method: 'POST', token: asha })).status, 404);
    const res = await request(`/api/claims/mine/${filed}/withdraw`, { method: 'POST', token: ben });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'withdrawn');
    assert.equal((await request(`/api/claims/mine/${filed}/withdraw`, { method: 'POST', token: ben })).status, 409);

    const { rows } = await pool.query(`SELECT action FROM audit_log WHERE action = 'claim.withdrawn'`);
    assert.equal(rows.length, 1);

    const again = await request(`/api/items/${hoodie}/claims`, {
      method: 'POST', token: ben, body: { description: 'Grey hoodie again', identifying: 'Torn left cuff' },
    });
    assert.equal(again.status, 201);
    assert.equal(again.body.claim.id, filed, 'the withdrawn claim is re-filed, not duplicated');
    assert.equal(again.body.claim.status, 'pending');
  });

  await t.test('my-claims routes are for students only', async () => {
    assert.equal((await request('/api/claims/mine')).status, 401);
    assert.equal((await request('/api/claims/mine', { token: staff })).status, 403);
  });

  server.close();
  await pool.end();
});
