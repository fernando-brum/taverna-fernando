const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/crypto');

function request(app, options, body) {
    return new Promise((resolve, reject) => {
        const server = http.createServer(app);
        server.listen(0, () => {
            const port = server.address().port;
            const encoded = body ? new URLSearchParams(body).toString() : '';
            const opts = {
                hostname: 'localhost',
                port,
                method: 'GET',
                headers: {},
                ...options,
            };
            if (encoded) {
                opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                opts.headers['Content-Length'] = Buffer.byteLength(encoded);
            }
            const req = http.request(opts, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => { server.close(); resolve({ status: res.statusCode, headers: res.headers, body: data }); });
            });
            req.on('error', err => { server.close(); reject(err); });
            if (encoded) req.write(encoded);
            req.end();
        });
    });
}

const emptyPool = { query: async () => [[]] };
const errorPool = { query: async () => { throw new Error('DB error'); } };

test('GET / retorna pagina de login (200)', async () => {
    const res = await request(createApp(emptyPool), { path: '/' });
    assert.equal(res.status, 200);
});

test('GET /register retorna pagina de cadastro (200)', async () => {
    const res = await request(createApp(emptyPool), { path: '/register' });
    assert.equal(res.status, 200);
});

test('POST /login com credenciais validas redireciona para /dashboard', async () => {
    const hash = await hashPassword('senha123');
    const pool = { query: async () => [[{ username: 'admin', password: hash }]] };
    const res = await request(createApp(pool), { method: 'POST', path: '/login' }, { username: 'admin', password: 'senha123' });
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/dashboard');
});

test('POST /login com senha errada retorna login invalido (200)', async () => {
    const hash = await hashPassword('senha123');
    const pool = { query: async () => [[{ username: 'admin', password: hash }]] };
    const res = await request(createApp(pool), { method: 'POST', path: '/login' }, { username: 'admin', password: 'errada' });
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('Login Inválido'));
});

test('POST /login com usuario inexistente retorna login invalido (200)', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/login' }, { username: 'nao_existe', password: 'qualquer' });
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('Login Inválido'));
});

test('POST /login com erro no banco retorna 500', async () => {
    const res = await request(createApp(errorPool), { method: 'POST', path: '/login' }, { username: 'a', password: 'b' });
    assert.equal(res.status, 500);
});

test('POST /register com sucesso retorna JSON success true', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/register' }, { username: 'novo', password: 'senha' });
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).success, true);
});

test('POST /register com erro no banco retorna 500 e success false', async () => {
    const res = await request(createApp(errorPool), { method: 'POST', path: '/register' }, { username: 'x', password: 'y' });
    assert.equal(res.status, 500);
    assert.equal(JSON.parse(res.body).success, false);
});

test('POST /add-item com nome vazio retorna 400', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/add-item' }, { name: '', category: 'Base' });
    assert.equal(res.status, 400);
});

test('POST /add-item com nome apenas espacos retorna 400', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/add-item' }, { name: '   ', category: 'Base' });
    assert.equal(res.status, 400);
});

test('POST /add-item com dados validos redireciona para /dashboard', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/add-item' }, { name: 'Arroz', category: 'Base' });
    assert.equal(res.status, 302);
    assert.ok(res.headers.location.startsWith('/dashboard'));
});

test('POST /add-item com erro no banco retorna 500', async () => {
    const res = await request(createApp(errorPool), { method: 'POST', path: '/add-item' }, { name: 'Arroz', category: 'Base' });
    assert.equal(res.status, 500);
});

test('GET /dashboard retorna 200', async () => {
    const res = await request(createApp(emptyPool), { path: '/dashboard' });
    assert.equal(res.status, 200);
});

test('GET /dashboard com erro no banco retorna 500', async () => {
    const res = await request(createApp(errorPool), { path: '/dashboard' });
    assert.equal(res.status, 500);
});

test('POST /orders com dados validos redireciona para /dashboard', async () => {
    const orderPool = { query: async () => [{ insertId: 1 }] };
    const res = await request(createApp(orderPool), { method: 'POST', path: '/orders' }, { customer_name: 'Joao', size: 'Media 500g', item_ids: ['1', '2'] });
    assert.equal(res.status, 302);
    assert.ok(res.headers.location.startsWith('/dashboard'));
});

test('POST /orders sem item_ids redireciona para /dashboard', async () => {
    const orderPool = { query: async () => [{ insertId: 1 }] };
    const res = await request(createApp(orderPool), { method: 'POST', path: '/orders' }, { customer_name: 'Maria', size: 'Pequena 350g' });
    assert.equal(res.status, 302);
});

test('POST /orders com nome vazio retorna 400', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/orders' }, { customer_name: '', size: 'Media 500g' });
    assert.equal(res.status, 400);
});

test('POST /orders sem tamanho retorna 400', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/orders' }, { customer_name: 'Joao', size: '' });
    assert.equal(res.status, 400);
});

