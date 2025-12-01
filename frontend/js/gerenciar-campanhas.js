document.addEventListener('DOMContentLoaded', () => {
    // const apiUrl = 'http://localhost:3000/api/campaigns';
    const apiUrl = 'https://catalogo-limacalixto-api.onrender.com/api/campaigns'; // URL do seu backend no Render

    const campaignForm = document.getElementById('campaign-form');
    const campaignList = document.getElementById('campaign-list');
    const formTitle = document.getElementById('form-title');
    const campaignIdField = document.getElementById('campaign-id');
    const cancelEditBtn = document.getElementById('cancel-edit');

    // --- LÓGICA DE UPLOAD DE IMAGEM ---
    const CLOUDINARY_CLOUD_NAME = 'dayx6fx1n'; // <-- SUBSTITUA PELO SEU CLOUD NAME
    const CLOUDINARY_UPLOAD_PRESET = 'ml_default'; // <-- SUBSTITUA PELO SEU UPLOAD PRESET

    const uploadImageBtn = document.getElementById('upload-image-btn');
    const imageUploadInput = document.getElementById('image-upload-input');
    const imageUrlField = document.getElementById('image_url');
    const imagePreview = document.getElementById('image-preview');

    uploadImageBtn.addEventListener('click', () => imageUploadInput.click());

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
            imageUrlField.value = result.secure_url; // Cloudinary retorna a URL segura em 'secure_url'
            imagePreview.innerHTML = `<p>Pré-visualização:</p><img src="${result.secure_url}" alt="Preview">`;
            alert('Banner enviado com sucesso!');
        } catch (error) {
            // Exibe a mensagem de erro detalhada
            alert(`Ocorreu um erro ao enviar o banner: ${error.message}`);
            console.error('Erro no upload:', error);
        } finally {
            uploadImageBtn.textContent = 'Fazer Upload do Banner';
            uploadImageBtn.disabled = false;
            imageUploadInput.value = '';
        }
    });

    // Função para buscar e exibir as campanhas
    const fetchCampaigns = async () => {
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Erro ao buscar campanhas');
            const { data } = await response.json();

            campaignList.innerHTML = ''; // Limpa a lista
            data.forEach(campaign => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><img src="${campaign.image_url || 'https://via.placeholder.com/100x50'}" alt="${campaign.title}" class="table-img-preview"></td>
                    <td>${campaign.title}</td>
                    <td>
                        <button class="btn btn-edit" data-id="${campaign.id}">Editar</button>
                        <button class="btn btn-delete" data-id="${campaign.id}">Excluir</button>
                    </td>
                `;
                campaignList.appendChild(tr);
            });
        } catch (error) {
            console.error('Erro:', error);
            campaignList.innerHTML = '<tr><td colspan="3">Falha ao carregar campanhas.</td></tr>';
        }
    };

    // Função para resetar o formulário
    const resetForm = () => {
        campaignForm.reset();
        campaignIdField.value = '';
        formTitle.textContent = 'Adicionar Nova Campanha';
        cancelEditBtn.style.display = 'none';
        imagePreview.innerHTML = ''; // Limpa a pré-visualização
    };

    // Evento de submit do formulário (Criar/Atualizar)
    campaignForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = campaignIdField.value;
        const isEditing = !!id;

        const campaignData = {
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            image_url: document.getElementById('image_url').value,
        };

        try {
            const response = await fetch(isEditing ? `${apiUrl}/${id}` : apiUrl, {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(campaignData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao salvar campanha');
            }

            alert(`Campanha ${isEditing ? 'atualizada' : 'cadastrada'} com sucesso!`);
            resetForm();
            fetchCampaigns();

        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert(`Erro: ${error.message}`);
        }
    });

    // Eventos na lista (Editar/Excluir)
    campaignList.addEventListener('click', async (e) => {
        const target = e.target;

        // Botão de Excluir
        if (target.classList.contains('btn-delete')) {
            const id = target.dataset.id;
            if (confirm('Tem certeza que deseja excluir esta campanha?')) {
                try {
                    await fetch(`${apiUrl}/${id}`, { method: 'DELETE' });
                    alert('Campanha excluída com sucesso!');
                    fetchCampaigns();
                } catch (error) {
                    alert('Falha ao excluir a campanha.');
                }
            }
        }

        // Botão de Editar
        if (target.classList.contains('btn-edit')) {
            const id = target.dataset.id;
            try {
                const response = await fetch(`${apiUrl}/${id}`);
                const { data } = await response.json();

                formTitle.textContent = 'Editar Campanha';
                campaignIdField.value = data.id;
                document.getElementById('title').value = data.title;
                document.getElementById('description').value = data.description;
                document.getElementById('image_url').value = data.image_url;

                // Mostra a pré-visualização da imagem existente
                imagePreview.innerHTML = data.image_url ? `<p>Pré-visualização:</p><img src="${data.image_url}" alt="Preview">` : '';
                
                cancelEditBtn.style.display = 'inline-block';
                window.scrollTo(0, 0);

            } catch (error) {
                alert('Não foi possível carregar os dados da campanha para edição.');
            }
        }
    });

    cancelEditBtn.addEventListener('click', resetForm);

    // Carrega os dados iniciais
    fetchCampaigns();
});