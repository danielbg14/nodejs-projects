const express = require('express');
const app = express();
require('dotenv').config();
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

app.use(helmet());

const username = process.env.USER || 'admin';
const password = process.env.PASSWORD || 'password';

app.get('/', (req, res) => {
    res.send('Go inside the /login to login inside');
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000000,
    message: 'Too many login attempts, please try again later.'
});

function checkBasicAuth(authHeader) {
    if (!authHeader) return false;

    const parts = authHeader.trim().split(' ');
    if (parts.length !== 2) return false;

    const [type, credentials] = parts;
    if (type.toLowerCase() !== 'basic') return false;

    let decoded;
    try {
        decoded = Buffer.from(credentials, 'base64').toString('utf-8');
    } catch {
        return false; // invalid base64
    }

    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) return false;

    const inputUsername = decoded.slice(0, separatorIndex).trim();
    const inputPassword = decoded.slice(separatorIndex + 1).trim();
    return inputUsername === username && inputPassword === password;
}

app.use('/login', loginLimiter);
app.get('/login', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!checkBasicAuth(authHeader)) {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Authentication failed');
    }
    res.send('Login successful!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});