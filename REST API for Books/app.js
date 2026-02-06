const express = require('express');
const app = express();
app.use(express.json());

let books = [];

app.get('/', (req, res) => {
  res.send(`
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

// Get all books
app.get('/books', (req, res) => {
  res.json(books);
});

// Add a new book
app.post('/books', (req, res) => {
  const { title, author } = req.body;
  if (!title || !author) {
    return res.status(400).json({ error: 'Title and author are required' });
  }
  const newBook = { id: books.length + 1, title, author };
  books.push(newBook);
  res.status(201).json(newBook);
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});