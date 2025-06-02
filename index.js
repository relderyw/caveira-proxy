const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Certifique-se de instalar: npm install node-fetch@2
const jwt = require('jsonwebtoken'); // Para decodificar o token e verificar expiração: npm install jsonwebtoken

const app = express();
const port = process.env.PORT || 10000;

// Habilitar CORS para todas as origens
app.use(cors());

// Configuração inicial (pode ser movida para um arquivo .env ou banco de dados)
let accessToken = 'SEU_ACCESS_TOKEN_INICIAL'; // Substitua pelo token inicial
let refreshToken = 'SEU_REFRESH_TOKEN'; // Substitua pelo refresh_token inicial
const authEndpoint = 'https://api.caveiratips.com/api/v1/auth/refresh'; // Endpoint de renovação (confirme na documentação da API)
const tokenExpirationBuffer = 300; // Buffer de 5 minutos antes da expiração para renovação

// Função para decodificar o token e verificar expiração
function isTokenExpired(token) {
  try {
    const decoded = jwt.decode(token);
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < (currentTime + tokenExpirationBuffer);
  } catch (error) {
    console.error('Erro ao decodificar token:', error);
    return true; // Assume como expirado se houver erro
  }
}

// Função para renovar o token
async function renewToken() {
  try {
    const response = await fetch(authEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao renovar token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    accessToken = data.access_token; // Atualiza o access_token
    console.log('Token renovado com sucesso');
    return accessToken;
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    throw error;
  }
}

// Middleware para verificar e renovar token antes das requisições
async function ensureValidToken(req, res, next) {
  if (isTokenExpired(accessToken)) {
    console.log('Token expirado ou próximo da expiração, renovando...');
    try {
      accessToken = await renewToken();
    } catch (error) {
      return res.status(500).json({ error: 'Falha ao renovar o token de autorização' });
    }
  }
  req.accessToken = accessToken; // Passa o token para a requisição
  next();
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

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});

// Persistência dos tokens (opcional, para reinícios)
process.on('SIGTERM', () => {
  console.log('Salvando tokens antes de encerrar...');
  // Salve accessToken e refreshToken em um arquivo ou banco de dados aqui
  process.exit(0);
});