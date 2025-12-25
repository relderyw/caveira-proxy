const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

let accessToken = null;
let refreshToken = null;

// Função para capturar o token de autenticação
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
    console.log('Novo token capturado com sucesso!');
    return { accessToken, refreshToken };
  } catch (error) {
    console.error('Erro ao capturar token:', error.message);
    throw error;
  }
}

// Middleware para garantir token válido
async function ensureValidToken(req, res, next) {
  try {
    if (!accessToken) {
      console.log('Token não encontrado. Capturando novo token...');
      await captureAuthorizationToken();
    }
    req.accessToken = accessToken;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Falha ao obter o token de autorização' });
  }
}

// 1. Jogos ao vivo
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

    if (!response.ok) throw new Error(`Erro: ${response.status}`);

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar jogos ao vivo:', error);
    res.status(500).json({ error: 'Erro ao buscar jogos ao vivo' });
  }
});

// 2. Histórico de partidas (paginado)
app.get('/api/historico/partidas', ensureValidToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) return res.status(400).json({ error: 'Parâmetro "page" inválido' });
    if (isNaN(limitNum) || limitNum < 1) return res.status(400).json({ error: 'Parâmetro "limit" inválido' });

    const url = `https://api.caveiratips.com/api/v1/historico/partidas?page=${pageNum}&limit=${limitNum}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.accessToken}`,
      },
    });

    if (!response.ok) throw new Error(`Erro: ${response.status}`);

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar histórico de partidas:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico de partidas' });
  }
});

// 3. Histórico assíncrono por jogador
app.get('/api/v1/historico/partidas-assincrono', ensureValidToken, async (req, res) => {
  try {
    const { jogador, limit = 10, page = 1 } = req.query;
    if (!jogador) return res.status(400).json({ error: 'Parâmetro "jogador" é obrigatório' });

    const url = `https://api.caveiratips.com/api/v1/historico/partidas-assincrono?jogador=${encodeURIComponent(jogador)}&limit=${limit}&page=${page}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.accessToken}`,
        'Origin': 'https://caveiratips.com',
        'Referer': 'https://caveiratips.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro no histórico assíncrono:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico do jogador' });
  }
});

// 4. Confronto direto (H2H)
app.get('/api/v1/historico/confronto/:player1/:player2', ensureValidToken, async (req, res) => {
  try {
    const { player1, player2 } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!player1 || !player2) return res.status(400).json({ error: 'Dois jogadores são obrigatórios' });

    const url = `https://api.caveiratips.com/api/v1/historico/confronto/${encodeURIComponent(player1)}/${encodeURIComponent(player2)}?page=${page}&limit=${limit}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.accessToken}`,
        'Origin': 'https://caveiratips.com',
        'Referer': 'https://caveiratips.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`H2H Error: ${errorText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro no confronto H2H:', error);
    res.status(500).json({ error: 'Erro ao buscar confronto entre jogadores' });
  }
});

// 5. NOVA ROTA: Autocomplete de jogadores
app.get('/api/historico/jogadores/autocomplete', ensureValidToken, async (req, res) => {
  try {
    const { term, limit = 10 } = req.query;

    if (!term || term.trim() === '') {
      return res.status(400).json({ error: 'Parâmetro "term" é obrigatório' });
    }

    const url = `https://api.caveiratips.com/api/v1/historico/jogadores/autocomplete?term=${encodeURIComponent(term)}&limit=${limit}`;
    console.log('Buscando jogadores:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.accessToken}`,
        'Origin': 'https://caveiratips.com',
        'Referer': 'https://caveiratips.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro no autocomplete:', errorText);
      throw new Error(`Autocomplete falhou: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro na rota de autocomplete:', error.message);
    res.status(500).json({ error: 'Erro ao buscar sugestões de jogadores' });
  }
});

// 6. Partidas scraped (sem token)
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

    if (!response.ok) throw new Error(`Erro scraped: ${response.status}`);

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar partidas scraped:', error);
    res.status(500).json({ error: 'Erro ao carregar partidas ao vivo (scraped)' });
  }
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Proxy Caveira Tips rodando na porta ${port}`);
  console.log(`http://localhost:${port}`);
});

// 7. NOVA ROTA: Live events da app3 (pública - sem token)
app.get('/api/app3/live-events', async (req, res) => {
  try {
    const timestamp = Date.now();
    const url = `https://app3.caveiratips.com.br/api/live-events/?nocache=${timestamp}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Live events falhou: ${response.status} - ${text.substring(0, 200)}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar live-events da app3:', error.message);
    res.status(500).json({ error: 'Falha ao carregar eventos ao vivo (app3)' });
  }
});

// 8. NOVA ROTA: Confronto H2H da app3 (com token renovado automaticamente)
app.get('/api/app3/confronto', ensureValidToken, async (req, res) => {
  try {
    const { player1, player2, interval = 30 } = req.query;

    if (!player1 || !player2) {
      return res.status(400).json({ error: 'player1 e player2 são obrigatórios' });
    }

    const url = `https://app3.caveiratips.com.br/app3//api/confronto/?player1=${encodeURIComponent(player1)}&player2=${encodeURIComponent(player2)}&interval=${interval}&t=${Date.now()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${req.accessToken}`,
        'Origin': 'https://app3.caveiratips.com.br',
        'Referer': 'https://app3.caveiratips.com.br/app3/confronto',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`H2H app3 falhou: ${response.status} - ${text.substring(0, 200)}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro no confronto app3:', error.message);
    res.status(500).json({ error: 'Erro ao buscar confronto (app3)' });
  }
});