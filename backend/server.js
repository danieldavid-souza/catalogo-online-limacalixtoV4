// backend/server.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose(); // .verbose() para mensagens de erro mais detalhadas. [7, 14]
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors()); // Permite que o frontend acesse a API
app.use(express.json()); // Permite que o Express entenda requisições com corpo em JSON

// Conecta ao banco de dados SQLite (cria o arquivo se ele não existir)
const db = new sqlite3.Database('./catalog.db', (err) => {
    if (err) {
        console.error("Erro ao abrir o banco de dados", err.message);
    } else {
        console.log("Conectado ao banco de dados SQLite.");
        // Cria a tabela de produtos se ela não existir
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price REAL,
            category TEXT,
            google_drive_link TEXT,
            image_url TEXT,
            on_sale INTEGER DEFAULT 0
        )`, (err) => {
            if (err) {
                console.error("Erro ao criar a tabela 'products'", err.message);
            } else {
                console.log("Tabela 'products' garantida.");
            }
        });

        // Cria a tabela de campanhas se ela não existir
        db.run(`CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            image_url TEXT
        )`, (err) => {
            if (err) {
                console.error("Erro ao criar a tabela 'campaigns'", err.message);
            } else {
                console.log("Tabela 'campaigns' garantida.");
            }
        });
    }
});

// Rota de teste
app.get('/', (req, res) => {
    res.json({ message: "Bem-vindo à API do Catálogo Online!" });
});

// backend/server.js (adicionar este trecho)

// --- ROTAS DO CRUD DE PRODUTOS ---

// ROTA 1: Listar todos os produtos (Read)
app.get('/api/products', (req, res) => {
    const { search, category, on_sale } = req.query;
    let sql = "SELECT * FROM products";
    const params = [];
    const conditions = [];

    if (search) {
        conditions.push("name LIKE ?");
        params.push(`%${search}%`);
    }

    if (category) {
        conditions.push("category = ?");
        params.push(category);
    }

    if (on_sale === '1') {
        conditions.push("on_sale = ?");
        params.push(1);
    }

    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY name";
    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// ROTA 2: Obter um único produto pelo ID (Read)
app.get('/api/products/:id', (req, res) => {
    const sql = "SELECT * FROM products WHERE id = ?";
    db.get(sql, [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        if (row) {
            res.json({
                "message": "success",
                "data": row
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

    const sql = `INSERT INTO products (name, description, price, category, google_drive_link, image_url, on_sale) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [name, description, price, category, google_drive_link, image_url, on_sale ? 1 : 0];

    db.run(sql, params, function(err) {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        res.status(201).json({
            "message": "Produto cadastrado com sucesso!",
            "data": { id: this.lastID, ...req.body }
        });
    });
});

// ROTA 4: Editar um produto existente (Update)
app.put('/api/products/:id', (req, res) => {
    const { name, description, price, category, google_drive_link, image_url, on_sale } = req.body;
    const sql = `UPDATE products SET 
                    name = COALESCE(?, name), 
                    description = COALESCE(?, description), 
                    price = COALESCE(?, price), 
                    category = COALESCE(?, category), 
                    google_drive_link = COALESCE(?, google_drive_link),
                    image_url = COALESCE(?, image_url),
                    on_sale = COALESCE(?, on_sale)
                 WHERE id = ?`;
    
    const params = [name, description, price, category, google_drive_link, image_url, on_sale, req.params.id];

    db.run(sql, params, function(err) {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ "message": "Produto não encontrado." });
        } else {
            res.json({
                "message": `Produto com ID ${req.params.id} atualizado com sucesso.`,
                "changes": this.changes
            });
        }
    });
});

// ROTA 5: Excluir um produto (Delete)
app.delete('/api/products/:id', (req, res) => {
    const sql = 'DELETE FROM products WHERE id = ?';
    db.run(sql, req.params.id, function(err) {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ "message": "Produto não encontrado." });
        } else {
            res.json({ "message": `Produto com ID ${req.params.id} deletado com sucesso.`, "changes": this.changes });
        }
    });
});

// --- ROTAS DO CRUD DE CAMPANHAS ---

// ROTA 1: Listar todas as campanhas (Read)
app.get('/api/campaigns', (req, res) => {
    const sql = "SELECT * FROM campaigns ORDER BY title";
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// ROTA 2: Obter uma única campanha pelo ID (Read)
app.get('/api/campaigns/:id', (req, res) => {
    const sql = "SELECT * FROM campaigns WHERE id = ?";
    db.get(sql, [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        if (row) {
            res.json({
                "message": "success",
                "data": row
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

    const sql = `INSERT INTO campaigns (title, description, image_url) VALUES (?, ?, ?)`;
    const params = [title, description, image_url];

    db.run(sql, params, function(err) {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        res.status(201).json({
            "message": "Campanha cadastrada com sucesso!",
            "data": { id: this.lastID, ...req.body }
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
                 WHERE id = ?`;
    
    const params = [title, description, image_url, req.params.id];

    db.run(sql, params, function(err) {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        res.json({
            "message": `Campanha com ID ${req.params.id} atualizada com sucesso.`,
            "changes": this.changes
        });
    });
});

// ROTA 5: Excluir uma campanha (Delete)
app.delete('/api/campaigns/:id', (req, res) => {
    const sql = 'DELETE FROM campaigns WHERE id = ?';
    db.run(sql, req.params.id, function(err) {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        res.json({ "message": `Campanha com ID ${req.params.id} deletada com sucesso.`, "changes": this.changes });
    });
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta http://localhost:${PORT}`);
});
