const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/api/matches/live', async (req, res) => {
    try {
        const response = await fetch('https://api.caveiratips.com/api/v1/matches/live');

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Resposta completa:', text);

        res.status(response.status).send(text);
    } catch (err) {
        console.error('Erro ao buscar dados:', err);
        res.status(500).json({ error: 'Erro ao buscar dados da API' });
    }
});