const express = require('express');
const app = express();
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// ------------------- Security & Middleware -------------------
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: "Too many requests, please try again after a minute."
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ------------------- Swagger Setup -------------------
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Message App API",
            version: "1.0.0",
            description: "API to send and display messages via GET or POST",
        },
    },
    apis: ["./app.js"], // path to this file
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ------------------- HTML Escape Utility -------------------
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ------------------- Routes -------------------

/**
 * @swagger
 * /:
 *   get:
 *     summary: Root endpoint
 *     description: Provides HTML instructions for using the Message App
 *     responses:
 *       200:
 *         description: Instruction page
 */
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

/**
 * @swagger
 * /print:
 *   get:
 *     summary: Display a message via query parameter
 *     description: Sends a GET request with `msg` query parameter to display the message
 *     parameters:
 *       - in: query
 *         name: msg
 *         required: true
 *         schema:
 *           type: string
 *         description: The message to display
 *     responses:
 *       200:
 *         description: Message displayed successfully
 *       400:
 *         description: Missing `msg` query parameter
 */
app.use('/print', limiter);
app.get('/print', (req, res) => {
    const message = req.query.msg;

    if (!message) {
        return res.status(400).send("<p>Please provide a message!</p><a href='/'>Go back</a>");
    }

    console.log(`Received message via GET: ${message}`);
    const safeMessage = escapeHtml(message);

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
            <div class="message-box">${safeMessage}</div>
            <a href="/">Go back</a>
        </body>
        </html>
    `);
});

/**
 * @swagger
 * /print:
 *   post:
 *     summary: Display a message via POST
 *     description: Sends a POST request with a JSON body like {"msg":"your message"} to display the message
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               msg:
 *                 type: string
 *                 description: The message to display
 *                 example: Hello via POST
 *     responses:
 *       200:
 *         description: Message returned successfully
 *       400:
 *         description: Missing 'msg' in request body
 */
app.post('/print', limiter, (req, res) => {
    const message = req.body.msg;

    if (!message) {
        return res.status(400).json({ error: "Please provide a 'msg' in the request body." });
    }

    console.log(`Received message via POST: ${message}`);
    res.json({ message: `The message you sent via POST: ${message}` });
});

// ------------------- Start Server -------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
    console.log(`Swagger docs available at http://127.0.0.1:${PORT}/docs`);
});