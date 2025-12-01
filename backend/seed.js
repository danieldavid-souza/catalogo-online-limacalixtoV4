const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Conecta ao banco de dados (o mesmo do server.js)
const db = new sqlite3.Database('./catalog.db', (err) => {
    if (err) {
        console.error("Erro ao conectar ao banco de dados para o seeding.", err.message);
    } else {
        console.log("Conectado ao banco de dados para o seeding.");
    }
});

// Lê o arquivo JSON
fs.readFile('./data.json', 'utf8', (err, data) => {
    if (err) {
        console.error("Erro ao ler o arquivo data.json:", err);
        return;
    }

    const products = JSON.parse(data);

    // Prepara a query de inserção
    const insertSql = `INSERT INTO products (name, description, price, category, google_drive_link, image_url, on_sale) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.serialize(() => {
        // 1. Garante que a tabela 'products' exista com a estrutura correta
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
                return console.error("Erro ao criar a tabela 'products'", err.message);
            }
            console.log("Tabela 'products' garantida.");

            // 2. Limpa a tabela antes de inserir para evitar duplicatas
            db.run("DELETE FROM products", (err) => {
                if (err) {
                    return console.error("Erro ao limpar a tabela products:", err.message);
                }
                console.log("Tabela 'products' limpa com sucesso.");

                // 3. Itera sobre cada produto e insere no banco
                products.forEach(product => {
                    const params = [
                        product.nome,
                        product.descricao,
                        product.preco,
                        product.categoria,
                        product.linkMockups,
                        product.imagem,
                        product.emPromocao ? 1 : 0 // Converte o booleano para 1 ou 0
                    ];

                    db.run(insertSql, params, function(err) {
                        if (err) {
                            return console.error(`Erro ao inserir produto ${product.nome}:`, err.message);
                        }
                        console.log(`Produto "${product.nome}" inserido com sucesso.`);
                    });
                });

                // 4. Fecha a conexão com o banco de dados
                db.close((err) => {
                    if (err) {
                        return console.error(err.message);
                    }
                    console.log("Conexão com o banco de dados fechada. Seeding concluído!");
                });
            });
        });
    });
});