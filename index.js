import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ===============================================
// TOKEN PARA API PRINCIPAL (caveiratips.com)
// ===============================================
let accessToken = null; // Token da API principal

async function captureMainApiToken() {
  try {
    const loginUrl = 'https://api.caveiratips.com/api/v1/auth/token/';
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://caveiratips.com',
        'Referer': 'https://caveiratips.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        username: process.env.API_USERNAME,
        password: process.env.API_PASSWORD,
      }),
    });

    if (!response.ok) throw new Error(`Login principal falhou: ${response.status}`);

    const data = await response.json();
    accessToken = data.access_token;
    console.log('✅ Token principal (caveiratips.com) capturado com sucesso');
    return accessToken;
  } catch (error) {
    console.error('❌ Erro ao capturar token principal:', error.message);
    throw error;
  }
}

async function ensureMainApiToken(req, res, next) {
  try {
    if (!accessToken) {
      await captureMainApiToken();
    }
    req.accessToken = accessToken;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Falha ao obter token principal' });
  }
}

// ===============================================
// TOKEN PARA APP3 (dev3.caveira.tips)
// ===============================================
let app3Token = null;
let app3TokenExpiry = 0;

async function getApp3Token() {
  if (app3Token && Date.now() < app3TokenExpiry) {
    return app3Token;
  }

  try {
    const response = await fetch('https://api.dev3.caveira.tips/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        login: process.env.APP3_EMAIL || "reldery1422@gmail.com",
        password: process.env.APP3_PASSWORD || "131609@sH",
      }),
    });

    if (!response.ok) {
      throw new Error(`Login app3 falhou: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();

    // Função para extrair token profundamente
    const findToken = (obj) => {
      if (!obj) return null;
      if (obj.data?.user?.access_token) return obj.data.user.access_token;
      if (obj.access_token) return obj.access_token;
      if (obj.token) return obj.token;
      for (const key in obj) {
        if (typeof obj[key] === 'string' && obj[key].length > 50 && /token/i.test(key)) {
          return obj[key];
        }
        if (typeof obj[key] === 'object') {
          const found = findToken(obj[key]);
          if (found) return found;
        }
      }
      return null;
    };

    const token = findToken(data);
    if (!token) throw new Error("Token app3 não encontrado na resposta");

    app3Token = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    app3TokenExpiry = Date.now() + 20 * 60 * 1000; // 20 minutos de margem
    console.log('✅ Novo token app3 capturado com sucesso');
    return app3Token;
  } catch (error) {
    console.error('❌ Erro ao obter token app3:', error.message);
    throw error;
  }
}

// ===============================================
// ROTAS
// ===============================================

// 1. Jogos ao vivo (API principal)
app.get('/api/matches/live', ensureMainApiToken, async (req, res) => {
  try {
    const response = await fetch('https://api.caveiratips.com/api/v1/matches/live', {
      headers: {
        'Authorization': `Bearer ${req.accessToken}`,
        'Accept': 'application/json',
      },
    });
    if (!response.ok) throw new Error(`Erro: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro /api/matches/live:', error.message);
    res.status(500).json({ error: 'Erro ao buscar jogos ao vivo' });
  }
});

