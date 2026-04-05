class AdminManager {
    constructor() {
        this.submissions = [];
        this.filteredSubmissions = [];
        this.init();
    }

    async init() {
        // Проверяем авторизацию
        if (!document.cookie.includes('admin_session=')) {
            // Ждём пока admin-auth откроет модалку
            return;
        }

        try {
            await this.loadSubmissions();
            this.setupEventListeners();
            this.renderStats();
            this.renderSubmissions();
        } catch (error) {
            this.showError('Ошибка инициализации админ панели');
            console.error(error);
        }
    }

    async loadSubmissions() {
        try {
            const response = await fetch('/api/admin/submissions');
            const data = await response.json();
            
            if (!response.ok) {
                if (response.status === 403) {
                    window.location.href = '/';
                    return;
                }
                throw new Error(data.detail || 'Ошибка загрузки заявок');
            }
            
            this.submissions = data.submissions || [];
            this.filteredSubmissions = [...this.submissions];
        } catch (error) {
            this.showError(error.message);
            throw error;
        }
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterSubmissions(e.target.value);
            });
        }
    }

    filterSubmissions(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        
        if (!term) {
            this.filteredSubmissions = [...this.submissions];
        } else {
            this.filteredSubmissions = this.submissions.filter(sub => 
                sub.name.toLowerCase().includes(term) ||
                sub.phone.toLowerCase().includes(term) ||
                sub.email.toLowerCase().includes(term)
            );
        }
        
        this.renderSubmissions();
    }

    renderStats() {
        const total = this.submissions.length;
        const newSubmissions = this.submissions.filter(s => s.status === 'new' || !s.status).length;
        const completed = this.submissions.filter(s => s.status === 'completed').length;
        
        const today = new Date().toISOString().split('T')[0];
        const todaySubmissions = this.submissions.filter(s => 
            s.created_at && s.created_at.startsWith(today)
        ).length;

        this.updateStat('totalSubmissions', total);
        this.updateStat('newSubmissions', newSubmissions);
        this.updateStat('completedSubmissions', completed);
        this.updateStat('todaySubmissions', todaySubmissions);
    }

    updateStat(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    renderSubmissions() {
        const container = document.getElementById('submissionsContent');
        
        if (this.filteredSubmissions.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 10px;"></i>
                    <p>Заявки не найдены</p>
                </div>
            `;
            return;
        }

        const tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Имя</th>
                        <th>Телефон</th>
                        <th>Email</th>
                        <th>Тип помещения</th>
                        <th>Стиль</th>
                        <th>Бюджет</th>
                        <th>Дата</th>
                        <th>Статус</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.filteredSubmissions.map(sub => this.renderSubmissionRow(sub)).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;
        this.attachRowListeners();
    }

    renderSubmissionRow(submission) {
        const status = submission.status || 'new';
        const statusClass = `status-${status}`;
        const createdDate = new Date(submission.created_at).toLocaleDateString('ru-RU');
        
        return `
            <tr data-id="${submission.id}">
                <td>#${submission.id}</td>
                <td>${submission.name}</td>
                <td>${submission.phone}</td>
                <td>${submission.email}</td>
                <td>${submission.room_type}</td>
                <td>${submission.style}</td>
                <td>${submission.budget}</td>
                <td>${createdDate}</td>
                <td>
                    <span class="status-badge ${statusClass}">${this.getStatusText(status)}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-small btn-view" onclick="adminManager.viewSubmission(${submission.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <select class="status-select" onchange="adminManager.updateStatus(${submission.id}, this.value)">
                            <option value="new" ${status === 'new' ? 'selected' : ''}>Новая</option>
                            <option value="contacted" ${status === 'contacted' ? 'selected' : ''}>Связались</option>
                            <option value="in_progress" ${status === 'in_progress' ? 'selected' : ''}>В работе</option>
                            <option value="completed" ${status === 'completed' ? 'selected' : ''}>Завершена</option>
                            <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>Отмена</option>
                        </select>
                    </div>
                </td>
            </tr>
        `;
    }

    getStatusText(status) {
        const statusMap = {
            'new': 'Новая',
            'contacted': 'Связались',
            'in_progress': 'В работе',
            'completed': 'Завершена',
            'cancelled': 'Отмена'
        };
        return statusMap[status] || 'Новая';
    }

    attachRowListeners() {
        // Дополнительные обработчики если нужны
    }

    viewSubmission(id) {
        const submission = this.submissions.find(s => s.id === id);
        if (!submission) return;

        const zones = submission.zones ? submission.zones.split(',') : [];
        
        const modal = document.createElement('div');
        modal.className = 'auth-modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="auth-modal-content" style="max-width: 600px;">
                <span class="auth-close" onclick="this.closest('.auth-modal').remove()">&times;</span>
                <h2 style="margin-bottom: 20px;">Детали заявки #${submission.id}</h2>
                
                <div class="submission-details">
                    <div class="detail-row">
                        <span class="detail-label">Имя:</span>
                        <span class="detail-value">${submission.name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Телефон:</span>
                        <span class="detail-value">${submission.phone}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${submission.email}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Тип помещения:</span>
                        <span class="detail-value">${submission.room_type}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Зоны:</span>
                        <span class="detail-value">${zones.join(', ')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Площадь:</span>
                        <span class="detail-value">${submission.area} м²</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Стиль:</span>
                        <span class="detail-value">${submission.style}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Бюджет:</span>
                        <span class="detail-value">${submission.budget}</span>
                    </div>
                    ${submission.comment ? `
                    <div class="detail-row">
                        <span class="detail-label">Комментарий:</span>
                        <span class="detail-value">${submission.comment}</span>
                    </div>
                    ` : ''}
                    <div class="detail-row">
                        <span class="detail-label">Дата:</span>
                        <span class="detail-value">${new Date(submission.created_at).toLocaleString('ru-RU')}</span>
                    </div>
                    ${submission.user_nickname ? `
                    <div class="detail-row">
                        <span class="detail-label">Пользователь:</span>
                        <span class="detail-value">${submission.user_nickname}</span>
                    </div>
                    ` : ''}
                </div>
                
                <div style="margin-top: 20px; text-align: center;">
                    <button class="btn-primary-hero" onclick="this.closest('.auth-modal').remove()">Закрыть</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async updateStatus(id, newStatus) {
        try {
            const response = await fetch(`/api/admin/submissions/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || 'Ошибка обновления статуса');
            }

            // Обновляем локальные данные
            const submission = this.submissions.find(s => s.id === id);
            if (submission) {
                submission.status = newStatus;
            }

            this.renderStats();
            this.renderSubmissions();
            
        } catch (error) {
            this.showError(error.message);
            // Возвращаем предыдущий статус в select
            this.renderSubmissions();
        }
    }

    showError(message) {
        const errorElement = document.getElementById('adminError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    }
}

// Инициализация при загрузке страницы
let adminManager;
document.addEventListener('DOMContentLoaded', () => {
    adminManager = new AdminManager();
});
