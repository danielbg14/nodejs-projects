const express = require('express');
const app = express();
const { Pool } = require('pg');
require('dotenv').config();
const helmet = require('helmet');

app.use(helmet());

// Create a PostgreSQL connection pool
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: 10
});

let allowedTables = [];

pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'", (err, result) => {
    if (err) return console.error('Error fetching tables:', err);

    const dbTables = result.rows.map(row => row.tablename);

    if (process.env.ALLOWED_TABLES) {
        const envTables = process.env.ALLOWED_TABLES.split(',').map(t => t.trim());
        allowedTables = dbTables.filter(t => envTables.includes(t));
    } else {
        allowedTables = dbTables;
    }
});

const validateTable = (req, res, next) => {
    const tableName = req.params.tableName;

    if (!allowedTables.length) {
        return res.status(503).json({ error: 'Tables not initialized yet' });
    }

    if (!allowedTables.includes(tableName)) {
        return res.status(400).json({ error: 'Invalid table name' });
    }

    next();
};

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>PostgreSQL Inspector API</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                h1 { color: #333; }
                .box { background: white; padding: 20px; border-radius: 6px; margin-top: 20px; }
                code { background: #eee; padding: 4px 6px; border-radius: 4px; }
                pre { background: #272822; color: #f8f8f2; padding: 15px; border-radius: 6px; overflow-x: auto; }
            </style>
        </head>
        <body>
            <h1>PostgreSQL Database Inspector</h1>
            <p>This API lets you explore your PostgreSQL database structure and data.</p>
            <div class="box">
                <h2>Available Endpoints</h2>
                <p><strong>Database connection check</strong></p><code>GET /dbcheck</code>
                <p><strong>List all tables</strong></p><code>GET /tables</code>
                <p><strong>Get table columns</strong></p><code>GET /tables/:tableName/columns</code>
                <p><strong>Get table rows</strong></p><code>GET /tables/:tableName/lines</code>
            </div>
            <div class="box">
                <h2>Example curl</h2>
                <pre>curl http://localhost:3000/dbcheck</pre>
                <pre>curl http://localhost:3000/tables</pre>
                <pre>curl http://localhost:3000/tables/users/columns</pre>
                <pre>curl http://localhost:3000/tables/users/lines</pre>
            </div>
        </body>
        </html>
    `);
});

app.get('/dbcheck', async (req, res) => {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        res.json({ status: 'success', message: 'Database connection is healthy' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database connection failed', error: err.message });
    }
});

app.get('/tables', (req, res) => {
    app.set('json spaces', 2);
    res.json({ tables: allowedTables });
});

app.get('/tables/:tableName/columns', validateTable, async (req, res) => {
    app.set('json spaces', 2);
    const tableName = req.params.tableName;
    try {
        const query = `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position
        `;
        const result = await pool.query(query, [tableName]);
        res.json({ columns: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Database query failed', details: err.message });
    }
});

app.get('/tables/:tableName/lines', validateTable, async (req, res) => {
    app.set('json spaces', 2);
    const tableName = req.params.tableName;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = parseInt(req.query.offset) || 0;

    try {
        const result = await pool.query(`SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`, [limit, offset]);
        res.json({ lines: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Database query failed', details: err.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});