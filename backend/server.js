// backend/server.js

// Em produção (Render), as variáveis são injetadas diretamente.
// Para desenvolvimento local, inicie com: node -r dotenv/config server.js
const express = require('express');

// --- VERIFICAÇÃO DE VARIÁVEIS DE AMBIENTE ---
const requiredEnvVars = ['PINECONE_API_KEY', 'HUGGINGFACE_TOKEN'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`ERRO: As seguintes variáveis de ambiente são obrigatórias: ${missingVars.join(', ')}`);
  process.exit(1); // Encerra o processo com um código de erro
}

const Database = require('better-sqlite3'); // Substitui o sqlite3
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
    const { search } = req.query;
    let sql;
    const params = [];

    if (search) {
        // A busca agora usa a tabela FTS, que é muito mais poderosa
        // O 'ORDER BY rank' coloca os resultados mais relevantes primeiro
        sql = `SELECT p.* FROM products p JOIN products_fts fts ON p.id = fts.rowid WHERE fts.products_fts MATCH ? ORDER BY rank`;
        // Adicionamos '*' para permitir buscas parciais (prefixo)
        params.push(search + '*');
    } else {
        sql = "SELECT * FROM products ORDER BY name";
    }

    try {
        const stmt = db.prepare(sql);
        const rows = stmt.all(params);
        res.json({
            "message": "success",
            "data": rows
        });
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});

// ROTA DE BUSCA POR IA (DEVE VIR ANTES DA ROTA /:id)
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
        const placeholders = productIds.map(() => '?').join(',');
        const sql = `SELECT * FROM products WHERE id IN (${placeholders}) ORDER BY name`;

        const stmt = db.prepare(sql);
        const rows = stmt.all(productIds);
        res.json({ "message": "success", "data": rows });
    } catch (error) {
        res.status(500).json({ "error": "Erro durante a busca por IA: " + error.message });
    }
});

