const Database = require('better-sqlite3');
const fs = require('fs');

// Conecta ao banco de dados (o mesmo do server.js)
let db;
try {
    db = new Database('./catalog.db');
    console.log("Conectado ao banco de dados para o seeding com better-sqlite3.");
} catch (err) {
    console.error("Erro ao conectar ao banco de dados para o seeding.", err.message);
}
// Lê o arquivo JSON
fs.readFile('./data.json', 'utf8', (err, data) => {
    if (err) {
        console.error("Erro ao ler o arquivo data.json:", err);
        return;
    }

    const products = JSON.parse(data);

    // Prepara a query de inserção
    const insertSql = `INSERT INTO products (name, description, price, category, google_drive_link, image_url, on_sale) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    try {
        // 1. Garante que a tabela 'products' exista
        // Garante que a tabela 'products' exista e inclua a coluna 'campaign_id'
        db.exec(`CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                price REAL,
                category TEXT,
                google_drive_link TEXT,
                image_url TEXT,
                on_sale INTEGER DEFAULT 0,
                campaign_id INTEGER DEFAULT NULL
            )`);
        console.log("Tabela 'products' garantida.");

        // 2. Limpa a tabela antes de inserir para evitar duplicatas
        db.exec("DELETE FROM products");
        console.log("Tabela 'products' limpa com sucesso.");

        // 3. Prepara a inserção e a executa em uma transação para performance
        const insert = db.prepare(insertSql);
        const insertMany = db.transaction((prods) => {
            for (const product of prods) {
                insert.run(
                    product.nome,
                    product.descricao,
                    product.preco,
                    product.categoria,
                    product.linkMockups,
                    product.imagem,
                    product.emPromocao ? 1 : 0
                );
            }
        });

        insertMany(products);
        console.log(`${products.length} produtos inseridos com sucesso.`);
    } catch (error) {
        console.error("Ocorreu um erro durante o seeding:", error.message);
    } finally {
        db.close();
        console.log("Conexão com o banco de dados fechada. Seeding concluído!");
    }
});