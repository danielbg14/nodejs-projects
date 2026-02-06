const express = require('express');
const app = express();
const mysql = require('mysql');
require('dotenv').config();

// Create a MySQL connection pool
const pool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>MySQL Inspector API</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 40px;
                    background: #f5f5f5;
                }
                h1 {
                    color: #333;
                }
                .box {
                    background: white;
                    padding: 20px;
                    border-radius: 6px;
                    margin-top: 20px;
                }
                code {
                    background: #eee;
                    padding: 4px 6px;
                    border-radius: 4px;
                }
                pre {
                    background: #272822;
                    color: #f8f8f2;
                    padding: 15px;
                    border-radius: 6px;
                    overflow-x: auto;
                }
            </style>
        </head>
        <body>
            <h1>MySQL Database Inspector</h1>
            <p>This API lets you explore your MySQL database structure and data.</p>

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

// Endpoint to get all tables in the database
app.get('/tables', (req, res) => {
    pool.query('SHOW TABLES', (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query failed' });
        }
        const tables = results.map(row => Object.values(row)[0]);
        res.json({ tables });
    });
});

// Endpoint to get columns of a specific table
app.get('/tables/:tableName/columns', (req, res) => {
    const tableName = req.params.tableName;
    pool.query(`SHOW COLUMNS FROM \`${tableName}\``, (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query failed' });
        }
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

app.get('/tables/:tableName/lines', (req, res) => {
    const tableName = req.params.tableName;
    pool.query(`SELECT * FROM \`${tableName}\``, (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query failed' });
        }
        res.json({ lines: results });
    });
});

app.get('/dbcheck' , (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database connection failed' });
        }
        connection.ping(err => {
            connection.release();
            if (err) {
                return res.status(500).json({ status: 'error', message: 'Database ping failed' });
            }
            res.json({ status: 'success', message: 'Database connection is healthy' });
        });
    });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});