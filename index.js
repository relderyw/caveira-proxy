const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/api/matches/live', async (req, res) => {
    try {
        const response = await fetch('https://api.caveiratips.com/api/v1/matches/live', {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://caveiratips.com',
                'Origin': 'https://caveiratips.com'
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Erro ao buscar dados:', err);
        res.status(500).json({ error: 'Erro ao buscar dados da API' });
    }
});

app.get('/', (req, res) => {
    res.send('Servidor proxy Caveira funcionando!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
