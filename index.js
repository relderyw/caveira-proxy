const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 10000;

// Habilitar CORS para todas as origens
app.use(cors());

// Rota para proxy de jogos ao vivo
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

// Rota para proxy de jogos finalizados
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

// Nova rota para proxy de análises H2H
app.get('/api/h2h/:player1/:player2', async (req, res) => {
    try {
        const { player1, player2 } = req.params;
        const url = `https://api.caveiratips.com/api/v1/analises/confrontos-completo/${player1}/${player2}`;
        console.log(`Proxy: Buscando H2H em ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzQ4NzcxNTg0LCJpYXQiOjE3NDg3Njc5ODQsImp0aSI6IjFlZTcxMzA4ZjQ0MDQwYjI4Nzk0MDM4NThlMTM3ZGU4IiwidXNlcl9pZCI6MTgyfQ.docCFUbkqT2L5qiYHOxBNkMv1JbFj5NvzuJ3apjgI_A`,
                'Origin': 'https://caveiratips.com',
                'Referer': 'https://caveiratips.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-site',
                'Sec-Fetch-Dest': 'empty',
                'Priority': 'u=1, i'
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Falha na requisição: ${response.status} ${response.statusText}. Detalhes: ${errorText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar dados H2H:', error);
        res.status(500).json({ error: 'Erro ao buscar dados da API H2H' });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});