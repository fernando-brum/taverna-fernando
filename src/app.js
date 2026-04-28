const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { hashPassword, verifyPassword } = require('./crypto');

function createApp(pool) {
    const app = express();
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '..', 'views'));
    app.use('/assets', express.static(path.join(__dirname)));

    app.get('/', (req, res) => res.render('login'));

    app.get('/register', (req, res) => res.render('register'));

    app.post('/login', async (req, res) => {
        const { username, password } = req.body;
        try {
            const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
            if (rows.length > 0 && await verifyPassword(password, rows[0].password)) {
                return res.redirect('/dashboard');
            }
            res.send('<h1>Login Inválido</h1><a href="/">Voltar</a>');
        } catch {
            res.status(500).send('Erro no banco.');
        }
    });

    app.post('/register', async (req, res) => {
        const { username, password } = req.body;
        try {
            const hash = await hashPassword(password);
            await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
            res.json({ success: true, message: 'Piloto cadastrado com sucesso! Pode Acelerar!' });
        } catch {
            res.status(500).json({ success: false, message: 'Erro ao cadastrar: Nome de piloto já existe ou banco fora do ar.' });
        }
    });

    app.post('/add-item', async (req, res) => {
        const { name, category } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).send('<h1>Erro 400: Nome do item não pode ser vazio.</h1><a href="/dashboard">Voltar</a>');
        }
        try {
            await pool.query('INSERT INTO items (name, category) VALUES (?, ?)', [name.trim(), category ? category.trim() : null]);
            res.redirect('/dashboard');
        } catch {
            res.status(500).send('Erro ao cadastrar item.');
        }
    });

    app.post('/orders', async (req, res) => {
        const { customer_name, size, item_ids } = req.body;
        if (!customer_name || customer_name.trim() === '') {
            return res.status(400).send('<h1>Erro 400: Nome do cliente não pode ser vazio.</h1><a href="/dashboard">Voltar</a>');
        }
        if (!size) {
            return res.status(400).send('<h1>Erro 400: Selecione o tamanho da marmita.</h1><a href="/dashboard">Voltar</a>');
        }
        try {
            const [result] = await pool.query(
                'INSERT INTO orders (customer_name, size, status) VALUES (?, ?, ?)',
                [customer_name.trim(), size, 'Aberto']
            );
            const orderId = result.insertId;
            if (item_ids) {
                const ids = Array.isArray(item_ids) ? item_ids : [item_ids];
                for (const itemId of ids) {
                    await pool.query(
                        'INSERT INTO order_items (order_id, item_id) VALUES (?, ?)',
                        [orderId, itemId]
                    );
                }
            }
            res.redirect('/dashboard');
        } catch {
            res.status(500).send('Erro ao registrar pedido.');
        }
    });

    app.post('/orders/deliver', async (req, res) => {
        const { order_ids, delivered_to } = req.body;
        if (!order_ids || !delivered_to) {
            return res.status(400).json({ success: false, message: 'Dados inválidos.' });
        }
        const ids = Array.isArray(order_ids) ? order_ids : [order_ids];
        try {
            for (const id of ids) {
                await pool.query(
                    'UPDATE orders SET status = ?, delivered_to = ?, delivered_at = NOW() WHERE id = ? AND status = ?',
                    ['Entregue', delivered_to, id, 'Aberto']
                );
            }
            res.json({ success: true });
        } catch {
            res.status(500).json({ success: false, message: 'Erro ao atualizar pedidos.' });
        }
    });

    app.get('/dashboard', async (req, res) => {
        try {
            const [items] = await pool.query('SELECT * FROM items');
            const [orders] = await pool.query(
                `SELECT o.id, o.customer_name, o.size, o.status,
                 GROUP_CONCAT(i.name ORDER BY i.name SEPARATOR ', ') AS itens
                 FROM orders o
                 LEFT JOIN order_items oi ON o.id = oi.order_id
                 LEFT JOIN items i ON oi.item_id = i.id
                 WHERE o.status = 'Aberto'
                 GROUP BY o.id ORDER BY o.id DESC`
            );
            const [delivered] = await pool.query(
                `SELECT o.id, o.customer_name, o.size, o.delivered_to, o.delivered_at,
                 GROUP_CONCAT(i.name ORDER BY i.name SEPARATOR ', ') AS itens
                 FROM orders o
                 LEFT JOIN order_items oi ON o.id = oi.order_id
                 LEFT JOIN items i ON oi.item_id = i.id
                 WHERE o.status = 'Entregue'
                 GROUP BY o.id ORDER BY o.delivered_at DESC`
            );
            res.render('dashboard', { items, orders, delivered });
        } catch {
            res.status(500).send('Erro ao carregar dashboard.');
        }
    });

    return app;
}

module.exports = { createApp };
