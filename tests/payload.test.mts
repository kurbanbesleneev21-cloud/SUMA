import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodePayload, encodePayload, safeFileName } from '../src/services/payload.ts';

const chat = '0b9a3c1e-1111-4222-8333-944445555666';
const other = '7f000000-1111-4222-8333-944445555666';
const key = 'A'.repeat(43) + '=';
const ref = { id: 'abcdefgh12', kind: 'file' as const, path: `${chat}/abcdefgh1234`, key, name: 'Договор.pdf', mime: 'application/pdf', size: 1234 };

test('text-only roundtrip', () => {
  assert.deepEqual(decodePayload(encodePayload({ text: 'привет', att: [] }), chat), { text: 'привет', att: [] });
});

test('attachment roundtrip', () => {
  const p = decodePayload(encodePayload({ text: 'смотри', att: [ref] }), chat);
  assert.equal(p.text, 'смотри');
  assert.equal(p.att.length, 1);
  assert.equal(p.att[0].name, 'Договор.pdf');
});

test('legacy plain-text messages still decode', () => {
  assert.deepEqual(decodePayload('старое сообщение', chat), { text: 'старое сообщение', att: [] });
});

test('attachment pointing into another chat folder is dropped', () => {
  const p = decodePayload(encodePayload({ text: '', att: [{ ...ref, path: `${other}/abcdefgh1234` }] }), chat);
  assert.equal(p.att.length, 0);
});

test('path traversal and bad keys are dropped', () => {
  for (const bad of [{ path: `${chat}/../../etc` }, { path: '../x' }, { key: 'short' }, { kind: 'exe' }, { size: -1 }]) {
    const p = decodePayload(encodePayload({ text: '', att: [{ ...ref, ...bad } as typeof ref] }), chat);
    assert.equal(p.att.length, 0, JSON.stringify(bad));
  }
});

test('file names cannot contain path separators', () => {
  assert.equal(safeFileName('../../evil.sh'), '__.._evil.sh');
  assert.equal(safeFileName('a/b\\c.txt'), 'a_b_c.txt');
  assert.equal(safeFileName('.hidden'), '_hidden');
});

test('malformed JSON falls back to text', () => {
  assert.deepEqual(decodePayload('{"nx":1, broken', chat), { text: '{"nx":1, broken', att: [] });
});
