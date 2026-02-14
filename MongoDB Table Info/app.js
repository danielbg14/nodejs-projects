const express = require('express');
const app = express();
const { MongoClient } = require('mongodb');
require('dotenv').config();
const helmet = require('helmet');

app.use(helmet());

// MongoDB connection
// MongoDB connection
let uri;
if (process.env.DB_USER && process.env.DB_PASSWORD) {
    uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}`;
} else {
    uri = `mongodb://${process.env.DB_HOST}:${process.env.DB_PORT}`;
}

const client = new MongoClient(uri);

let db;
let allowedCollections = [];

// Connect to MongoDB
async function initDb() {
    try {
        await client.connect();
        db = client.db(process.env.DB_NAME);
        const collections = await db.listCollections().toArray();
        const dbCollections = collections.map(c => c.name);

        if (process.env.ALLOWED_TABLES) {
            const envCollections = process.env.ALLOWED_TABLES.split(',').map(t => t.trim());
            allowedCollections = dbCollections.filter(c => envCollections.includes(c));
        } else {
            allowedCollections = dbCollections;
        }

        console.log('MongoDB connected. Allowed collections:', allowedCollections);
    } catch (err) {
        console.error('MongoDB connection error:', err);
    }
}

initDb();

const validateCollection = (req, res, next) => {
    const collectionName = req.params.tableName;

    if (!allowedCollections.length) {
        return res.status(503).json({ error: 'Collections not initialized yet' });
    }

    if (!allowedCollections.includes(collectionName)) {
        return res.status(400).json({ error: 'Invalid collection name' });
    }

    next();
};

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>MongoDB Inspector API</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                h1 { color: #333; }
                .box { background: white; padding: 20px; border-radius: 6px; margin-top: 20px; }
                code { background: #eee; padding: 4px 6px; border-radius: 4px; }
                pre { background: #272822; color: #f8f8f2; padding: 15px; border-radius: 6px; overflow-x: auto; }
            </style>
        </head>
        <body>
            <h1>MongoDB Database Inspector</h1>
            <p>This API lets you explore your MongoDB database structure and data.</p>

            <div class="box">
                <h2>Available Endpoints</h2>

                <p><strong>Database connection check</strong></p>
                <code>GET /dbcheck</code>

                <p><strong>List all collections</strong></p>
                <code>GET /tables</code>

                <p><strong>Get collection fields</strong></p>
                <code>GET /tables/:tableName/columns</code>

                <p><strong>Get collection documents</strong></p>
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

// DB check
app.get('/dbcheck', async (req, res) => {
    app.set('json spaces', 2);
    try {
        await db.command({ ping: 1 });
        res.json({ status: 'success', message: 'Database connection is healthy' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database ping failed' });
    }
});

// List all allowed collections
app.get('/tables', (req, res) => {
    app.set('json spaces', 2);
    res.json({ tables: allowedCollections });
});

// Get fields of a collection (sample first document)
app.get('/tables/:tableName/columns', validateCollection, async (req, res) => {
    app.set('json spaces', 2);
    try {
        const collectionName = req.params.tableName;
        const doc = await db.collection(collectionName).findOne();
        if (!doc) return res.json({ columns: [] });
        const columns = Object.keys(doc).map(key => ({ Field: key, Type: typeof doc[key] }));
        res.json({ columns });
    } catch (err) {
        res.status(500).json({ error: 'Database query failed' });
    }
});

// Get documents from a collection
app.get('/tables/:tableName/lines', validateCollection, async (req, res) => {
    app.set('json spaces', 2);
    try {
        const collectionName = req.params.tableName;
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const skip = parseInt(req.query.offset) || 0;

        const docs = await db.collection(collectionName).find().skip(skip).limit(limit).toArray();
        res.json({ lines: docs });
    } catch (err) {
        res.status(500).json({ error: 'Database query failed' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});