const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 10000;

// Habilitar CORS para todas as origens
app.use(cors());

// Variáveis globais para armazenar os tokens
let accessToken = null;
let refreshToken = null;

// Função para capturar o token dinamicamente
async function captureAuthorizationToken() {
  try {
    const loginUrl = 'https://api.caveiratips.com/api/v1/auth/login';
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        username: 'assuncao.rw', // Substitua pelo seu e-mail ou usuário real
        password: '131609@sH',   // Substitua pela sua senha real
      }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao capturar token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    accessToken = data.access_token;
    refreshToken = data.refresh_token || null; // Opcional, dependendo da resposta da API
    console.log('Novo token capturado:', accessToken);
    return { accessToken, refreshToken };
  } catch (error) {
    console.error('Erro ao capturar token:', error);
    throw error;
  }
}

// Middleware para garantir que o token esteja atualizado antes de cada requisição
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

// Rota para proxy de jogos ao vivo
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

// Rota para proxy de jogos finalizados
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

// Rota para proxy de análises H2H
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
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'Sec-Fetch-Dest': 'empty',
        'Priority': 'u=1, i',
      },
    });

    console.log(`Status da resposta da API H2H: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Detalhes do erro da API H2H: ${errorText}`);
      throw new Error(`Falha na requisição: ${response.status} ${response.statusText}. Detalhes: ${errorText}`);
    }

    const data = await response.json();
    console.log('Dados H2H recebidos:', data);
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar dados H2H:', error);
    res.status(500).json({ error: 'Erro ao buscar dados da API H2H' });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});