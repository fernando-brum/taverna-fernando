const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { hashPassword, verifyPassword } = require('./crypto');

function createApp(pool) {
    const app = express();
    app.use(bodyParser.urlencoded({ extended: true }));
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '..', 'views'));

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

    app.get('/dashboard', async (req, res) => {
        try {
            const [items] = await pool.query('SELECT * FROM items');
            const [orders] = await pool.query('SELECT * FROM orders');
            res.render('dashboard', { items, orders });
        } catch {
            res.status(500).send('Erro ao carregar dashboard.');
        }
    });

    return app;
}

module.exports = { createApp };