// 2. Histórico de partidas
app.get('/api/historico/partidas', ensureMainApiToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const url = `https://api.caveiratips.com/api/v1/historico/partidas?page=${page}&limit=${limit}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${req.accessToken}` },
    });
    if (!response.ok) throw new Error(`Erro: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro no histórico' });
  }
});

// 3. Histórico assíncrono por jogador
app.get('/api/v1/historico/partidas-assincrono', ensureMainApiToken, async (req, res) => {
  try {
    const { jogador, limit = 10, page = 1 } = req.query;
    if (!jogador) return res.status(400).json({ error: 'jogador obrigatório' });
    const url = `https://api.caveiratips.com/api/v1/historico/partidas-assincrono?jogador=${encodeURIComponent(jogador)}&limit=${limit}&page=${page}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${req.accessToken}` },
    });
    if (!response.ok) throw new Error(`Erro: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro no histórico do jogador' });
  }
});

// 4. Confronto direto H2H (API principal)
app.get('/api/v1/historico/confronto/:player1/:player2', ensureMainApiToken, async (req, res) => {
  try {
    const { player1, player2 } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const url = `https://api.caveiratips.com/api/v1/historico/confronto/${encodeURIComponent(player1)}/${encodeURIComponent(player2)}?page=${page}&limit=${limit}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${req.accessToken}` },
    });
    if (!response.ok) throw new Error(`Erro H2H: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro no confronto H2H principal' });
  }
});

// 5. Autocomplete de jogadores
app.get('/api/historico/jogadores/autocomplete', ensureMainApiToken, async (req, res) => {
  try {
    const { term, limit = 10 } = req.query;
    if (!term) return res.status(400).json({ error: 'term obrigatório' });
    const url = `https://api.caveiratips.com/api/v1/historico/jogadores/autocomplete?term=${encodeURIComponent(term)}&limit=${limit}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${req.accessToken}` },
    });
    if (!response.ok) throw new Error(`Erro autocomplete: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro no autocomplete' });
  }
});

// 6. Partidas scraped (sem token)
app.get('/api/scraped-matches', async (req, res) => {
  try {
    const url = 'https://api-pre-live.caveiratips.com.br/api/v1/scraped-matches?league_ids=10047781%2C10083563%2C10082427%2C10048705';
    const response = await fetch(url, {
      headers: {
        'x-api-key': process.env.SCRAPED_MATCHES_API_KEY,
        'Accept': '*/*',
      },
    });
    if (!response.ok) throw new Error(`Erro scraped: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar partidas scraped' });
  }
});

// 7. Live events da app3 (PÚBLICO - sem token)
app.get('/api/app3/live-events', async (req, res) => {
  try {
    const url = `https://app3.caveiratips.com.br/api/live-events/?nocache=${Date.now()}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    });
    if (!response.ok) throw new Error(`Live app3 falhou: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro /api/app3/live-events:', error.message);
    res.status(500).json({ error: 'Falha ao carregar eventos ao vivo app3' });
  }
});

// 8. Confronto H2H da app3 (COM TOKEN DINÂMICO DA DEV3)
app.get('/api/app3/confronto', async (req, res) => {
  try {
    const { player1, player2, interval = 30 } = req.query;
    if (!player1 || !player2) {
      return res.status(400).json({ error: 'player1 e player2 são obrigatórios' });
    }

    const token = await getApp3Token(); // Token renovado automaticamente

    const url = `https://app3.caveiratips.com.br/app3/api/confronto/?player1=${encodeURIComponent(player1)}&player2=${encodeURIComponent(player2)}&interval=${interval}&t=${Date.now()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': token,
        'Origin': 'https://app3.caveiratips.com.br',
        'Referer': 'https://app3.caveiratips.com.br/app3//confronto',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401) {
        app3Token = null; // Invalida token para forçar novo login
      }
      throw new Error(`H2H app3 falhou: ${response.status} - ${text.substring(0, 200)}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro na rota /api/app3/confronto:', error.message);
    res.status(500).json({ error: 'Erro ao buscar confronto H2H (app3)' });
  }
});

// 9. Histórico de jogos (POST - Search) para App3
app.post('/api/app3/history', async (req, res) => {
  try {
    const { query, filters } = req.body;
    const token = await getApp3Token();

    const response = await fetch('https://esoccer.dev3.caveira.tips/v1/esoccer/search', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify({ query, filters })
    });

    if (!response.ok) {
        if (response.status === 401) app3Token = null;
        throw new Error(`History search falhou: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro /api/app3/history:', error.message);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

// ===============================================
// INICIAR SERVIDOR
// ===============================================
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Proxy Caveira Tips rodando na porta ${port}`);
  console.log(`🔗 http://localhost:${port}`);
  console.log(`🌐 Deploy: https://rwtips-r943.onrender.com`);
});