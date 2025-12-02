// backend/seed-pinecone.js

require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const { HfInference } = require('@huggingface/inference');
const Database = require('better-sqlite3'); // Substitui o sqlite3

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;
const PINECONE_INDEX_NAME = 'catalog-products'; // Defina um nome para seu índice no Pinecone

if (!PINECONE_API_KEY || !HUGGINGFACE_TOKEN) {
    throw new Error("As variáveis de ambiente PINECONE_API_KEY e HUGGINGFACE_TOKEN são obrigatórias.");
}

// 1. Inicializa os Clientes
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
const hf = new HfInference(HUGGINGFACE_TOKEN);
const db = new Database('./catalog.db'); // Conecta com better-sqlite3

// Modelo de embedding recomendado para português
const embeddingModel = 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2';

async function main() {
    try {
        console.log("Iniciando o processo de seeding para o Pinecone...");

        // 2. Conecta ao índice do Pinecone (cria se não existir)
        const indexesList = await pinecone.listIndexes();
        // Verifica se a lista de índices existe e se algum deles tem o nome que procuramos.
        const indexExists = indexesList.indexes && indexesList.indexes.some(index => index.name === PINECONE_INDEX_NAME);

        if (!indexExists) {
            console.log(`Índice '${PINECONE_INDEX_NAME}' não encontrado. Criando...`);
            await pinecone.createIndex({
                name: PINECONE_INDEX_NAME,
                dimension: 768, // Dimensão do modelo 'paraphrase-multilingual-mpnet-base-v2'
                metric: 'cosine',
                // Adiciona a especificação do ambiente, obrigatória nas novas versões do Pinecone.
                // Para o plano gratuito, a especificação "serverless" é a mais comum.
                spec: {
                    serverless: {
                        cloud: 'aws',
                        region: 'us-east-1'
                    }
                }
            });
            console.log("Índice criado com sucesso. Aguardando inicialização...");
            await new Promise(resolve => setTimeout(resolve, 60000)); // Espera 1 minuto para o índice ficar pronto
        }

        const pineconeIndex = pinecone.index(PINECONE_INDEX_NAME);
        console.log(`Conectado ao índice '${PINECONE_INDEX_NAME}'.`);

        // 3. Busca todos os produtos do banco de dados SQLite
        const stmt = db.prepare("SELECT id, name, description, category FROM products");
        const products = stmt.all();

        if (products.length === 0) {
            console.log("Nenhum produto encontrado no banco de dados SQLite. Encerrando.");
            return;
        }
        console.log(`${products.length} produtos encontrados. Gerando embeddings...`);

        // 4. Gera embeddings e prepara os dados para o Pinecone
        for (const product of products) {
            // Combina os textos para criar um embedding mais rico
            const textToEmbed = `Nome do produto: ${product.name}. Categoria: ${product.category}. Descrição: ${product.description}. Sobre o produto: ${product.name}.`;

            const response = await hf.featureExtraction({
                model: embeddingModel,
                inputs: textToEmbed,
            });

            const vector = Array.isArray(response) ? response : [response];

            // Monta o objeto para o Pinecone
            const upsertRequest = {
                id: product.id.toString(), // ID deve ser string
                values: vector,
                metadata: {
                    name: product.name,
                    category: product.category
                }
            };

            await pineconeIndex.upsert([upsertRequest]);
            console.log(`Vetor para o produto "${product.name}" (ID: ${product.id}) inserido no Pinecone.`);
        }

        console.log("\nSeeding para o Pinecone concluído com sucesso!");

    } catch (error) {
        console.error("\nOcorreu um erro durante o seeding do Pinecone:", error);
    } finally {
        db.close();
    }
}

main();