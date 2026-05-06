const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { hashPassword, verifyPassword } = require('./crypto');

const ALLOWED_SIZES    = new Set(['Pequena 350g', 'Media 500g', 'Grande 750g']);
const ALLOWED_DELIVERY = new Set(['Cliente', 'ao Entregador']);

function isValidId(v) {
    return v != null && /^\d+$/.test(String(v).trim()) && parseInt(v, 10) > 0;
}

function allValidIds(arr) {
    return arr.length > 0 && arr.every(isValidId);
}

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
        if (!username || !password ||
            typeof username !== 'string' || typeof password !== 'string' ||
            username.trim().length === 0 || username.length > 50 || password.length > 128) {
            return res.status(400).send('<h1>Erro 400: Credenciais inválidas.</h1><a href="/">Voltar</a>');
        }
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
        if (!username || !password ||
            typeof username !== 'string' || typeof password !== 'string' ||
            username.trim().length === 0 || username.length > 50 || password.length < 4 || password.length > 128) {
            return res.status(400).json({ success: false, message: 'Usuário ou senha inválidos (senha: 4–128 caracteres).' });
        }
        try {
            const hash = await hashPassword(password);
            await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
            res.json({ success: true, message: 'Piloto cadastrado com sucesso! Pode Acelerar!' });
        } catch {
            res.status(500).json({ success: false, message: 'Erro ao cadastrar: Nome de piloto já existe ou banco fora do ar.' });
        }
    });

    app.post('/items/status', async (req, res) => {
        const { item_ids, available } = req.body;
        if (!item_ids) {
            return res.status(400).send('<h1>Erro 400: Selecione ao menos um ingrediente.</h1><a href="/dashboard">Voltar</a>');
        }
        const ids = Array.isArray(item_ids) ? item_ids : [item_ids];
        if (!allValidIds(ids)) {
            return res.status(400).send('<h1>Erro 400: IDs inválidos.</h1><a href="/dashboard">Voltar</a>');
        }
        const isAvailable = available === 'true' ? 1 : 0;
        try {
            for (const id of ids) {
                await pool.query('UPDATE items SET available = ? WHERE id = ?', [isAvailable, id]);
            }
            const label = isAvailable ? 'Ingrediente(s) marcado(s) como Disponível' : 'Ingrediente(s) marcado(s) como Em Falta';
            res.redirect(`/dashboard?msg=${encodeURIComponent(label)}&type=success`);
        } catch {
            res.status(500).send('Erro ao atualizar disponibilidade.');
        }
    });

    app.post('/add-item', async (req, res) => {
        const { name, category } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).send('<h1>Erro 400: Nome do item não pode ser vazio.</h1><a href="/dashboard">Voltar</a>');
        }
        if (!category || category.trim() === '') {
            return res.status(400).send('<h1>Erro 400: Categoria do item não pode ser vazia.</h1><a href="/dashboard">Voltar</a>');
        }
        if (name.length > 100 || category.length > 50) {
            return res.status(400).send('<h1>Erro 400: Nome ou categoria muito longos.</h1><a href="/dashboard">Voltar</a>');
        }
        try {
            await pool.query('INSERT INTO items (name, category) VALUES (?, ?)', [name.trim(), category.trim()]);
            res.redirect('/dashboard?msg=Ingrediente+cadastrado+com+sucesso&type=success');
        } catch {
            res.status(500).send('Erro ao cadastrar item.');
        }
    });

    app.post('/items/delete', async (req, res) => {
        const { item_id } = req.body;
        if (!isValidId(item_id)) return res.status(400).json({ success: false, message: 'ID inválido.' });
        try {
            await pool.query('DELETE FROM items WHERE id = ?', [item_id]);
            res.json({ success: true });
        } catch {
            res.status(500).json({ success: false, message: 'Erro ao deletar ingrediente.' });
        }
    });

    app.post('/orders', async (req, res) => {
        const { customer_name, size, item_ids } = req.body;
        if (!customer_name || customer_name.trim() === '') {
            return res.status(400).send('<h1>Erro 400: Nome do cliente não pode ser vazio.</h1><a href="/dashboard">Voltar</a>');
        }
        if (customer_name.length > 100) {
            return res.status(400).send('<h1>Erro 400: Nome do cliente muito longo.</h1><a href="/dashboard">Voltar</a>');
        }
        if (!size || !ALLOWED_SIZES.has(size)) {
            return res.status(400).send('<h1>Erro 400: Tamanho inválido.</h1><a href="/dashboard">Voltar</a>');
        }
        try {
            const [result] = await pool.query(
                'INSERT INTO orders (customer_name, size, status) VALUES (?, ?, ?)',
                [customer_name.trim(), size, 'Aberto']
            );
            const orderId = result.insertId;
            if (item_ids) {
                const ids = Array.isArray(item_ids) ? item_ids : [item_ids];
                if (!allValidIds(ids)) {
                    return res.status(400).send('<h1>Erro 400: IDs de ingredientes inválidos.</h1><a href="/dashboard">Voltar</a>');
                }
                for (const itemId of ids) {
                    await pool.query(
                        'INSERT INTO order_items (order_id, item_id) VALUES (?, ?)',
                        [orderId, itemId]
                    );
                }
            }
            res.redirect('/dashboard?msg=Pedido+registrado+com+sucesso&type=success');
        } catch {
            res.status(500).send('Erro ao registrar pedido.');
        }
    });

    app.post('/orders/advance', async (req, res) => {
        const { order_id, delivered_to } = req.body;
        if (!isValidId(order_id)) {
            return res.status(400).json({ success: false, message: 'ID do pedido inválido.' });
        }
        const progression = { 'Aberto': 'Cozinha', 'Cozinha': 'Entrega', 'Entrega': 'Entregue' };
        try {
            const [[order]] = await pool.query('SELECT status FROM orders WHERE id = ?', [order_id]);
            if (!order) return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
            const nextStatus = progression[order.status];
            if (!nextStatus) return res.status(400).json({ success: false, message: 'Pedido já finalizado.' });
            if (nextStatus === 'Entregue') {
                if (!delivered_to || !ALLOWED_DELIVERY.has(delivered_to)) {
                    return res.status(400).json({ success: false, message: 'Valor de entrega inválido.' });
                }
                await pool.query(
                    'UPDATE orders SET status = ?, delivered_to = ?, delivered_at = NOW() WHERE id = ?',
                    [nextStatus, delivered_to, order_id]
                );
            } else {
                await pool.query('UPDATE orders SET status = ? WHERE id = ?', [nextStatus, order_id]);
            }
            res.json({ success: true, nextStatus });
        } catch {
            res.status(500).json({ success: false, message: 'Erro ao avançar pedido.' });
        }
    });

    app.get('/kanban', async (req, res) => {
        try {
            const statuses = ['Aberto', 'Cozinha', 'Entrega', 'Entregue'];
            const columns = {};
            for (const status of statuses) {
                const [rows] = await pool.query(
                    `SELECT o.id, o.customer_name, o.size, o.delivered_to, o.delivered_at,
                     GROUP_CONCAT(i.name ORDER BY i.name SEPARATOR ', ') AS itens
                     FROM orders o
                     LEFT JOIN order_items oi ON o.id = oi.order_id
                     LEFT JOIN items i ON oi.item_id = i.id
                     WHERE o.status = ?
                     GROUP BY o.id ORDER BY o.id DESC`,
                    [status]
                );
                columns[status] = rows;
            }
            res.render('kanban', { columns });
        } catch {
            res.status(500).send('Erro ao carregar kanban.');
        }
    });

    app.post('/orders/deliver', async (req, res) => {
        const { order_ids, delivered_to } = req.body;
        if (!order_ids || !delivered_to) {
            return res.status(400).json({ success: false, message: 'Dados inválidos.' });
        }
        if (!ALLOWED_DELIVERY.has(delivered_to)) {
            return res.status(400).json({ success: false, message: 'Valor de entrega inválido.' });
        }
        const ids = Array.isArray(order_ids) ? order_ids : [order_ids];
        if (!allValidIds(ids)) {
            return res.status(400).json({ success: false, message: 'IDs de pedidos inválidos.' });
        }
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

    const _exportQuery = `
        SELECT o.id, o.customer_name, o.size, o.status,
               o.delivered_to, o.delivered_at,
               COUNT(oi.item_id) AS item_count,
               GROUP_CONCAT(i.name ORDER BY i.name SEPARATOR ', ') AS itens
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN items i ON oi.item_id = i.id
        GROUP BY o.id ORDER BY o.id DESC`;

    const _exportPrices  = { 'Pequena 350g': 15, 'Media 500g': 20, 'Grande 750g': 25 };
    const _exportIncluded = { 'Pequena 350g': 3,  'Media 500g': 4,  'Grande 750g': 5  };

    function _calcRow(r) {
        const base   = _exportPrices[r.size]  || 0;
        const inc    = _exportIncluded[r.size] || 0;
        const extras = r.size === 'Grande 750g' ? Math.max(0, (r.item_count || 0) - inc) : 0;
        return { base, extras, total: base + extras * 3.5 };
    }

    app.get('/admin/export', async (req, res) => {
        try {
            const [rows] = await pool.query(_exportQuery);
            const esc = v => {
                if (v == null) return '';
                const s = String(v);
                return (s.includes(';') || s.includes('"') || s.includes('\n'))
                    ? '"' + s.replace(/"/g, '""') + '"' : s;
            };
            const fmt = n => n.toFixed(2).replace('.', ',');
            const header = ['ID', 'Cliente', 'Tamanho', 'Ingredientes', 'Qtd Ingredientes',
                            'Adicionais', 'Valor Base (R$)', 'Valor Adicionais (R$)', 'Valor Total (R$)',
                            'Status', 'Entregue Para', 'Data/Hora Entrega'];
            const lines = [header.join(';')];
            for (const r of rows) {
                const { base, extras, total } = _calcRow(r);
                const dateStr = r.delivered_at
                    ? new Date(r.delivered_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                    : '';
                lines.push([
                    esc(r.id), esc(r.customer_name), esc(r.size),
                    esc(r.itens || ''), esc(r.item_count || 0), esc(extras),
                    esc(fmt(base)), esc(fmt(extras * 3.5)), esc(fmt(total)),
                    esc(r.status), esc(r.delivered_to || ''), esc(dateStr)
                ].join(';'));
            }
            const csv = '﻿' + lines.join('\r\n');
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="relatorio_vendas.csv"');
            res.send(csv);
        } catch {
            res.status(500).send('Erro ao gerar relatório.');
        }
    });

    app.get('/admin/export/xlsx', async (req, res) => {
        try {
            const ExcelJS = require('exceljs');
            const [rows]  = await pool.query(_exportQuery);

            const wb   = new ExcelJS.Workbook();
            wb.creator = 'taverna-fernando';
            const ws   = wb.addWorksheet('Relatório de Vendas', {
                views: [{ state: 'frozen', ySplit: 1 }],
                properties: { defaultRowHeight: 18 }
            });

            ws.columns = [
                { key: 'id',           header: 'ID',                   width: 7  },
                { key: 'cliente',      header: 'Cliente',               width: 22 },
                { key: 'tamanho',      header: 'Tamanho',               width: 14 },
                { key: 'ingredientes', header: 'Ingredientes',           width: 36 },
                { key: 'qtd',          header: 'Qtd Ingredientes',       width: 17 },
                { key: 'adicionais',   header: 'Adicionais',             width: 12 },
                { key: 'base',         header: 'Valor Base (R$)',        width: 16 },
                { key: 'extras_val',   header: 'Valor Adicionais (R$)',  width: 20 },
                { key: 'total',        header: 'Valor Total (R$)',       width: 16 },
                { key: 'status',       header: 'Status',                 width: 12 },
                { key: 'entregue_a',   header: 'Entregue Para',          width: 15 },
                { key: 'data_entrega', header: 'Data/Hora Entrega',      width: 20 },
            ];

            // ── Cabeçalho azul ──
            const hdrRow = ws.getRow(1);
            hdrRow.height = 26;
            hdrRow.eachCell(cell => {
                cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3D6E' } };
                cell.font   = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11, name: 'Calibri' };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
                cell.border = { bottom: { style: 'medium', color: { argb: 'FF2E75B6' } } };
            });

            // ── Linhas de dados ──
            rows.forEach((r, idx) => {
                const { base, extras, total } = _calcRow(r);
                const dateStr = r.delivered_at
                    ? new Date(r.delivered_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                    : '';
                const row = ws.addRow({
                    id: r.id, cliente: r.customer_name, tamanho: r.size,
                    ingredientes: r.itens || '', qtd: r.item_count || 0,
                    adicionais: extras, base, extras_val: extras * 3.5, total,
                    status: r.status, entregue_a: r.delivered_to || '', data_entrega: dateStr
                });

                const bg = idx % 2 === 0 ? 'FFD6E4F0' : 'FFFFFFFF';
                row.eachCell({ includeEmpty: true }, cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                    cell.font = { size: 10, name: 'Calibri' };
                    cell.alignment = { vertical: 'middle' };
                    cell.border = { bottom: { style: 'hair', color: { argb: 'FFBDD7EE' } } };
                });

                ['base', 'extras_val', 'total'].forEach(k => {
                    row.getCell(k).numFmt  = 'R$ #,##0.00';
                    row.getCell(k).alignment = { horizontal: 'right', vertical: 'middle' };
                });
                row.getCell('id').alignment  = { horizontal: 'center', vertical: 'middle' };
                row.getCell('qtd').alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell('adicionais').alignment = { horizontal: 'center', vertical: 'middle' };
            });

            ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="relatorio_vendas.xlsx"');
            await wb.xlsx.write(res);
            res.end();
        } catch {
            res.status(500).send('Erro ao gerar relatório Excel.');
        }
    });

    app.get('/dashboard', async (req, res) => {
        try {
            const [items] = await pool.query('SELECT * FROM items');
            const [orders] = await pool.query(
                `SELECT o.id, o.customer_name, o.size, o.status,
                 COUNT(oi.item_id) AS item_count,
                 GROUP_CONCAT(i.name ORDER BY i.name SEPARATOR ', ') AS itens
                 FROM orders o
                 LEFT JOIN order_items oi ON o.id = oi.order_id
                 LEFT JOIN items i ON oi.item_id = i.id
                 WHERE o.status = 'Aberto'
                 GROUP BY o.id ORDER BY o.id DESC`
            );
            const [delivered] = await pool.query(
                `SELECT o.id, o.customer_name, o.size, o.delivered_to, o.delivered_at,
                 COUNT(oi.item_id) AS item_count,
                 GROUP_CONCAT(i.name ORDER BY i.name SEPARATOR ', ') AS itens
                 FROM orders o
                 LEFT JOIN order_items oi ON o.id = oi.order_id
                 LEFT JOIN items i ON oi.item_id = i.id
                 WHERE o.status = 'Entregue'
                 GROUP BY o.id ORDER BY o.delivered_at DESC`
            );
            const { msg, type } = req.query;
            res.render('dashboard', { items, orders, delivered, toastMsg: msg || null, toastType: type || null });
        } catch {
            res.status(500).send('Erro ao carregar dashboard.');
        }
    });

    return app;
}

module.exports = { createApp };
