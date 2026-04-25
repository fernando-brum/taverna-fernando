const mysql = require('mysql2/promise');
const { createApp } = require('./src/app');
const { hashPassword } = require('./src/crypto');

const dbConfig = {
    host: process.env.DB_HOST || 'db',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASS || 'password',
    database: process.env.DB_NAME || 'marmitadb'
};

async function connectWithRetry() {
    console.log('🔍 [INFRA] Tentando conectar ao MySQL...');
    for (let i = 1; i <= 10; i++) {
        try {
            const pool = mysql.createPool(dbConfig);
            await pool.query('SELECT 1');
            console.log('✅ [DATABASE] Conectado ao MySQL com sucesso!');
            const [adminRows] = await pool.query('SELECT * FROM users WHERE username = "admin"');
            if (adminRows.length === 0) {
                const adminHash = await hashPassword('admin123');
                await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', adminHash]);
                console.log('✅ [DATABASE] Usuário admin inserido com hash.');
            }
            return pool;
        } catch {
            console.log(`⚠️ [DATABASE] Tentativa ${i}/10 falhou. Aguardando...`);
            await new Promise(res => setTimeout(res, 3000));
        }
    }
    process.exit(1);
}

connectWithRetry().then(pool => {
    const app = createApp(pool);
    app.listen(3000, () => console.log('🚀 MARMITATECH PRO ONLINE NA PORTA 3000'));
});
