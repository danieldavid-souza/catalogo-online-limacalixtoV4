// Variáveis globais
// const apiBaseUrl = 'http://localhost:3000/api';  Para uso local
const apiBaseUrl = 'https://catalogo-limacalixto-api.onrender.com/api'; // URL do seu backend no Render
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
 * Função utilitária para Debounce. Atraso na execução de uma função para evitar
 * chamadas excessivas durante eventos repetidos (como digitação).
 * @param {Function} func A função a ser executada.
 * @param {number} delay O tempo de espera em milissegundos.
 */
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}
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
 * Renderiza os produtos na tela. Pode receber uma lista de produtos para exibir.
 * Se nenhuma lista for fornecida, usa a lista completa (allProducts).
 */
function renderProducts(productsToRender = null) {
    let products = productsToRender;
    // Se a busca por IA retornou resultados, usamos eles.
    // Se não, aplicamos os filtros locais na lista completa.
    if (products === null) {
        products = [...allProducts];

        // Filtrar por categoria
        const selectedCategories = Array.from(document.querySelectorAll('input[name="category"]:checked'))
            .map(cb => cb.value)
            .filter(Boolean);
        if (selectedCategories.length > 0) {
            products = products.filter(p => p.category && selectedCategories.includes(p.category));
        }

        // Filtrar por promoção
        if (promoFilter && promoFilter.checked) {
            products = products.filter(p => p.on_sale === 1);
        }

        // Ordenar
        if (sortOptions) {
            const sortValue = sortOptions.value;
            switch (sortValue) {
                case 'price-asc':
                    products.sort((a, b) => a.price - b.price);
                    break;
                case 'price-desc':
                    products.sort((a, b) => b.price - a.price);
                    break;
                case 'name-asc':
                    products.sort((a, b) => a.name.localeCompare(b.name));
                    break;
                case 'name-desc':
                    products.sort((a, b) => b.name.localeCompare(a.name));
                    break;
            }
        }
    }

    if (!productGrid) return;
    productGrid.innerHTML = ''; // Limpa o grid antes de renderizar

    if (products.length === 0) {
        productGrid.innerHTML = '<p>Nenhum produto encontrado com os critérios selecionados.</p>';
        return;
    }

    products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.id = product.id;
            card.innerHTML = `
                ${product.on_sale ? '<div class="sale-tag">OFERTA</div>' : ''}
                <img src="${product.image_url || 'https://via.placeholder.com/300x300'}" alt="${product.name}" class="product-card-img">
                <h3>${product.name}</h3>
                <p class="category">${product.category || 'Serviço'}</p>
                <p class="price">R$ ${product.price ? product.price.toFixed(2) : 'Consulte'}</p>
                <div class="card-buttons">
                    <button class="btn btn-primary btn-view-details" data-id="${product.id}">Ver Detalhes</button>
                    ${product.google_drive_link ? `<a href="${product.google_drive_link}" target="_blank" class="btn btn-secondary btn-mockups">Ver Mockups</a>` : ''}
                </div>
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
        <!-- O filtro "Todos" é o padrão quando nada está selecionado -->
    `;
    categories.forEach(cat => {
        const label = document.createElement('label');
        // Trocamos 'radio' por 'checkbox'
        label.innerHTML = `<input type="checkbox" name="category" value="${cat}"> ${cat}`;
        categoryFiltersContainer.appendChild(label);
    });

    categoryFiltersContainer.addEventListener('change', handleSearch); // MUDANÇA IMPORTANTE
}

/**
 * Abre o modal de um produto específico.
 */
