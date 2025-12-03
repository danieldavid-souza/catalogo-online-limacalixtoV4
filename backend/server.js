// backend/server.js

// Em produção (Render), as variáveis são injetadas diretamente.
// Para desenvolvimento local, inicie com: node -r dotenv/config server.js
const express = require('express');

// --- VERIFICAÇÃO DE VARIÁVEIS DE AMBIENTE ---
const requiredEnvVars = ['PINECONE_API_KEY', 'HUGGINGFACE_TOKEN', 'DATABASE_URL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`ERRO: As seguintes variáveis de ambiente são obrigatórias: ${missingVars.join(', ')}`);
  console.error('DATABASE_URL deve ser a string de conexão do Supabase (PostgreSQL).');
  process.exit(1); // Encerra o processo com um código de erro
}

const { Pool } = require('pg'); // Cliente PostgreSQL
const cors = require('cors');

// --- INICIALIZAÇÃO DOS CLIENTES DE IA ---
const { Pinecone } = require('@pinecone-database/pinecone');
const { HfInference } = require('@huggingface/inference');

const pinecone = new Pinecone(); // A API Key é lida automaticamente de process.env.PINECONE_API_KEY
const hf = new HfInference(process.env.HUGGINGFACE_TOKEN);
const pineconeIndex = pinecone.index('catalog-products'); // Mesmo nome do índice do seed
const embeddingModel = 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2';

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors()); // Permite que o frontend acesse a API
app.use(express.json()); // Permite que o Express entenda requisições com corpo em JSON

// Conecta ao banco de dados SQLite com better-sqlite3
let db;
try {
    db = new Database('./catalog.db');
    db.pragma('journal_mode = WAL'); // Melhora a concorrência
    console.log("Conectado ao banco de dados SQLite com better-sqlite3.");

    // Cria a tabela de produtos se ela não existir (a tabela FTS depende dela)
    db.exec(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL,
        category TEXT,
        google_drive_link TEXT,
        image_url TEXT,
        on_sale INTEGER DEFAULT 0,
        campaign_id INTEGER,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
    )`);

    // Cria a tabela virtual FTS5 para busca inteligente
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(name, description, category, content='products', content_rowid='id')`);
    console.log("Tabelas 'products' e 'products_fts' garantidas.");
} catch (err) {
    console.error("Erro ao abrir ou configurar o banco de dados", err.message);
}

// Rota de teste
app.get('/', (req, res) => {
    res.json({ message: "Bem-vindo à API do Catálogo Online!" });
});

// backend/server.js (adicionar este trecho)

// --- ROTAS DO CRUD DE PRODUTOS ---

// ROTA 1: Listar todos os produtos (Read)
app.get('/api/products', (req, res) => {
    // A busca FTS do SQLite não funciona aqui. Simplificamos para uma busca com LIKE.
    // A busca por IA continua sendo a principal.
    const { search } = req.query;
    let sql = "SELECT * FROM products";
    const params = [];

    if (search) {
        sql += " WHERE name ILIKE $1 OR description ILIKE $1 ORDER BY name";
        params.push(`%${search}%`);
    } else {
        sql += " ORDER BY name";
    }

    pool.query(sql, params, (err, result) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        res.json({
            "message": "success",
            "data": result.rows
        });
    });
});

// ROTA DE BUSCA POR IA (DEVE VIR ANTES da rota genérica /:id)
app.get('/api/products/ai-search', async (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ "error": "O parâmetro 'query' é obrigatório." });
    }

    try {
        // 1. Gera o vetor (embedding) para a query de busca
        const queryEmbedding = await hf.featureExtraction({
            model: embeddingModel,
            inputs: query,
        });

        // 2. Busca os vetores mais similares no Pinecone
        const queryResponse = await pineconeIndex.query({
            vector: queryEmbedding,
            topK: 5, // Retorna os 5 produtos mais similares
            includeValues: false,
        });

        // 3. Extrai os IDs dos resultados
        const productIds = queryResponse.matches.map(match => parseInt(match.id, 10));

        if (productIds.length === 0) {
            return res.json({ "message": "Nenhum produto similar encontrado.", "data": [] });
        }

        // 4. Busca os detalhes completos dos produtos no SQLite usando os IDs
        const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
        const sql = `SELECT * FROM products WHERE id IN (${placeholders}) ORDER BY name`;

        const result = await pool.query(sql, productIds);
        const rows = result.rows;
        res.json({ "message": "success", "data": rows });
    } catch (error) {
        res.status(500).json({ "error": "Erro durante a busca por IA: " + error.message });
    }
});

// ROTA 2: Obter um único produto pelo ID (Read)
app.get('/api/products/:id', (req, res) => {
    const sql = "SELECT * FROM products WHERE id = $1";
    pool.query(sql, [req.params.id], (err, result) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        if (result.rows.length > 0) {
            res.json({
                "message": "success",
                "data": result.rows[0]
            });
        } else {
            res.status(404).json({ "message": "Produto não encontrado." });
        }
    });
});

// ROTA 3: Cadastrar um novo produto (Create)
app.post('/api/products', (req, res) => {
    const { name, description, price, category, google_drive_link, image_url, on_sale } = req.body;
    if (!name) {
        res.status(400).json({ "error": "O nome do produto é obrigatório." });
        return;
    }

    const sql = `INSERT INTO products (name, description, price, category, google_drive_link, image_url, on_sale, campaign_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`;
    const params = [name, description, price, category, google_drive_link, image_url, on_sale, campaign_id || null];

    pool.query(sql, params, (err, result) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        const newProductId = result.rows[0].id;
        res.status(201).json({
            "message": "Produto cadastrado com sucesso!",
            "data": { id: newProductId, ...req.body }
        });
        // A sincronização com FTS não é mais necessária
    });
});

