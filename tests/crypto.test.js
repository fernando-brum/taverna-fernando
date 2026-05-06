const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../src/crypto');

test('hashPassword retorna string diferente do texto puro', async () => {
    const hash = await hashPassword('senha123');
    assert.notEqual(hash, 'senha123');
});

test('hashPassword retorna formato salt:derivedKey', async () => {
    const hash = await hashPassword('senha123');
    const partes = hash.split(':');
    assert.equal(partes.length, 2);
    assert.equal(partes[0].length, 32); // salt hex 16 bytes
    assert.equal(partes[1].length, 128); // derivedKey hex 64 bytes
});

test('hashPassword gera hashes diferentes para a mesma senha (salt aleatorio)', async () => {
    const hash1 = await hashPassword('mesma_senha');
    const hash2 = await hashPassword('mesma_senha');
    assert.notEqual(hash1, hash2);
});

test('verifyPassword retorna true para senha correta', async () => {
    const hash = await hashPassword('senha_certa');
    const resultado = await verifyPassword('senha_certa', hash);
    assert.equal(resultado, true);
});

test('verifyPassword retorna false para senha incorreta', async () => {
    const hash = await hashPassword('senha_certa');
    const resultado = await verifyPassword('senha_errada', hash);
    assert.equal(resultado, false);
});

test('verifyPassword retorna false para senha vazia contra hash valido', async () => {
    const hash = await hashPassword('senha_certa');
    const resultado = await verifyPassword('', hash);
    assert.equal(resultado, false);
});

test('hashPassword e verifyPassword funcionam com caracteres especiais', async () => {
    const senha = 'S3nh@#$%!çãõ';
    const hash = await hashPassword(senha);
    const resultado = await verifyPassword(senha, hash);
    assert.equal(resultado, true);
});
