document.addEventListener('DOMContentLoaded', () => {
    // const productsApiUrl = 'http://localhost:3000/api/products'; Para uso local
    // const campaignsApiUrl = 'http://localhost:3000/api/campaigns'; Para uso local
    const productsApiUrl = 'https://catalogo-limacalixto-api.onrender.com/api/products'; // URL do seu backend no Render
    const campaignsApiUrl = 'https://catalogo-limacalixto-api.onrender.com/api/campaigns'; // URL do seu backend no Render

    const productForm = document.getElementById('product-form');
    const productList = document.getElementById('product-list');
    const formTitle = document.getElementById('form-title');
    const productIdField = document.getElementById('product-id');
    const cancelEditBtn = document.getElementById('cancel-edit');
    const campaignFilter = document.getElementById('campaign-filter');

    // --- LÓGICA DE UPLOAD DE IMAGEM ---
    const CLOUDINARY_CLOUD_NAME = 'dayx6fx1n'; // <-- SUBSTITUA PELO SEU CLOUD NAME
    const CLOUDINARY_UPLOAD_PRESET = 'ml_default'; // <-- SUBSTITUA PELO SEU UPLOAD PRESET

    const uploadImageBtn = document.getElementById('upload-image-btn');
    const imageUploadInput = document.getElementById('image-upload-input');
    const imageUrlField = document.getElementById('image_url');
    const imagePreview = document.getElementById('image-preview');

    // Abre o seletor de arquivos ao clicar no botão
    uploadImageBtn.addEventListener('click', () => imageUploadInput.click());

    // Lida com a seleção do arquivo
    imageUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        uploadImageBtn.textContent = 'Enviando...';
        uploadImageBtn.disabled = true;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                // Captura e exibe o erro específico retornado pelo Cloudinary
                const errorData = await response.json();
                throw new Error(`Falha no upload: ${errorData.error.message}`);
            }

            const result = await response.json();
            const imgUrl = result.secure_url; // Cloudinary retorna a URL segura em 'secure_url'

            imageUrlField.value = imgUrl; // Preenche o campo oculto com a URL
            imagePreview.innerHTML = `<p>Pré-visualização:</p><img src="${imgUrl}" alt="Preview">`;
            alert('Imagem enviada com sucesso!');
        } catch (error) {
            console.error('Erro no upload:', error);
            alert(`Ocorreu um erro ao enviar a imagem: ${error.message}`);
        } finally {
            uploadImageBtn.textContent = 'Fazer Upload da Imagem';
            uploadImageBtn.disabled = false;
            imageUploadInput.value = ''; // Limpa o input de arquivo
        }
    });

    let allProducts = []; // Armazena todos os produtos para filtrar no frontend

    // Função para buscar e exibir os produtos
    const renderProducts = (filter = '') => {
        let productsToRender = allProducts;

        if (filter) {
            // Esta é uma simplificação. O ideal seria ter a campanha no produto.
            // Por agora, vamos filtrar pelo nome da categoria.
            productsToRender = allProducts.filter(p => p.category === filter);
        }

        productList.innerHTML = ''; // Limpa a lista antes de adicionar os itens
        productsToRender.forEach(product => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${product.on_sale ? '<span class="sale-tag-table">Oferta</span>' : 'Padrão'}</td>
                <td><img src="${product.image_url || 'https://via.placeholder.com/100x50'}" alt="${product.name}" class="table-img-preview"></td>
                <td>${product.name}</td>
                <td>${product.category || 'N/A'}</td>
                <td>R$ ${product.price ? product.price.toFixed(2) : '0.00'}</td>
                <td>
                    <button class="btn btn-edit" data-id="${product.id}">Editar</button>
                    <button class="btn btn-delete" data-id="${product.id}">Excluir</button>
                </td>
            `;
            productList.appendChild(tr);
        });
    };

    const fetchAllData = async () => {
        try {
            // Busca produtos
            const response = await fetch(productsApiUrl);
            if (!response.ok) throw new Error('Erro ao buscar produtos');
            const productsData = await response.json();
            allProducts = productsData.data;
            renderProducts();

            // Busca campanhas para o filtro
            const campaignsResponse = await fetch(campaignsApiUrl);
            if (!campaignsResponse.ok) return;
            const campaignsData = await campaignsResponse.json();
            
            campaignFilter.innerHTML = '<option value="">Todas as Campanhas</option>';
            campaignsData.data.forEach(campaign => {
                const option = document.createElement('option');
                // Simplificação: o valor do filtro é o título da campanha, que vamos comparar com a categoria do produto
                option.value = campaign.title.toLowerCase(); 
                option.textContent = campaign.title;
                campaignFilter.appendChild(option);
            });

        } catch (error) {
            console.error('Erro:', error);
            productList.innerHTML = '<tr><td colspan="6">Falha ao carregar produtos.</td></tr>';
        }
    };

    // Função para resetar o formulário e voltar ao modo "Adicionar"
    const resetForm = () => {
        productForm.reset();
        productIdField.value = '';
        formTitle.textContent = 'Adicionar Novo Produto';
        cancelEditBtn.style.display = 'none';
        imagePreview.innerHTML = ''; // Limpa a pré-visualização da imagem
    };

    // Evento de submit do formulário (para Criar e Atualizar)
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = productIdField.value;
        const isEditing = !!id;

        const productData = {
            name: document.getElementById('name').value,
            description: document.getElementById('description').value,
            price: parseFloat(document.getElementById('price').value) || 0,
            category: document.getElementById('category').value,
            google_drive_link: document.getElementById('google_drive_link').value,
            image_url: document.getElementById('image_url').value,
            on_sale: document.getElementById('on_sale').checked ? 1 : 0,
        };

        try {
            const response = await fetch(isEditing ? `${productsApiUrl}/${id}` : productsApiUrl, {
                method: isEditing ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // 'Authorization': `Bearer ${token}` // Descomente esta linha se tiver implementado autenticação
                },
                body: JSON.stringify(productData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao salvar produto');
            }

            alert(`Produto ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!`);
            resetForm();
            fetchAllData(); // Atualiza a lista

        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert(`Erro: ${error.message}`);
        }
    });

    // Eventos na lista de produtos (para Editar e Excluir)
    productList.addEventListener('click', async (e) => {
        const target = e.target;

        // Botão de Excluir
        if (target.classList.contains('btn-delete')) {
            const id = target.dataset.id;
            if (confirm('Tem certeza que deseja excluir este produto?')) {
                try {
                    const response = await fetch(`${productsApiUrl}/${id}`, { 
                        method: 'DELETE',
                        // headers: { 'Authorization': `Bearer ${token}` } // Descomente esta linha se tiver implementado autenticação
                    });
                    if (!response.ok) throw new Error('Erro ao excluir');
                    alert('Produto excluído com sucesso!');
                    fetchAllData(); // Atualiza a lista
                } catch (error) {
                    console.error('Erro ao excluir:', error);
                    alert('Falha ao excluir o produto.');
                }
            }
        }

        // Botão de Editar
        if (target.classList.contains('btn-edit')) {
            const id = target.dataset.id;
            try {
                const response = await fetch(`${productsApiUrl}/${id}`);
                if (!response.ok) throw new Error('Produto não encontrado');
                const { data } = await response.json();

                // Preenche o formulário com os dados do produto
                formTitle.textContent = 'Editar Produto';
                productIdField.value = data.id;
                document.getElementById('name').value = data.name;
                document.getElementById('description').value = data.description;
                document.getElementById('price').value = data.price;
                document.getElementById('category').value = data.category;
                document.getElementById('google_drive_link').value = data.google_drive_link;
                document.getElementById('image_url').value = data.image_url;
                document.getElementById('on_sale').checked = data.on_sale === 1;
                
                // Mostra a pré-visualização da imagem existente
                imagePreview.innerHTML = data.image_url ? `<p>Pré-visualização:</p><img src="${data.image_url}" alt="Preview">` : '';

                cancelEditBtn.style.display = 'inline-block'; // Mostra o botão de cancelar
                window.scrollTo(0, 0); // Rola a página para o topo para ver o formulário

            } catch (error) {
                console.error('Erro ao buscar produto para edição:', error);
                alert('Não foi possível carregar os dados do produto para edição.');
            }
        }
    });

    // Evento para o botão "Cancelar Edição"
    cancelEditBtn.addEventListener('click', resetForm);

    campaignFilter.addEventListener('change', () => renderProducts(campaignFilter.value));

    // Carrega os produtos ao iniciar a página
    fetchAllData();
});