test('POST /orders com erro no banco retorna 500', async () => {
    const res = await request(createApp(errorPool), { method: 'POST', path: '/orders' }, { customer_name: 'Joao', size: 'Grande 750g' });
    assert.equal(res.status, 500);
});

test('POST /orders/deliver com dados validos retorna success true', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/orders/deliver' }, { order_ids: '1', delivered_to: 'Cliente' });
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).success, true);
});

test('POST /orders/deliver com multiplos pedidos retorna success true', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/orders/deliver' }, { order_ids: ['1', '2'], delivered_to: 'ao Entregador' });
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).success, true);
});

test('POST /orders/deliver sem order_ids retorna 400', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/orders/deliver' }, { delivered_to: 'Cliente' });
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(res.body).success, false);
});

test('POST /orders/deliver sem delivered_to retorna 400', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/orders/deliver' }, { order_ids: '1' });
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(res.body).success, false);
});

test('POST /orders/deliver com erro no banco retorna 500', async () => {
    const res = await request(createApp(errorPool), { method: 'POST', path: '/orders/deliver' }, { order_ids: '1', delivered_to: 'Cliente' });
    assert.equal(res.status, 500);
    assert.equal(JSON.parse(res.body).success, false);
});

// ── /orders/advance ──

function makeStatusPool(status) {
    return {
        query: async (sql) => {
            if (sql.includes('SELECT')) return [[{ status }]];
            return [{ affectedRows: 1 }];
        }
    };
}

test('POST /orders/advance sem order_id retorna 400', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/orders/advance' });
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(res.body).success, false);
});

test('POST /orders/advance com pedido inexistente retorna 404', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/orders/advance' }, { order_id: '99' });
    assert.equal(res.status, 404);
    assert.equal(JSON.parse(res.body).success, false);
});

test('POST /orders/advance Aberto para Cozinha retorna success e nextStatus', async () => {
    const res = await request(createApp(makeStatusPool('Aberto')), { method: 'POST', path: '/orders/advance' }, { order_id: '1' });
    assert.equal(res.status, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.nextStatus, 'Cozinha');
});

test('POST /orders/advance Cozinha para Entrega retorna success', async () => {
    const res = await request(createApp(makeStatusPool('Cozinha')), { method: 'POST', path: '/orders/advance' }, { order_id: '1' });
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).nextStatus, 'Entrega');
});

test('POST /orders/advance Entrega para Entregue sem delivered_to retorna 400', async () => {
    const res = await request(createApp(makeStatusPool('Entrega')), { method: 'POST', path: '/orders/advance' }, { order_id: '1' });
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(res.body).success, false);
});

test('POST /orders/advance Entrega para Entregue com delivered_to retorna success', async () => {
    const res = await request(createApp(makeStatusPool('Entrega')), { method: 'POST', path: '/orders/advance' }, { order_id: '1', delivered_to: 'Cliente' });
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).nextStatus, 'Entregue');
});

test('POST /orders/advance pedido ja entregue retorna 400', async () => {
    const res = await request(createApp(makeStatusPool('Entregue')), { method: 'POST', path: '/orders/advance' }, { order_id: '1' });
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(res.body).success, false);
});

test('POST /orders/advance com erro no banco retorna 500', async () => {
    const res = await request(createApp(errorPool), { method: 'POST', path: '/orders/advance' }, { order_id: '1' });
    assert.equal(res.status, 500);
    assert.equal(JSON.parse(res.body).success, false);
});

// ── /items/status ──

test('POST /items/status sem item_ids retorna 400', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/items/status' }, { available: 'false' });
    assert.equal(res.status, 400);
});

test('POST /items/status marcar em falta redireciona para /dashboard', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/items/status' }, { item_ids: '1', available: 'false' });
    assert.equal(res.status, 302);
    assert.ok(res.headers.location.startsWith('/dashboard'));
});

test('POST /items/status marcar disponivel redireciona para /dashboard', async () => {
    const res = await request(createApp(emptyPool), { method: 'POST', path: '/items/status' }, { item_ids: ['1', '2'], available: 'true' });
    assert.equal(res.status, 302);
    assert.ok(res.headers.location.startsWith('/dashboard'));
});

test('POST /items/status com erro no banco retorna 500', async () => {
    const res = await request(createApp(errorPool), { method: 'POST', path: '/items/status' }, { item_ids: '1', available: 'false' });
    assert.equal(res.status, 500);
});

// ── /kanban ──

test('GET /kanban retorna 200', async () => {
    const res = await request(createApp(emptyPool), { path: '/kanban' });
    assert.equal(res.status, 200);
});

test('GET /kanban com erro no banco retorna 500', async () => {
    const res = await request(createApp(errorPool), { path: '/kanban' });
    assert.equal(res.status, 500);
});