// --- ROTA PARA PRODUTOS DE UMA CAMPANHA (DEVE VIR ANTES DA ROTA /:id) ---
app.get('/api/campaigns/:id/products', (req, res) => {
    const campaignId = req.params.id;
    const sql = "SELECT * FROM products WHERE campaign_id = ? ORDER BY name";

    try {
        const stmt = db.prepare(sql);
        const rows = stmt.all(campaignId);
        res.json({
            "message": "success",
            "data": rows
        });
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});


// ROTA 2: Obter um único produto pelo ID (Read)
app.get('/api/products/:id', (req, res) => {
    const sql = "SELECT * FROM products WHERE id = ?";
    try {
        const stmt = db.prepare(sql);
        const row = stmt.get(req.params.id);
        if (row) {
            res.json({
                "message": "success",
                "data": row
            });
        } else {
            res.status(404).json({ "message": "Produto não encontrado." });
        }
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});

// ROTA 3: Cadastrar um novo produto (Create)
app.post('/api/products', (req, res) => {
    const { name, description, price, category, google_drive_link, image_url, on_sale } = req.body;
    if (!name) {
        res.status(400).json({ "error": "O nome do produto é obrigatório." });
        return;
    }

    const sql = `INSERT INTO products (name, description, price, category, google_drive_link, image_url, on_sale) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [name, description, price, category, google_drive_link, image_url, on_sale ? 1 : 0];

    try {
        const stmt = db.prepare(sql);
        const info = stmt.run(params);
        const newProductId = info.lastInsertRowid;

        res.status(201).json({
            "message": "Produto cadastrado com sucesso!",
            "data": { id: newProductId, ...req.body }
        });

        // Sincroniza a tabela FTS com os novos dados
        const ftsSql = `INSERT INTO products_fts(rowid, name, description, category) VALUES(?, ?, ?, ?)`;
        db.prepare(ftsSql).run(newProductId, name, description, category);
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
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
                    on_sale = COALESCE(?, on_sale),
                    campaign_id = ?
                 WHERE id = ?`;
    
    const params = [name, description, price, category, google_drive_link, image_url, on_sale, campaign_id, req.params.id];

    try {
        const stmt = db.prepare(sql);
        const info = stmt.run(params);

        if (info.changes === 0) {
            res.status(404).json({ "message": "Produto não encontrado." });
        } else {
            res.json({
                "message": `Produto com ID ${req.params.id} atualizado com sucesso.`,
                "changes": info.changes
            });

            // Sincroniza a tabela FTS de forma mais eficiente e segura com REPLACE.
            // REPLACE funciona como um "upsert": atualiza a linha se o rowid já existir, ou insere uma nova se não existir.
            const ftsSql = `REPLACE INTO products_fts(rowid, name, description, category) VALUES(?, ?, ?, ?)`;
            db.prepare(ftsSql).run(req.params.id, name, description, category);
        }
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});

// ROTA 5: Excluir um produto (Delete)
app.delete('/api/products/:id', (req, res) => {
    const sql = 'DELETE FROM products WHERE id = ?';
    try {
        const stmt = db.prepare(sql);
        const info = stmt.run(req.params.id);

        if (info.changes === 0) {
            res.status(404).json({ "message": "Produto não encontrado." });
        } else {
            res.json({ "message": `Produto com ID ${req.params.id} deletado com sucesso.`, "changes": info.changes });
            
            // Sincroniza a tabela FTS removendo o produto
            db.prepare(`DELETE FROM products_fts WHERE rowid = ?`).run(req.params.id);
        }
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});

// --- ROTAS DO CRUD DE CAMPANHAS ---

// ROTA 1: Listar todas as campanhas (Read)
app.get('/api/campaigns', (req, res) => {
    const sql = "SELECT * FROM campaigns ORDER BY title";
    try {
        const stmt = db.prepare(sql);
        const rows = stmt.all();
        res.json({
            "message": "success",
            "data": rows
        });
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});

// --- ROTA PARA PRODUTOS DE UMA CAMPANHA (DEVE VIR ANTES DA ROTA /:id) ---
app.get('/api/campaigns/:id/products', (req, res) => {
    const campaignId = req.params.id;
    const sql = "SELECT * FROM products WHERE campaign_id = ? ORDER BY name";

    try {
        const stmt = db.prepare(sql);
        const rows = stmt.all(campaignId);
        res.json({
            "message": "success",
            "data": rows
        });
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});


// ROTA 2: Obter uma única campanha pelo ID (Read)
app.get('/api/campaigns/:id', (req, res) => {
    const sql = "SELECT * FROM campaigns WHERE id = ?";
    try {
        const stmt = db.prepare(sql);
        const row = stmt.get(req.params.id);
        if (row) {
            res.json({
                "message": "success",
                "data": row
            });
        } else {
            res.status(404).json({ "message": "Campanha não encontrada." });
        }
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});
// ROTA 3: Cadastrar uma nova campanha (Create)
app.post('/api/campaigns', (req, res) => {
    const { title, description, image_url } = req.body;
    if (!title) {
        res.status(400).json({ "error": "O título da campanha é obrigatório." });
        return;
    }

    const sql = `INSERT INTO campaigns (title, description, image_url) VALUES (?, ?, ?)`;
    const params = [title, description, image_url];

    try {
        const stmt = db.prepare(sql);
        const info = stmt.run(params);
        res.status(201).json({
            "message": "Campanha cadastrada com sucesso!",
            "data": { id: info.lastInsertRowid, ...req.body }
        });
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});

// ROTA 4: Editar uma campanha existente (Update)
app.put('/api/campaigns/:id', (req, res) => {
    const { title, description, image_url } = req.body;
    const sql = `UPDATE campaigns SET 
                    title = COALESCE(?, title), 
                    description = COALESCE(?, description), 
                    image_url = COALESCE(?, image_url)
                 WHERE id = ?`;
    
    const params = [title, description, image_url, req.params.id];

    try {
        const stmt = db.prepare(sql);
        const info = stmt.run(params);
        res.json({
            "message": `Campanha com ID ${req.params.id} atualizada com sucesso.`,
            "changes": info.changes
        });
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});

// ROTA 5: Excluir uma campanha (Delete)
app.delete('/api/campaigns/:id', (req, res) => {
    const sql = 'DELETE FROM campaigns WHERE id = ?';
    try {
        const stmt = db.prepare(sql);
        const info = stmt.run(req.params.id);
        res.json({ "message": `Campanha com ID ${req.params.id} deletada com sucesso.`, "changes": info.changes });
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta http://localhost:${PORT}`);
});
