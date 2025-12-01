// Variáveis globais
// const apiBaseUrl = 'http://localhost:3000/api';  Para uso local
const apiBaseUrl = 'https://seu-backend-url.onrender.com/api'; // <-- VAMOS MUDAR ISSO
let allProducts = [];

// Elementos do DOM
const productGrid = document.getElementById('product-grid');
const categoryFiltersContainer = document.getElementById('categoryFilters');
const searchInput = document.getElementById('searchInput');
const sortOptions = document.getElementById('sortOptions');
const promoFilter = document.getElementById('promoFilter');
const campaignsBtn = document.getElementById('campaignsBtn');
const backToTopBtn = document.getElementById('backToTopBtn');

// Modais
const productModal = document.getElementById('productModal');
const campaignsModal = document.getElementById('campaignsModal');

/**
 * Busca todos os produtos da API e armazena localmente.
 */
async function fetchAllProducts() {
    try {
        const response = await fetch(`${apiBaseUrl}/products`);
        const { data } = await response.json();
        allProducts = data;
        renderProducts();
        populateCategoryFilters();
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        if (productGrid) productGrid.innerHTML = '<p>Não foi possível carregar os produtos.</p>';
    }
}

/**
 * Renderiza os produtos na tela com base nos filtros e ordenação.
 */
function renderProducts() {
    if (!productGrid) return;

    let filteredProducts = [...allProducts];

    // 1. Filtrar por busca
    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
        filteredProducts = filteredProducts.filter(p => p.name.toLowerCase().includes(searchTerm));
    }

    // 2. Filtrar por categoria
    const selectedCategory = document.querySelector('input[name="category"]:checked');
    if (selectedCategory && selectedCategory.value) {
        filteredProducts = filteredProducts.filter(p => p.category === selectedCategory.value);
    }

    // 3. Filtrar por promoção
    if (promoFilter.checked) {
        filteredProducts = filteredProducts.filter(p => p.on_sale === 1);
    }

    // 4. Ordenar
    const sortValue = sortOptions.value;
    switch (sortValue) {
        case 'price-asc':
            filteredProducts.sort((a, b) => a.price - b.price);
            break;
        case 'price-desc':
            filteredProducts.sort((a, b) => b.price - a.price);
            break;
        case 'name-asc':
            filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
            break;
    }

    // 5. Renderizar no DOM
    productGrid.innerHTML = '';
    if (filteredProducts.length === 0) {
        productGrid.innerHTML = '<p>Nenhum produto encontrado com os critérios selecionados.</p>';
        return;
    }

    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.id = product.id;
        card.innerHTML = `
            ${product.on_sale ? '<div class="sale-tag">OFERTA</div>' : ''}
            <img src="${product.image_url || 'https://via.placeholder.com/300x300'}" alt="${product.name}" class="product-card-img">
            <h3>${product.name}</h3>
            <p class="category">${product.category || 'Serviço'}</p>
            <p class="price">R$ ${product.price ? product.price.toFixed(2) : 'Consulte'}</p>
        `;
        productGrid.appendChild(card);
    });
}

/**
 * Popula os filtros de categoria com base nos produtos carregados.
 */
function populateCategoryFilters() {
    if (!categoryFiltersContainer) return;

    const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
    categoryFiltersContainer.innerHTML = `
        <label>
            <input type="radio" name="category" value="" checked> Todos
        </label>
    `;
    categories.forEach(cat => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="radio" name="category" value="${cat}"> ${cat}`;
        categoryFiltersContainer.appendChild(label);
    });

    categoryFiltersContainer.addEventListener('change', renderProducts);
}

/**
 * Abre o modal de um produto específico.
 */
async function openProductModal(productId) {
    try {
        const response = await fetch(`${apiBaseUrl}/products/${productId}`);
        const { data } = await response.json();
        const modalBody = document.getElementById('modalBody');
        const seuNumeroWhatsapp = '5511999999999'; // Substitua
        const mensagem = encodeURIComponent(`Olá! Tenho interesse no produto: *${data.name}*.`);

        modalBody.innerHTML = `
            <h2>${data.name}</h2>
            <p>${data.description || 'Sem descrição detalhada.'}</p>
            <p><strong>Preço:</strong> R$ ${data.price ? data.price.toFixed(2) : 'A consultar'}</p>
            <p><strong>Categoria:</strong> ${data.category}</p>
            <div class="modal-buttons">
                <a href="https://wa.me/${seuNumeroWhatsapp}?text=${mensagem}" target="_blank" class="btn btn-primary">
                    <i class="fab fa-whatsapp"></i> Pedir no WhatsApp
                </a>
                ${data.google_drive_link ? `<a href="${data.google_drive_link}" target="_blank" class="btn btn-secondary">Ver Mockups</a>` : ''}
            </div>
        `;
        productModal.style.display = 'flex';
    } catch (error) {
        console.error('Erro ao buscar detalhes do produto:', error);
    }
}

/**
 * Abre o modal de campanhas.
 */
async function openCampaignsModal() {
    try {
        const response = await fetch(`${apiBaseUrl}/campaigns`);
        const { data } = await response.json();
        const modalBody = document.getElementById('campaignsModalBody');
        modalBody.innerHTML = '';

        if (data.length === 0) {
            modalBody.innerHTML = '<p>Nenhuma campanha ativa no momento.</p>';
        } else {
            data.forEach(campaign => {
                const campaignElement = document.createElement('div');
                campaignElement.className = 'campaign-item';
                campaignElement.innerHTML = `
                    <img src="${campaign.image_url || 'https://via.placeholder.com/400x200'}" alt="${campaign.title}">
                    <h3>${campaign.title}</h3>
                    <p>${campaign.description}</p>
                `;
                modalBody.appendChild(campaignElement);
            });
        }
        campaignsModal.style.display = 'flex';
    } catch (error) {
        console.error('Erro ao buscar campanhas:', error);
    }
}

/**
 * Lógica do botão "Voltar ao Topo".
 */
window.onscroll = function() {
    if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
        backToTopBtn.style.display = "block";
    } else {
        backToTopBtn.style.display = "none";
    }
};

backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

/**
 * Inicialização e Event Listeners.
 */
function init() {
    // Carrega os produtos
    fetchAllProducts();

    // Listeners dos filtros
    searchInput.addEventListener('input', renderProducts);
    sortOptions.addEventListener('change', renderProducts);
    promoFilter.addEventListener('change', renderProducts);

    // Listeners dos modais
    campaignsBtn.addEventListener('click', openCampaignsModal);

    document.addEventListener('click', (e) => {
        // Abrir modal do produto
        const card = e.target.closest('.product-card');
        if (card) {
            openProductModal(card.dataset.id);
            return;
        }

        // Fechar modais
        if (e.target.classList.contains('close-button') || e.target.classList.contains('modal')) {
            productModal.style.display = 'none';
            campaignsModal.style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', init);