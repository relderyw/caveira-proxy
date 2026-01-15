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
// TOKEN PARA DEV3 (api.dev3.caveira.tips) - oat_... token
// ===============================================
let dev3Token = null;
let dev3TokenExpiry = 0;
const DEV3_LOGIN_URL = 'https://api.dev3.caveira.tips/v1/auth/login';
const DEV3_TOKEN_VALIDITY_MS = 18 * 60 * 1000; // 18 minutos

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
        login: process.env.DEV3_EMAIL || "reldery1422@gmail.com",
        password: process.env.DEV3_PASSWORD || "131609@sH",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Login dev3 falhou: ${response.status} - ${text.substring(0, 300)}`);
    }

    const data = await response.json();

    // Busca recursiva por token
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
      console.error('[Dev3] Resposta completa:', data);
      throw new Error('Token dev3 não encontrado');
    }

    dev3Token = rawToken.startsWith('Bearer ') ? rawToken : `Bearer ${rawToken}`;
    dev3TokenExpiry = Date.now() + DEV3_TOKEN_VALIDITY_MS;

    console.log('✅ Token dev3 (oat_...) capturado com sucesso!');
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

async function ensureDev3Token(req, res, next) {
  try {
    req.dev3Token = await getValidDev3Token();
    next();
  } catch (error) {
    res.status(500).json({ error: 'Falha na autenticação dev3' });
  }
}

// ===============================================
// TOKEN PARA APP3 ANTIGA (app3.caveiratips.com.br) - hex longo
// ===============================================
let app3OldToken = null;
let app3OldTokenExpiry = 0;
const APP3_OLD_LOGIN_URL = 'https://app3.caveiratips.com.br/app3//api/auth/login/';
const APP3_OLD_TOKEN_VALIDITY_MS = 23 * 60 * 60 * 1000; // 23 horas

async function captureApp3OldToken() {
  try {
    console.log('[App3 Antiga] Capturando token hex longo via login...');

    const response = await fetch(APP3_OLD_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://app3.caveiratips.com.br',
        'Referer': 'https://app3.caveiratips.com.br/app3/login',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/125.0.0.0'
      },
      body: JSON.stringify({
        login: process.env.APP3_OLD_USERNAME || "warp",
        password: process.env.APP3_OLD_PASSWORD || "warp2025",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Login app3 antiga falhou: ${response.status} - ${text}`);
    }

    const data = await response.json();
    const token = data.token;

    if (!token || token.length < 50) {
      console.error('[App3 Antiga] Resposta completa:', data);
      throw new Error('Token hex não encontrado');
    }

    app3OldToken = `Bearer ${token}`;
    app3OldTokenExpiry = Date.now() + APP3_OLD_TOKEN_VALIDITY_MS;

    console.log('✅ Token app3 antiga (hex longo) capturado com sucesso!');
    return app3OldToken;

  } catch (error) {
    console.error('❌ Erro ao capturar token app3 antiga:', error.message);
    app3OldToken = null;
    app3OldTokenExpiry = 0;
    throw error;
  }
}

async function getValidApp3OldToken() {
  if (app3OldToken && Date.now() < app3OldTokenExpiry) {
    return app3OldToken;
  }
  return await captureApp3OldToken();
}

