document.addEventListener('DOMContentLoaded', () => {
    const apiUrl = 'http://localhost:3000/api/campaigns';

    const campaignForm = document.getElementById('campaign-form');
    const campaignList = document.getElementById('campaign-list');
    const formTitle = document.getElementById('form-title');
    const campaignIdField = document.getElementById('campaign-id');
    const cancelEditBtn = document.getElementById('cancel-edit');

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