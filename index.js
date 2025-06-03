const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());

let accessToken = null;
let refreshToken = null;

async function captureAuthorizationToken() {
  try {
    const loginUrl = 'https://api.caveiratips.com/api/v1/auth/token/';
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://caveiratips.com',
        'Referer': 'https://caveiratips.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        username: process.env.API_USERNAME,
        password: process.env.API_PASSWORD,
      }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao capturar token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    accessToken = data.access_token; // Ajuste conforme o campo real
    refreshToken = data.refresh_token || null;
    console.log('Novo token capturado:', accessToken);
    return { accessToken, refreshToken };
  } catch (error) {
    console.error('Erro ao capturar token:', error);
    throw error;
  }
}

async function ensureValidToken(req, res, next) {
  try {
    if (!accessToken) {
      console.log('Nenhum token disponível, capturando novo token...');
      const tokens = await captureAuthorizationToken();
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
    }
    req.accessToken = accessToken;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Falha ao obter o token de autorização' });
  }
}

app.get('/api/matches/live', ensureValidToken, async (req, res) => {
  try {
    const response = await fetch('https://api.caveiratips.com/api/v1/matches/live', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Falha na requisição: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar dados ao vivo:', error);
    res.status(500).json({ error: 'Erro ao buscar dados da API ao vivo' });
  }
});

app.get('/api/historico/partidas', ensureValidToken, async (req, res) => {
  try {
    const response = await fetch('https://api.caveiratips.com/api/v1/historico/partidas?page=1&limit=20', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Falha na requisição: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar dados de jogos finalizados:', error);
    res.status(500).json({ error: 'Erro ao buscar dados da API de jogos finalizados' });
  }
});

app.get('/api/v1/analises/confrontos-completo/:player1/:player2', ensureValidToken, async (req, res) => {
  try {
    const { player1, player2 } = req.params;
    const url = `https://api.caveiratips.com/api/v1/analises/confrontos-completo/${player1}/${player2}`;
    console.log(`Proxy: Buscando H2H em ${url} para ${player1} vs ${player2}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.accessToken}`,
        'Origin': 'https://caveiratips.com',
        'Referer': 'https://caveiratips.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
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

app.get('/api/historico/partidas-assincrono', ensureValidToken, async (req, res) => {
  try {
    const { jogador, limit = 10, page = 1 } = req.query;
    if (!jogador) {
      return res.status(400).json({ error: 'Parâmetro "jogador" é obrigatório' });
    }
    const url = `https://api.caveiratips.com/api/v1/historico/partidas-assincrono?jogador=${encodeURIComponent(jogador)}&limit=${limit}&page=${page}`;
    console.log(`Proxy: Buscando histórico em ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.accessToken}`,
        'Origin': 'https://caveiratips.com',
        'Referer': 'https://caveiratips.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Falha na requisição: ${response.status} ${response.statusText}. Detalhes: ${errorText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar histórico de partidas:', error);
    res.status(500).json({ error: 'Erro ao buscar dados da API de histórico' });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});