async function openProductModal(productId) {
    try {
        const response = await fetch(`${apiBaseUrl}/products/${productId}`);
        const { data } = await response.json();
        const modalBody = document.getElementById('modalBody'); // Certifique-se de que este ID existe no seu HTML
        const seuNumeroWhatsapp = '5532991657472'; // Substitua
        const mensagem = encodeURIComponent(`Olá! Tenho interesse no produto: *${data.name}*.`);

        // Adiciona a imagem do produto no modal
        modalBody.innerHTML = `
            <h2>${data.name}</h2>
            <p>${data.description || 'Sem descrição detalhada.'}</p>
            <p><strong>Preço:</strong> R$ ${data.price ? data.price.toFixed(2) : 'A consultar'}</p>
            <p><strong>Categoria:</strong> ${data.category}</p>
            <div class="modal-buttons">
                <a href="https://wa.me/${seuNumeroWhatsapp}?text=${mensagem}" target="_blank" class="btn btn-primary">
                    <i class="fab fa-whatsapp"></i> Pedir no WhatsApp
                </a>
                <!-- O botão "Ver Mockups" foi movido para o card do produto -->
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
 * Função para lidar com a busca, agora usando a API de IA.
 */
async function handleSearch() {
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    const isPromoActive = promoFilter ? promoFilter.checked : false;
    const selectedCategories = Array.from(document.querySelectorAll('input[name="category"]:checked')).map(cb => cb.value);

    // Se não há termo de busca, categoria selecionada ou filtro de promoção,
    // simplesmente renderiza a lista local completa.
    if (!searchTerm && selectedCategories.length === 0 && !isPromoActive) {
        renderProducts();
        return;
    }

    // Se há um termo de busca, usamos a busca por IA.
    if (searchTerm) {
        // Mostra um spinner de carregamento para melhor UX
        productGrid.innerHTML = `
            <div class="spinner-container">
                <div class="spinner"></div> <p>Buscando com Inteligência Artificial...</p>
            </div>`;

        try {
        const response = await fetch(`${apiBaseUrl}/products/ai-search?query=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) {
            throw new Error('A resposta da busca por IA não foi bem-sucedida.');
        }
        const { data } = await response.json();
        // Renderiza apenas os produtos retornados pela busca por IA
        renderProducts(data);
        } catch (error) {
            console.error('Erro na busca por IA:', error);
            productGrid.innerHTML = '<p>Ocorreu um erro ao realizar a busca. Tente novamente.</p>';
        }
    } else {
        // Se não há termo de busca, mas há filtros, aplica os filtros locais.
        renderProducts();
    }
}

/**
 * Inicialização e Event Listeners.
 */
function init() {
    // Carrega os produtos
    fetchAllProducts();
    
    // Listeners dos filtros e ordenação (exceto a busca)
    // Não precisam de debounce pois são ações únicas
    if (sortOptions) sortOptions.addEventListener('change', handleSearch);
    if (promoFilter) promoFilter.addEventListener('change', handleSearch);
    // O filtro de categoria já chama handleSearch e não precisa de debounce

    // Listeners dos modais
    campaignsBtn.addEventListener('click', openCampaignsModal);

    document.addEventListener('click', (e) => {
        // Abrir modal do produto
        const viewDetailsBtn = e.target.closest('.btn-view-details'); // Agora o modal abre ao clicar no botão "Ver Detalhes"
        if (viewDetailsBtn) {
            openProductModal(viewDetailsBtn.dataset.id);
            return;
        }

        // Fechar modais
        if (e.target.classList.contains('close-button') || e.target.classList.contains('modal')) {
            productModal.style.display = 'none';
            campaignsModal.style.display = 'none';
        }
    });

    // --- OTIMIZAÇÃO DA BUSCA COM DEBOUNCE ---
    // Cria uma versão "debounced" da nossa função de busca
    const debouncedSearch = debounce(handleSearch, 400); // Atraso de 400ms
    // Aciona a busca "debounced" sempre que o usuário digita no campo
    if (searchInput) searchInput.addEventListener('input', debouncedSearch);
    // Adicionamos um listener para o evento de limpar a busca (ícone 'x' no campo de busca)
    if (searchInput) searchInput.addEventListener('search', () => !searchInput.value && handleSearch());
}

document.addEventListener('DOMContentLoaded', init);