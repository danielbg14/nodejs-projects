const express = require('express');
const app = express();

const username = 'admin';
const password = 'password';

app.get('/', (req, res) => {
    res.send('Go inside the /login to login inside');
});

app.get('/login', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Authentication required');
    }

    const [type, credentials] = authHeader.split(' ');
    if (type !== 'Basic') {
        return res.status(400).send('Invalid authentication type');
    }

    const decodedCredentials = Buffer.from(credentials, 'base64').toString('utf-8');
    const [inputUsername, inputPassword] = decodedCredentials.split(':');
    
    if (inputUsername === username && inputPassword === password) {
        res.send('Login successful!');
    } else {
        res.setHeader('WWW-Authenticate', 'Basic');
        res.status(401).send('Invalid credentials');
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});