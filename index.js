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
let accessToken = null;

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
// TOKEN PARA DEV3 / APP3 (api.dev3.caveira.tips) - AUTOMÁTICO
// ===============================================
let dev3Token = null;
let dev3TokenExpiry = 0;
const DEV3_LOGIN_URL = 'https://api.dev3.caveira.tips/v1/auth/login';
const DEV3_TOKEN_VALIDITY_MS = 18 * 60 * 1000; // 18 minutos (margem segura, token dura ~20-30min)

async function captureDev3Token() {
  try {
    console.log('[Dev3] Capturando novo token via login automático...');

    const response = await fetch(DEV3_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://app2.caveira.tips',
        'Referer': 'https://app2.caveira.tips/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/125.0.0.0'
      },
      body: JSON.stringify({
        login: process.env.APP3_EMAIL || "reldery1422@gmail.com",
        password: process.env.APP3_PASSWORD || "131609@sH",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Login dev3 falhou: ${response.status} - ${text.substring(0, 300)}`);
    }

    const data = await response.json();

    // Busca o token em qualquer lugar da resposta (muito comum mudar de lugar)
    const findToken = (obj) => {
      if (typeof obj === 'string' && obj.length > 50 && (obj.includes('.') || obj.startsWith('oat_'))) return obj;
      if (obj && typeof obj === 'object') {
        for (const key in obj) {
          if (key.toLowerCase().includes('token') && typeof obj[key] === 'string') return obj[key];
          const found = findToken(obj[key]);
          if (found) return found;
        }
      }
      return null;
    };

    const rawToken = findToken(data);
    if (!rawToken) {
      console.error('Resposta completa do login dev3:', data);
      throw new Error('Token dev3 não encontrado na resposta');
    }

    dev3Token = rawToken.startsWith('Bearer ') ? rawToken : `Bearer ${rawToken}`;
    dev3TokenExpiry = Date.now() + DEV3_TOKEN_VALIDITY_MS;

    console.log('✅ Token dev3 capturado com sucesso! Válido por ~18 minutos.');
    return dev3Token;

  } catch (error) {
    console.error('❌ Erro ao capturar token dev3:', error.message);
    dev3Token = null;
    dev3TokenExpiry = 0;
    throw error;
  }
}

async function getValidDev3Token() {
  if (dev3Token && Date.now() < dev3TokenExpiry) {
    return dev3Token;
  }
  return await captureDev3Token();
}

// Middleware para garantir token válido nas rotas dev3/app3
async function ensureDev3Token(req, res, next) {
  try {
    req.dev3Token = await getValidDev3Token();
    next();
  } catch (error) {
    res.status(500).json({ error: 'Falha na autenticação com dev3.caveira.tips (token indisponível)' });
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

// 8. Confronto H2H da app3 (usa token dev3 automático)
app.get('/api/app3/confronto', ensureDev3Token, async (req, res) => {
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
        'Authorization': req.dev3Token,
        'Origin': 'https://app3.caveiratips.com.br',
        'Referer': 'https://app3.caveiratips.com.br/app3/confronto',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/125.0.0.0'
      },
    });

    if (response.status === 401) {
      console.log('[Dev3] Token expirado (401). Será renovado na próxima chamada.');
      dev3Token = null;
      dev3TokenExpiry = 0;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`H2H app3 falhou: ${response.status} - ${text.substring(0, 300)}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro na rota /api/app3/confronto:', error.message);
    res.status(500).json({ error: 'Erro ao buscar confronto H2H (app3)' });
  }
});

// 9. Histórico completo (POST search) da dev3
app.post('/api/app3/history', ensureDev3Token, async (req, res) => {
  try {
    const { query, filters } = req.body;

    if (!query || !filters) {
      return res.status(400).json({ error: 'query e filters são obrigatórios no body' });
    }

    const response = await fetch('https://esoccer.dev3.caveira.tips/v1/esoccer/search', {
      method: 'POST',
      headers: {
        'Authorization': req.dev3Token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://app2.caveira.tips',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ query, filters })
    });

    if (response.status === 401) {
      console.log('[Dev3] Token expirado no histórico. Renovando na próxima...');
      dev3Token = null;
      dev3TokenExpiry = 0;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Busca histórica dev3 falhou: ${response.status} - ${text.substring(0, 300)}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro /api/app3/history:', error.message);
    res.status(500).json({ error: 'Erro ao buscar histórico completo (dev3)' });
  }
});

// ===============================================
// INICIAR SERVIDOR
// ===============================================

// Carrega tokens ao iniciar (não bloqueia o startup)
captureMainApiToken().catch(() => console.warn('Token principal será capturado na primeira requisição'));
captureDev3Token().catch(() => console.warn('Token dev3 será capturado na primeira requisição da app3'));

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Proxy Caveira Tips rodando na porta ${port}`);
  console.log(`🔗 Local: http://localhost:${port}`);
  console.log(`🌐 Deploy: https://rwtips-r943.onrender.com`);
});