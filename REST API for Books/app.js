const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');

const app = express();

app.use(helmet());

app.use(express.json({ limit: '10kb' }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
  })
);

let books = [];

app.get('/', (req, res) => {
  res.type('html').send(`
    <html>
    <head>
      <title>Books API</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
        h1 { color: #333; }
        p { color: #555; }
        .curl-box { background: #272822; color: #f8f8f2; padding: 15px; border-radius: 6px; display: inline-block; font-family: monospace; text-align: left; margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>Welcome to the Books API!</h1>
      <p>Use <code>/books</code> to get all books or add a new book.</p>
      
      <div class="curl-box">
        <h3>Example curl commands:</h3>
        <p><strong>GET all books:</strong></p>
        <code>curl http://localhost:3000/books</code>
        <p><strong>POST a new book:</strong></p>
        <code>curl -X POST -H "Content-Type: application/json" -d '{"title":"Book Title","author":"Author Name"}' http://localhost:3000/books</code>
      </div>
    </body>
    </html>
  `);
});

app.get('/books', (req, res) => {
  app.set('json spaces', 2);
  res.json(books);
});

app.post(
  '/books',
  [
    body('title')
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 }),
    body('author')
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, author } = req.body;

    const newBook = {
      id: crypto.randomUUID(),
      title,
      author
    };

    books.push(newBook);
    res.status(201).json(newBook);
  }
);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});