// ROTA 4: Editar um produto existente (Update)
app.put('/api/products/:id', (req, res) => {
    const { name, description, price, category, google_drive_link, image_url, on_sale, campaign_id } = req.body;
    const sql = `UPDATE products SET 
                    name = COALESCE(?, name), 
                    description = COALESCE(?, description), 
                    price = COALESCE(?, price), 
                    category = COALESCE(?, category), 
                    google_drive_link = COALESCE(?, google_drive_link),
                    image_url = COALESCE(?, image_url),
                    on_sale = COALESCE(?, on_sale::int)::boolean,
                    campaign_id = ?
                 WHERE id = ?`;
    
    // A sintaxe do PostgreSQL é um pouco diferente. Usamos $1, $2, etc.
    const pgSql = `UPDATE products SET 
                    name = $1, description = $2, price = $3, category = $4, 
                    google_drive_link = $5, image_url = $6, on_sale = $7, campaign_id = $8
                 WHERE id = $9`;
    const params = [name, description, price, category, google_drive_link, image_url, on_sale, campaign_id, req.params.id];

    pool.query(pgSql, params, (err, result) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        if (result.rowCount === 0) {
            res.status(404).json({ "message": "Produto não encontrado." });
        } else {
            res.json({
                "message": `Produto com ID ${req.params.id} atualizado com sucesso.`,
                "changes": result.rowCount
            });
        }
    });
});

// ROTA 5: Excluir um produto (Delete)
app.delete('/api/products/:id', (req, res) => {
    const sql = 'DELETE FROM products WHERE id = $1';
    pool.query(sql, [req.params.id], (err, result) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        if (result.rowCount === 0) {
            res.status(404).json({ "message": "Produto não encontrado." });
        } else {
            res.json({ "message": `Produto com ID ${req.params.id} deletado com sucesso.`, "changes": result.rowCount });
        }
    });
});

// --- ROTAS DO CRUD DE CAMPANHAS ---

// ROTA 1: Listar todas as campanhas (Read)
app.get('/api/campaigns', (req, res) => {
    const sql = "SELECT * FROM campaigns ORDER BY title";
    pool.query(sql, (err, result) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        res.json({
            "message": "success",
            "data": result.rows
        });
    });
});

// --- ROTA PARA PRODUTOS DE UMA CAMPANHA (DEVE VIR ANTES DA ROTA /:id) ---
app.get('/api/campaigns/:id/products', (req, res) => {
    const campaignId = req.params.id;
    const sql = "SELECT * FROM products WHERE campaign_id = $1 ORDER BY name";

    pool.query(sql, [campaignId], (err, result) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        res.json({
            "message": "success",
            "data": result.rows
        });
    });
});

// ROTA 2: Obter uma única campanha pelo ID (Read)
app.get('/api/campaigns/:id', (req, res) => {
    const sql = "SELECT * FROM campaigns WHERE id = $1";
    pool.query(sql, [req.params.id], (err, result) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        if (result.rows.length > 0) {
            res.json({
                "message": "success",
                "data": result.rows[0]
            });
        } else {
            res.status(404).json({ "message": "Campanha não encontrada." });
        }
    });
});

// ROTA 3: Cadastrar uma nova campanha (Create)
app.post('/api/campaigns', (req, res) => {
    const { title, description, image_url } = req.body;
    if (!title) {
        res.status(400).json({ "error": "O título da campanha é obrigatório." });
        return;
    }

    const sql = `INSERT INTO campaigns (title, description, image_url) VALUES ($1, $2, $3) RETURNING id`;
    const params = [title, description, image_url];

    pool.query(sql, params, (err, result) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        res.status(201).json({
            "message": "Campanha cadastrada com sucesso!",
            "data": { id: result.rows[0].id, ...req.body }
        });
    });
});

// ROTA 4: Editar uma campanha existente (Update)
app.put('/api/campaigns/:id', (req, res) => {
    const { title, description, image_url } = req.body;
    const sql = `UPDATE campaigns SET 
                    title = COALESCE(?, title), 
                    description = COALESCE(?, description), 
                    image_url = COALESCE(?, image_url)
                 WHERE id = ?`; // Esta sintaxe não é ideal para pg
    
    const pgSql = `UPDATE campaigns SET title = $1, description = $2, image_url = $3 WHERE id = $4`;
    const params = [title, description, image_url, req.params.id];

    pool.query(pgSql, params, (err, result) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        res.json({
            "message": `Campanha com ID ${req.params.id} atualizada com sucesso.`,
            "changes": result.rowCount
        });
    });
});

// ROTA 5: Excluir uma campanha (Delete)
app.delete('/api/campaigns/:id', (req, res) => {
    const sql = 'DELETE FROM campaigns WHERE id = $1';
    pool.query(sql, [req.params.id], (err, result) => {
        if (err) { return res.status(500).json({ "error": err.message }); }
        res.json({ "message": `Campanha com ID ${req.params.id} deletada com sucesso.`, "changes": result.rowCount });
    });
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta http://localhost:${PORT}`);
});
