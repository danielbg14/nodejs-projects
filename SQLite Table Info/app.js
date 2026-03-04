const express = require('express');
const app = express();
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();
const helmet = require('helmet');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

app.use(helmet());

// ------------------- SQLite Setup -------------------
const dbFile = process.env.DB_FILE || path.join(__dirname, 'test.db');
const db = new sqlite3.Database(dbFile);

let allowedTables = [];

const initTables = () => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) return console.error('Failed to fetch tables:', err);

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

// ------------------- Swagger Setup -------------------
const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "SQLite Inspector API",
            version: "1.0.0",
            description: "API to inspect your SQLite database structure and data"
        }
    },
    apis: ["./app.js"] // adjust if your filename differs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ------------------- Helper -------------------
const validateTable = (req, res, next) => {
    const tableName = req.params.tableName;

    if (!allowedTables.length) return res.status(503).json({ error: 'Tables not initialized yet' });
    if (!allowedTables.includes(tableName)) return res.status(400).json({ error: 'Invalid table name' });

    next();
};

// ------------------- Routes -------------------

/**
 * @swagger
 * /:
 *   get:
 *     summary: Landing page
 *     description: HTML instructions and endpoint overview
 *     responses:
 *       200:
 *         description: HTML landing page
 */
app.get('/', (req, res) => {
    res.type('html').send(`
        <h1>SQLite Database Inspector</h1>
        <p>Endpoints:</p>
        <ul>
            <li>GET /dbcheck</li>
            <li>GET /tables</li>
            <li>GET /tables/:tableName/columns</li>
            <li>GET /tables/:tableName/lines</li>
        </ul>
        <p>Swagger docs: <a href="/docs">/docs</a></p>
    `);
});

/**
 * @swagger
 * /dbcheck:
 *   get:
 *     summary: Check DB connection
 *     responses:
 *       200:
 *         description: Database connection is healthy
 */
app.get('/dbcheck', (req, res) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: 'DB error', error: err.message });
        if (rows.length === 0) return res.status(500).json({ status: 'error', message: 'No tables found in database' });
        res.json({ status: 'success', message: 'Database connection is healthy', tables: rows.map(r => r.name) });
    });
});

/**
 * @swagger
 * /tables:
 *   get:
 *     summary: List allowed tables
 *     responses:
 *       200:
 *         description: Array of table names
 */
app.get('/tables', (req, res) => {
    app.set('json spaces', 2);
    res.json({ tables: allowedTables });
});

/**
 * @swagger
 * /tables/{tableName}/columns:
 *   get:
 *     summary: Get table columns
 *     parameters:
 *       - name: tableName
 *         in: path
 *         required: true
 *         description: Name of the table
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Columns information
 */
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

/**
 * @swagger
 * /tables/{tableName}/lines:
 *   get:
 *     summary: Get table rows
 *     parameters:
 *       - name: tableName
 *         in: path
 *         required: true
 *         description: Name of the table
 *         schema:
 *           type: string
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *         description: Max number of rows
 *       - name: offset
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *         description: Number of rows to skip
 *     responses:
 *       200:
 *         description: Table rows
 */
app.get('/tables/:tableName/lines', validateTable, (req, res) => {
    const tableName = req.params.tableName;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = parseInt(req.query.offset) || 0;

    db.all(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`, [limit, offset], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database query failed', details: err.message });
        res.json({ lines: rows });
    });
});

// ------------------- Start Server -------------------
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/docs`);
});