async function ensureApp3OldToken(req, res, next) {
  try {
    req.app3OldToken = await getValidApp3OldToken();
    next();
  } catch (error) {
    res.status(500).json({ error: 'Falha na autenticação com app3 antiga' });
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

// 8. Confronto H2H da app3 (usa token app3 antiga hex)
app.get('/api/app3/confronto', ensureApp3OldToken, async (req, res) => {
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
        'Authorization': req.app3OldToken,
        'Origin': 'https://app3.caveiratips.com.br',
        'Referer': 'https://app3.caveiratips.com.br/app3/confronto',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/125.0.0.0'
      },
    });

    if (response.status === 401) {
      console.log('[App3 Antiga] Token expirado (401). Renovando na próxima...');
      app3OldToken = null;
      app3OldTokenExpiry = 0;
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

// 9. Histórico de jogos (POST - Search) para dev3
app.post('/api/app3/history', ensureDev3Token, async (req, res) => {
  try {
    const { query, filters } = req.body;
    if (!query || !filters) {
      return res.status(400).json({ error: 'query e filters são obrigatórios' });
    }

    const response = await fetch('https://esoccer.dev3.caveira.tips/v1/esoccer/search', {
      method: 'POST',
      headers: {
        'Authorization': req.dev3Token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://app2.caveira.tips',
        'Referer': 'https://app2.caveira.tips/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ query, filters })
    });

    if (response.status === 401) {
      console.log('[Dev3] Token expirado (401). Renovando na próxima...');
      dev3Token = null;
      dev3TokenExpiry = 0;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Histórico search falhou: ${response.status} - ${text.substring(0, 300)}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro /api/app3/history:', error.message);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});
// 10. Busca/autocomplete de jogadores na app3 antiga (endpoint /api/players/)
app.get('/api/app3/players', ensureApp3OldToken, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Parâmetro "query" é obrigatório' });
    }

    const url = `https://app3.caveiratips.com.br/app3//api/players/?query=${encodeURIComponent(query)}&t=${Date.now()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': req.app3OldToken,  // Token hex longo (Bearer ...)
        'Origin': 'https://app3.caveiratips.com.br',
        'Referer': 'https://app3.caveiratips.com.br/app3/confronto',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/125.0.0.0',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
    });

    // Se der 401, invalida o token para forçar renovação na próxima chamada
    if (response.status === 401) {
      console.log('[App3 Antiga] Token expirado na rota players (401). Renovando na próxima requisição...');
      app3OldToken = null;
      app3OldTokenExpiry = 0;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Busca de jogadores falhou: ${response.status} - ${text.substring(0, 300)}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro na rota /api/app3/players:', error.message);
    res.status(500).json({ error: 'Erro ao buscar jogadores (app3)' });
  }
});

// 11. Jogos inplay / ao vivo da dev3 (usa o mesmo token oat_... do dev3)
app.get('/api/app3/inplay', ensureDev3Token, async (req, res) => {
  try {
    const url = 'https://esoccer.dev3.caveira.tips/v1/esoccer/inplay';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': req.dev3Token,                 // Token oat_... Bearer
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://app2.caveira.tips',
        'Referer': 'https://app2.caveira.tips/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/125.0.0.0',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      body: JSON.stringify({})  // Body vazio, como na requisição original
    });

    // Tratamento de token expirado (401) - mesma lógica que você já usa
    if (response.status === 401) {
      console.log('[Dev3] Token expirado na rota inplay (401). Renovando na próxima requisição...');
      dev3Token = null;
      dev3TokenExpiry = 0;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Inplay dev3 falhou: ${response.status} - ${text.substring(0, 300)}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro na rota /api/app3/inplay:', error.message);
    res.status(500).json({ error: 'Erro ao buscar jogos inplay (dev3)' });
  }
});

// ===============================================
// SOKKERPRO (Rotas novas)
// ===============================================

// 12. SokkerPro Livescores
app.get('/api/sokkerpro/livescores', async (req, res) => {
  try {
    const url = 'https://m2.sokkerpro.com/livescores';
    const response = await fetch(url, {
      headers: {
        'authority': 'm2.sokkerpro.com',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'origin': 'https://sokkerpro.com',
        'referer': 'https://sokkerpro.com/',
        'sec-ch-ua': '"Opera Air";v="125", "Not?A_Brand";v="8", "Chromium";v="141"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/125.0.0.0',
        'priority': 'u=1, i'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      // Only show a short snippet of the error to avoid flooding logs with HTML
      throw new Error(`SokkerPro Livescores falhou: ${response.status} - ${text.substring(0, 50)}...`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro /api/sokkerpro/livescores:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 13. SokkerPro Fixture Details
app.get('/api/sokkerpro/fixture/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const url = `https://m2.sokkerpro.com/fixture/${id}`;
    
    const response = await fetch(url, {
      headers: {
        'authority': 'm2.sokkerpro.com',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'origin': 'https://sokkerpro.com',
        'referer': 'https://sokkerpro.com/',
        'sec-ch-ua': '"Opera Air";v="125", "Not?A_Brand";v="8", "Chromium";v="141"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/125.0.0.0',
        'priority': 'u=1, i'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SokkerPro Fixture ${id} falhou: ${response.status} - ${text.substring(0, 50)}...`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(`Erro /api/sokkerpro/fixture/${req.params.id}:`, error.message);
    res.status(500).json({ error: error.message });
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