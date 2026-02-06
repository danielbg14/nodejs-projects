const express = require('express');
const app = express();

// Middleware to parse URL-encoded form data and JSON body
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // For curl POST requests with JSON

// Homepage with form + curl instructions
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Message App</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                input[type=text] { width: 300px; padding: 10px; font-size: 16px; }
                button { padding: 10px 20px; font-size: 16px; margin-left: 10px; cursor: pointer; }
                h1 { color: #333; }
                p { color: #555; }
                a { text-decoration: none; color: #007bff; }
                a:hover { text-decoration: underline; }
                .message-box { margin-top: 20px; padding: 20px; border: 1px solid #ddd; display: inline-block; background: #f9f9f9; border-radius: 8px; }
                .curl-box { background: #272822; color: #f8f8f2; padding: 15px; border-radius: 6px; display: inline-block; font-family: monospace; margin-top: 20px; text-align: left; }
            </style>
        </head>
        <body>
            <h1>Welcome to the Message App!</h1>
            <p>Type your message below or use the URL /print?msg=your_message</p>
            
            <form action="/print" method="get">
                <input type="text" name="msg" placeholder="Enter your message" required>
                <button type="submit">Send</button>
            </form>

            <div class="curl-box">
                <h3>Try with curl:</h3>
                <p><strong>GET request:</strong></p>
                <code>curl "http://localhost:3000/print?msg=HelloWorld"</code>
                <p><strong>POST request:</strong></p>
                <code>curl -X POST -H "Content-Type: application/json" -d '{"msg":"Hello via POST"}' http://localhost:3000/print</code>
            </div>
        </body>
        </html>
    `);
});

// Handle GET requests (form submission or URL)
app.get('/print', (req, res) => {
    const message = req.query.msg;

    if (!message) {
        return res.status(400).send("<p>Please provide a message!</p><a href='/'>Go back</a>");
    }

    console.log(`Received message: ${message}`);

    res.send(`
        <html>
        <head>
            <title>Your Message</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                .message-box { margin-top: 20px; padding: 20px; border: 1px solid #ddd; display: inline-block; background: #f9f9f9; border-radius: 8px; font-size: 18px; }
                a { text-decoration: none; color: #007bff; display: block; margin-top: 20px; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <h2>Your Message:</h2>
            <div class="message-box">${message}</div>
            <a href="/">Go back</a>
        </body>
        </html>
    `);
});

// Handle POST requests (for curl or JSON body)
app.post('/print', (req, res) => {
    const message = req.body.msg;

    if (!message) {
        return res.status(400).json({ error: "Please provide a 'msg' in the request body." });
    }

    console.log(`Received message via POST: ${message}`);

    res.json({ message: `The message you sent via POST: ${message}` });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});