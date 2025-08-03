const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT;

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
    accessToken = data.access_token;
    refreshToken = data.refresh_token || null;
    console.log('Novo token capturado:', accessToken);
    return { accessToken, refreshToken };
  } catch (error) {
    console.error('Erro ao capturar token:', error.message);
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
    res.status(500).json({代替: 'Erro ao buscar dados da API ao vivo' });
  }
});

app.get('/api/historico/partidas', ensureValidToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ error: 'Parâmetro "page" deve ser um número positivo' });
    }
    if (isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({ error: 'Parâmetro "limit" deve ser um número positivo' });
    }

    const url = `https://api.caveiratips.com/api/v1/historico/partidas?page=${pageNum}&limit=${limitNum}`;
    console.log(`Proxy: Buscando histórico de partidas em ${url}`);

    const response = await fetch(url, {
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

app.get('/api/v1/historico/partidas-assincrono', ensureValidToken, async (req, res) => {
  try {
    const { jogador, limit = 10, page = 1 } = req.query;
    if (!jogador) {
      return res.status(400).json({ error: 'Parâmetro "jogador" é obrigatório' });
    }

    const url = `https://api.caveiratips.com/api/v1/historico/partidas-assincrono?jogador=${encodeURIComponent(jogador)}&limit=${limit}&page=${page}`;
    console.log(`Proxy: Buscando histórico assíncrono em ${url}`);

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
      console.log(`Detalhes do erro da API partidas-assincrono: ${errorText}`);
      throw new Error(`Falha na requisição: ${response.status} ${response.statusText}. Detalhes: ${errorText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar dados de partidas assíncronas:', error);
    res.status(500).json({ error: 'Erro ao buscar dados da API de partidas assíncronas' });
  }
});

app.get('/api/v1/historico/confronto/:player1/:player2', ensureValidToken, async (req, res) => {
  try {
    const { player1, player2 } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!player1 || !player2) {
      return res.status(400).json({ error: 'Parâmetros "player1" e "player2" são obrigatórios' });
    }

    const url = `https://api.caveiratips.com/api/v1/historico/confronto/${encodeURIComponent(player1)}/${encodeURIComponent(player2)}?page=${page}&limit=${limit}`;
    console.log(`Proxy: Buscando confronto H2H em ${url}`);

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
      console.log(`Detalhes do erro da API confronto: ${errorText}`);
      throw new Error(`Falha na requisição: ${response.status} ${response.statusText}. Detalhes: ${errorText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar dados de confronto H2H:', error);
    res.status(500).json({ error: 'Erro ao buscar dados da API de confronto H2H' });
  }
});

app.get('/api/scraped-matches', async (req, res) => {
  try {
    const url = 'https://api-pre-live.caveiratips.com.br/api/v1/scraped-matches?league_ids=10047781%2C10083563%2C10082427%2C10048705';
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.SCRAPED_MATCHES_API_KEY,
        'Accept': '*/*',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Falha na requisição: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar dados de partidas scraped:', error);
    res.status(500).json({ error: 'Erro ao buscar dados da API de partidas scraped' });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});