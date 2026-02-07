const express = require('express');
const app = express();
const sql = require('mssql');
require('dotenv').config();
const helmet = require('helmet');

app.use(helmet());
app.use(express.json());

// Create a MSSQL connection
const mssqlConfig = {
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    server: process.env.MSSQL_HOST,
    database: process.env.MSSQL_DB,
    options: {
        encrypt: false,          // set true if using Azure
        trustServerCertificate: true
    }
};

let allowedTables = [];

const initTables = async () => {
    try {
        const pool = await sql.connect(mssqlConfig);
        const result = await pool.request()
            .query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'`);
        
        const dbTables = result.recordset.map(r => r.TABLE_NAME);

        if (process.env.ALLOWED_TABLES) {
            const envTables = process.env.ALLOWED_TABLES.split(',').map(t => t.trim());
            allowedTables = dbTables.filter(t => envTables.includes(t));
        } else {
            allowedTables = dbTables;
        }

        console.log('Allowed MSSQL tables:', allowedTables);
    } catch (err) {
        console.error('Failed to initialize MSSQL tables:', err);
    }
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
            <title>MSSQL Inspector API</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                h1 { color: #333; }
                .box { background: white; padding: 20px; border-radius: 6px; margin-top: 20px; }
                code { background: #eee; padding: 4px 6px; border-radius: 4px; }
                pre { background: #272822; color: #f8f8f2; padding: 15px; border-radius: 6px; overflow-x: auto; }
            </style>
        </head>
        <body>
            <h1>MSSQL Database Inspector</h1>
            <p>This API lets you explore your MSSQL database structure and data.</p>

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

app.get('/dbcheck', async (req, res) => {
    try {
        const pool = await sql.connect(mssqlConfig);
        await pool.request().query('SELECT 1');
        res.json({ status: 'success', message: 'Database connection is healthy' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database connection failed', error: err.message });
    }
});

app.get('/tables', async (req, res) => {
    app.set('json spaces', 2);
    res.json({ tables: allowedTables });
});

app.get('/tables/:tableName/columns', validateTable, async (req, res) => {
    app.set('json spaces', 2);
    const tableName = req.params.tableName;
    try {
        const pool = await sql.connect(mssqlConfig);
        const result = await pool.request()
            .query(`SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME='${tableName}'`);

        const columns = result.recordset.map(c => ({
            Field: c.COLUMN_NAME,
            Type: c.DATA_TYPE,
            Null: c.IS_NULLABLE,
            Default: c.COLUMN_DEFAULT,
            Key: '',
            Extra: ''
        }));

        res.json({ columns });
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
        const pool = await sql.connect(mssqlConfig);
        const result = await pool.request()
            .query(`SELECT * FROM [${tableName}] ORDER BY 1 OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`);

        res.json({ lines: result.recordset });
    } catch (err) {
        res.status(500).json({ error: 'Database query failed', details: err.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});