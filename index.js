const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 10000;

// Habilitar CORS para todas as origens
app.use(cors());

// Rota para proxy
app.get('/api/matches/live', async (req, res) => {
    try {
        const response = await fetch('https://api.caveiratips.com/api/v1/matches/live', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Falha na requisição: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        res.status(500).json({ error: 'Erro ao buscar dados da API' });
    }
});


app.get('/api/historico/partidas', async (req, res) => {
    try {
        const response = await fetch('https://api.caveiratips.com/api/v1/historico/partidas?page=1&limit=20', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Falha na requisição: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        res.status(500).json({ error: 'Erro ao buscar dados da API' });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});