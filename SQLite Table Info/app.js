const express = require('express');
const app = express();
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();
const helmet = require('helmet');
const path = require('path');

app.use(helmet());

// Create a SQLite connection
const dbFile = process.env.DB_FILE || path.join(__dirname, 'test.db');
const db = new sqlite3.Database(dbFile);

let allowedTables = [];

const initTables = () => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) {
            console.error('Failed to fetch tables:', err);
            return;
        }

        // Make sure rows is an array
        const dbTables = rows.map(r => r.name);

        if (process.env.ALLOWED_TABLES) {
            const envTables = process.env.ALLOWED_TABLES.split(',').map(t => t.trim());
            allowedTables = dbTables.filter(t => envTables.includes(t));
        } else {
            allowedTables = dbTables;
        }

        console.log('Allowed tables:', allowedTables);
    });
};

initTables();

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
            <title>SQLite  Inspector API</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                h1 { color: #333; }
                .box { background: white; padding: 20px; border-radius: 6px; margin-top: 20px; }
                code { background: #eee; padding: 4px 6px; border-radius: 4px; }
                pre { background: #272822; color: #f8f8f2; padding: 15px; border-radius: 6px; overflow-x: auto; }
            </style>
        </head>
        <body>
            <h1>SQLite  Database Inspector</h1>
            <p>This API lets you explore your SQLite database structure and data.</p>

            <div class="box">
                <h2>Available Endpoints</h2>

                <p><strong>Database connection check</strong></p>
                <code>GET /dbcheck</code>

                <p><strong>List all tables</strong></p>
                <code>GET /tables</code>

                <p><strong>Get table columns</strong></p>
                <code>GET /tables/:tableName/columns</code>

                <p><strong>Get table rows</strong></p>
                <code>GET /tables/:tableName/lines</code>
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

app.get('/dbcheck', (req, res) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: 'DB error', error: err.message });
        if (rows.length === 0) {
            return res.status(500).json({ status: 'error', message: 'No tables found in database' });
        }
        res.json({ status: 'success', message: 'Database connection is healthy', tables: rows.map(r => r.name) });
    });
});

app.get('/tables', (req, res) => {
    app.set('json spaces', 2);
    res.json({ tables: allowedTables });
});

app.get('/tables/:tableName/columns', validateTable, (req, res) => {
    const tableName = req.params.tableName;
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database query failed', details: err.message });
        const columns = rows.map(col => ({
            Field: col.name,
            Type: col.type,
            Null: col.notnull ? 'NO' : 'YES',
            Default: col.dflt_value,
            Key: col.pk ? 'PRI' : '',
            Extra: ''
        }));
        res.json({ columns });
    });
});

app.get('/tables/:tableName/lines', validateTable, (req, res) => {
    const tableName = req.params.tableName;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = parseInt(req.query.offset) || 0;

    db.all(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`, [limit, offset], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database query failed', details: err.message });
        res.json({ lines: rows });
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});