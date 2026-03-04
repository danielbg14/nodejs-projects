const express = require('express');
const app = express();
const mysql = require('mysql');
require('dotenv').config();
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

app.use(helmet());

// Create a MySQL connection pool
const pool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

let allowedTables = [];

pool.query('SHOW TABLES', (err, results) => {
    if (err) return;
    const dbTables = results.map(row => Object.values(row)[0]);
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

// ----------------- Swagger Setup -----------------
const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "MySQL Inspector API",
            version: "1.0.0",
            description: "API to explore MySQL database tables and data",
        },
    },
    apis: ["./app.js"], // adjust if your filename differs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ----------------- Routes -----------------

/**
 * @swagger
 * /:
 *   get:
 *     summary: Landing page with usage info
 *     responses:
 *       200:
 *         description: HTML page with API instructions
 */
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>MySQL Inspector API</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                h1 { color: #333; }
                .box { background: white; padding: 20px; border-radius: 6px; margin-top: 20px; }
                code { background: #eee; padding: 4px 6px; border-radius: 4px; }
                pre { background: #272822; color: #f8f8f2; padding: 15px; border-radius: 6px; overflow-x: auto; }
            </style>
        </head>
        <body>
            <h1>MySQL Database Inspector</h1>
            <p>This API lets you explore your MySQL database structure and data.</p>

            <div class="box">
                <h2>Available Endpoints</h2>
                <p><strong>Database connection check</strong></p><code>GET /dbcheck</code>
                <p><strong>List all tables</strong></p><code>GET /tables</code>
                <p><strong>Get table columns</strong></p><code>GET /tables/:tableName/columns</code>
                <p><strong>Get table rows</strong></p><code>GET /tables/:tableName/lines</code>
            </div>
        </body>
        </html>
    `);
});

/**
 * @swagger
 * /dbcheck:
 *   get:
 *     summary: Check database connection
 *     responses:
 *       200:
 *         description: Database connection is healthy
 *       500:
 *         description: Database connection failed
 */
app.get('/dbcheck', (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) return res.status(500).json({ status: 'error', message: 'Database connection failed' });
        connection.ping(err => {
            connection.release();
            if (err) return res.status(500).json({ status: 'error', message: 'Database ping failed' });
            res.json({ status: 'success', message: 'Database connection is healthy' });
        });
    });
});

/**
 * @swagger
 * /tables:
 *   get:
 *     summary: List all allowed tables
 *     responses:
 *       200:
 *         description: Array of table names
 */
app.get('/tables', (req, res) => {
    res.json({ tables: allowedTables });
});

/**
 * @swagger
 * /tables/{tableName}/columns:
 *   get:
 *     summary: Get columns of a specific table
 *     parameters:
 *       - in: path
 *         name: tableName
 *         required: true
 *         schema:
 *           type: string
 *         description: Table name
 *     responses:
 *       200:
 *         description: Array of columns
 *       400:
 *         description: Invalid table name
 *       500:
 *         description: Database query failed
 */
app.get('/tables/:tableName/columns', validateTable, (req, res) => {
    const tableName = req.params.tableName;
    pool.query(`SHOW COLUMNS FROM \`${tableName}\``, (error, results) => {
        if (error) return res.status(500).json({ error: 'Database query failed' });
        const columns = results.map(row => ({
            Field: row.Field,
            Type: row.Type,
            Null: row.Null,
            Key: row.Key,
            Default: row.Default,
            Extra: row.Extra
        }));
        res.json({ columns });
    });
});

/**
 * @swagger
 * /tables/{tableName}/lines:
 *   get:
 *     summary: Get rows from a table
 *     parameters:
 *       - in: path
 *         name: tableName
 *         required: true
 *         schema:
 *           type: string
 *         description: Table name
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of rows to return (max 500)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Row offset
 *     responses:
 *       200:
 *         description: Array of rows
 *       400:
 *         description: Invalid table name
 *       500:
 *         description: Database query failed
 */
app.get('/tables/:tableName/lines', validateTable, (req, res) => {
    const tableName = req.params.tableName;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = parseInt(req.query.offset) || 0;

    pool.query(`SELECT * FROM \`${tableName}\` LIMIT ? OFFSET ?`, [limit, offset], (error, results) => {
        if (error) return res.status(500).json({ error: 'Database query failed' });
        res.json({ lines: results });
    });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/docs`);
});