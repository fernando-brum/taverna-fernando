const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const path = require('path');
const { hashPassword, verifyPassword } = require('./src/crypto');

const app = express();

const dbConfig = {
    host: process.env.DB_HOST || 'db',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASS || 'password',
    database: process.env.DB_NAME || 'marmitadb'
};

let pool;

async function connectWithRetry() {
    console.log('🔍 [INFRA] Tentando conectar ao MySQL...');
    for (let i = 1; i <= 10; i++) {
        try {
            pool = mysql.createPool(dbConfig);
            await pool.query('SELECT 1');
            console.log('✅ [DATABASE] Conectado ao MySQL com sucesso!');
            
            const [adminRows] = await pool.query('SELECT * FROM users WHERE username = "admin"');
            if (adminRows.length === 0) {
                const adminHash = await hashPassword('admin123');
                await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', adminHash]);
                console.log('✅ [DATABASE] Usuário admin inserido com hash.');
            }
            
            return;
        } catch (err) {
            console.log(`⚠️ [DATABASE] Tentativa ${i}/10 falhou. Aguardando...`);
            await new Promise(res => setTimeout(res, 3000));
        }
    }
    process.exit(1);
}

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => res.render('login'));

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length > 0) {
            const user = rows[0];
            const match = await verifyPassword(password, user.password);
            if (match) return res.redirect('/dashboard');
        }
        res.send('<h1>Login Inválido</h1><a href="/">Voltar</a>');
    } catch (err) {
        res.status(500).send("Erro no banco.");
    }
});

app.get('/register', (req, res) => res.render('register'));

async function registerUserNoBanco(username, plainTextPassword) {
    const hash = await hashPassword(plainTextPassword);
    await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
}

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        // Chama a função designada para registrar salvando com o hash
        await registerUserNoBanco(username, password);
        // Retorna reposta JSON para que a página não seja recarregada
        res.json({ success: true, message: 'Piloto cadastrado com sucesso! Pode Acelerar!' });
    } catch (err) {
        console.error("Erro interno no cadastro:", err);
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
    } catch (err) {
        res.status(500).send('Erro ao cadastrar item.');
    }
});

app.get('/dashboard', async (req, res) => {
    const [items] = await pool.query('SELECT * FROM items');
    const [orders] = await pool.query('SELECT * FROM orders');
    res.render('dashboard', { items, orders });
});

connectWithRetry().then(() => {
    app.listen(3000, () => console.log('🚀 MARMITATECH PRO ONLINE NA PORTA 3000'));
});
