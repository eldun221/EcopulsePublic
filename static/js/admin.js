// Функции для работы с админ-панелью

// Глобальные переменные для передачи данных из шаблона
let currentUser = window.templateData.user || {};
let citiesData = window.templateData.cities || {};
let zoneTypes = window.templateData.zone_types || [];
let statuses = window.templateData.statuses || {};

// Основная инициализация
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация
    loadUsers();
    loadStatistics();

    // Открытие модального окна добавления зоны
    document.getElementById('open-add-zone-modal').addEventListener('click', function() {
        document.getElementById('add-zone-admin-modal').classList.add('active');
    });

    // Закрытие модальных окон
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').classList.remove('active');
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });

    // Переключение табов
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;

            // Убираем активный класс у всех табов
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Добавляем активный класс текущему табу
            this.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');

            // Загружаем данные для таба
            if (tabId === 'users') {
                loadUsers();
            } else if (tabId === 'reports') {
                loadStatistics();
            } else if (tabId === 'dictionaries') {
                loadDictionary('cities');
            }
        });
    });

    // Поиск зон
    const zoneSearch = document.getElementById('zone-search');
    if (zoneSearch) {
        zoneSearch.addEventListener('input', function() {
            filterZones(this.value);
        });
    }

    // Фильтры
    const cityFilter = document.getElementById('city-filter');
    const statusFilter = document.getElementById('status-filter');

    if (cityFilter) {
        cityFilter.addEventListener('change', filterZones);
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', filterZones);
    }

    // Валидация координат в форме добавления зоны
    const adminZoneLat = document.getElementById('admin-zone-lat');
    const adminZoneLng = document.getElementById('admin-zone-lng');

    if (adminZoneLat) {
        adminZoneLat.addEventListener('input', function() {
            this.value = this.value.replace(/[^\d.-]/g, '');
        });
    }

    if (adminZoneLng) {
        adminZoneLng.addEventListener('input', function() {
            this.value = this.value.replace(/[^\d.-]/g, '');
        });
    }

    // Форма добавления зоны админом
    const addZoneForm = document.getElementById('add-zone-admin-form');
    if (addZoneForm) {
        addZoneForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await submitAddZoneForm(this);
        });
    }

    // Форма назначения младшего администратора
    const promoteJuniorForm = document.getElementById('promote-junior-admin-form');
    if (promoteJuniorForm) {
        promoteJuniorForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await submitPromoteJuniorForm(this);
        });
    }

    // Форма назначения модератора
    const promoteModeratorForm = document.getElementById('promote-moderator-form');
    if (promoteModeratorForm) {
        promoteModeratorForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await submitPromoteModeratorForm(this);
        });
    }

    // Форма понижения пользователя
    const demoteForm = document.getElementById('demote-user-form');
    if (demoteForm) {
        demoteForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await submitDemoteForm(this);
        });
    }

    // Показать/скрыть поле пароля при выборе действия удаления
    const confirmDemote = document.getElementById('confirm-demote');
    if (confirmDemote) {
        confirmDemote.addEventListener('change', function() {
            const passwordGroup = document.getElementById('admin-password-group');
            if (this.value === 'delete' && passwordGroup) {
                passwordGroup.style.display = 'block';
                document.getElementById('delete-admin-password').required = true;
            } else if (passwordGroup) {
                passwordGroup.style.display = 'none';
                document.getElementById('delete-admin-password').required = false;
            }
        });
    }

    // Управление справочниками
    document.querySelectorAll('[data-dict]').forEach(btn => {
        btn.addEventListener('click', function() {
            const dictType = this.dataset.dict;

            // Убираем активный класс у всех кнопок
            document.querySelectorAll('[data-dict]').forEach(b => {
                b.classList.remove('active-dict');
            });

            // Добавляем активный класс текущей кнопке
            this.classList.add('active-dict');

            // Загружаем данные справочника
            loadDictionary(dictType);
        });
    });

    // Загрузка данных с выбранным местоположением из sessionStorage
    if (sessionStorage.getItem('pickedLocation')) {
        try {
            const location = JSON.parse(sessionStorage.getItem('pickedLocation'));
            if (document.getElementById('admin-zone-lat')) {
                document.getElementById('admin-zone-lat').value = location.lat;
                document.getElementById('admin-zone-lng').value = location.lng;
            }
            sessionStorage.removeItem('pickedLocation');
            sessionStorage.removeItem('adminAddingZone');

            // Показываем уведомление
            if (document.getElementById('add-zone-admin-modal').classList.contains('active')) {
                alert('Координаты успешно загружены из карты!');
            }
        } catch (e) {
            console.error('Ошибка загрузки координат:', e);
        }
    }
});

// Функция для выбора местоположения на карте
function pickLocationOnMap() {
    // Сохраняем текущее состояние формы
    sessionStorage.setItem('adminAddingZone', 'true');

    // Открываем главную страницу с картой в новой вкладке
    const city = document.getElementById('admin-zone-city').value || 'Барнаул';
    const url = `/?city=${encodeURIComponent(city)}&pick_location=true`;
    window.open(url, '_blank');

    alert('Выберите местоположение на карте в новой вкладке. Координаты автоматически подставятся в форму.');
}

// Загрузка пользователей
async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) {
            if (response.status === 401) {
                alert('Требуется авторизация для просмотра пользователей');
                return;
            }
            throw new Error('Ошибка загрузки пользователей');
        }

        const users = await response.json();
        const tbody = document.getElementById('users-tbody');
        const currentUserRole = currentUser.role || 'user';

        if (tbody) {
            tbody.innerHTML = users.map(user => {
                // Определяем бейдж роли
                let roleBadge = '';

                switch(user.role) {
                    case 'super_admin':
                        roleBadge = '<span class="role-badge-cell role-badge-super_admin"><i class="fas fa-crown"></i> Главный администратор</span>';
                        break;
                    case 'junior_admin':
                        roleBadge = '<span class="role-badge-cell role-badge-junior_admin"><i class="fas fa-user-shield"></i> Младший администратор</span>';
                        break;
                    case 'moderator':
                        roleBadge = '<span class="role-badge-cell role-badge-moderator"><i class="fas fa-user-check"></i> Модератор</span>';
                        break;
                    default:
                        roleBadge = '<span class="role-badge-cell role-badge-user"><i class="fas fa-user"></i> Пользователь</span>';
                }

                // Определяем доступные действия в зависимости от роли текущего пользователя
                let actions = '';
                const isCurrentUser = currentUser.id === user.id;

                if (!isCurrentUser) {
                    if (currentUserRole === 'super_admin') {
                        // Супер-администратор может назначать младших админов и модераторов, понижать всех кроме других супер-админов
                        if (user.role === 'user') {
                            actions = `
                                <button class="btn-promote-junior action-btn" onclick="promoteToJuniorAdmin(${user.id}, '${user.name}')" title="Назначить младшим администратором">
                                    <i class="fas fa-user-shield"></i>
                                </button>
                                <button class="btn-promote-moderator action-btn" onclick="promoteToModerator(${user.id}, '${user.name}')" title="Назначить модератором">
                                    <i class="fas fa-user-check"></i>
                                </button>
                                <button class="btn-demote action-btn" onclick="demoteUser(${user.id}, '${user.name}', '${user.role}')" title="Понизить/удалить" disabled>
                                    <i class="fas fa-user-minus"></i>
                                </button>
                            `;
                        } else if (user.role === 'moderator') {
                            actions = `
                                <button class="btn-promote-junior action-btn" onclick="promoteToJuniorAdmin(${user.id}, '${user.name}')" title="Назначить младшим администратором">
                                    <i class="fas fa-user-shield"></i>
                                </button>
                                <button class="btn-demote action-btn" onclick="demoteUser(${user.id}, '${user.name}', '${user.role}')" title="Понизить/удалить">
                                    <i class="fas fa-user-minus"></i>
                                </button>
                            `;
                        } else if (user.role === 'junior_admin') {
                            actions = `
                                <button class="btn-demote action-btn" onclick="demoteUser(${user.id}, '${user.name}', '${user.role}')" title="Понизить/удалить">
                                    <i class="fas fa-user-minus"></i>
                                </button>
                            `;
                        }
                    } else if (currentUserRole === 'junior_admin') {
                        // Младший администратор может назначать и понижать только модераторов
                        if (user.role === 'user') {
                            actions = `
                                <button class="btn-promote-moderator action-btn" onclick="promoteToModerator(${user.id}, '${user.name}')" title="Назначить модератором">
                                    <i class="fas fa-user-check"></i>
                                </button>
                                <button class="btn-demote action-btn" onclick="demoteUser(${user.id}, '${user.name}', '${user.role}')" title="Понизить" disabled>
                                    <i class="fas fa-user-minus"></i>
                                </button>
                            `;
                        } else if (user.role === 'moderator') {
                            actions = `
                                <button class="btn-demote action-btn" onclick="demoteUser(${user.id}, '${user.name}', '${user.role}')" title="Понизить">
                                    <i class="fas fa-user-minus"></i>
                                </button>
                            `;
                        }
                    }
                }

                return `
                    <tr id="user-row-${user.id}">
                        <td>${user.id}</td>
                        <td>
                            <strong>${user.name}</strong>
                            ${isCurrentUser ? '<span style="color: #666; font-size: 0.8rem; margin-left: 0.5rem;">(Вы)</span>' : ''}
                        </td>
                        <td>${user.email}</td>
                        <td>${roleBadge}</td>
                        <td>${user.city || 'Не указан'}</td>
                        <td>${user.created_at ? user.created_at.slice(0, 10) : ''}</td>
                        <td class="actions-cell">
                            <div class="actions-inline">
                                ${actions}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        const tbody = document.getElementById('users-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #f44336; padding: 2rem;">Ошибка загрузки данных пользователей</td></tr>';
        }
    }
}

// Назначение пользователя младшим администратором
function promoteToJuniorAdmin(userId, userName) {
    document.getElementById('promote-junior-user-id').value = userId;
    document.getElementById('promote-junior-user-name').value = userName;
    document.getElementById('promote-junior-admin-modal').classList.add('active');
}

// Назначение пользователя модератором
function promoteToModerator(userId, userName) {
    document.getElementById('promote-user-id').value = userId;
    document.getElementById('promote-user-name').value = userName;

    // Для супер-администратора показываем поле пароля
    if (currentUser.role === 'super_admin') {
        document.getElementById('admin-password').required = true;
        document.getElementById('admin-password').style.display = 'block';
        document.querySelector('label[for="admin-password"]').style.display = 'block';
    } else {
        document.getElementById('admin-password').required = false;
        document.getElementById('admin-password').style.display = 'none';
        document.querySelector('label[for="admin-password"]').style.display = 'none';
    }

    document.getElementById('promote-moderator-modal').classList.add('active');
}

// Понижение пользователя
function demoteUser(userId, userName, userRole) {
    document.getElementById('demote-user-id').value = userId;
    document.getElementById('demote-user-name').value = userName;
    document.getElementById('demote-user-role').value = userRole;

    // Скрываем поле пароля по умолчанию
    const passwordGroup = document.getElementById('admin-password-group');
    if (passwordGroup) {
        passwordGroup.style.display = 'none';
        document.getElementById('delete-admin-password').required = false;
    }

    // Сбрасываем выбранное действие
    document.getElementById('confirm-demote').value = '';

    document.getElementById('demote-user-modal').classList.add('active');
}

// Загрузка статистики
async function loadStatistics() {
    try {
        const response = await fetch('/api/admin/statistics');
        const stats = await response.json();

        // Системная статистика
        const systemStats = document.getElementById('system-stats');
        if (systemStats) {
            systemStats.innerHTML = `
                <div class="stat-item"><strong>Всего зон:</strong> ${stats.total_zones}</div>
                <div class="stat-item"><strong>Всего пользователей:</strong> ${stats.total_users}</div>
                <div class="stat-item"><strong>Всего отчётов:</strong> ${stats.total_reports}</div>
                <div class="stat-item"><strong>Активных проблем:</strong> ${stats.active_problems}</div>
                <div class="stat-item"><strong>Выполненных работ:</strong> ${stats.completed_maintenance}</div>
            `;
        }

        // Активные проблемы
        const activeProblems = document.getElementById('active-problems');
        if (activeProblems) {
            if (stats.problems_by_type && stats.problems_by_type.length > 0) {
                activeProblems.innerHTML = stats.problems_by_type.map(p => `
                    <div class="problem-item">
                        <strong>${p.problem_type}:</strong> ${p.count} проблем
                    </div>
                `).join('');
            } else {
                activeProblems.innerHTML = '<p>Нет активных проблем</p>';
            }
        }

        // Статистика по городам
        const cityStats = document.getElementById('city-stats');
        if (cityStats && stats.zones_by_city) {
            cityStats.innerHTML = Object.entries(stats.zones_by_city)
                .map(([city, count]) => `
                    <div class="city-stat">
                        <strong>${city}:</strong> ${count} зон
                    </div>
                `).join('');
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Фильтрация зон
function filterZones() {
    const searchTerm = document.getElementById('zone-search')?.value.toLowerCase() || '';
    const city = document.getElementById('city-filter')?.value || '';
    const status = document.getElementById('status-filter')?.value || '';

    const rows = document.querySelectorAll('#zones-tab tbody tr');

    rows.forEach(row => {
        const name = row.cells[1].textContent.toLowerCase();
        const rowCity = row.cells[2].textContent;
        const rowStatus = row.cells[4].textContent.trim();

        const matchesSearch = name.includes(searchTerm);
        const matchesCity = !city || rowCity === city;
        const matchesStatus = !status || rowStatus === status;

        row.style.display = matchesSearch && matchesCity && matchesStatus ? '' : 'none';
    });
}

// Просмотр деталей заявки
async function viewRequestDetails(requestId) {
    try {
        const response = await fetch(`/api/admin/request/${requestId}`);
        const request = await response.json();

        const modalContent = `
            <div class="request-details">
                <h3>${request.name}</h3>
                <div class="details-grid">
                    <div><strong>Город:</strong> ${request.city}</div>
                    <div><strong>Тип зоны:</strong> ${request.type}</div>
                    <div><strong>Координаты:</strong> ${request.lat}, ${request.lng}</div>
                    <div><strong>Площадь:</strong> ${request.area || 'Не указана'}</div>
                    <div><strong>Дата подачи:</strong> ${request.created_at}</div>
                    <div><strong>Пользователь:</strong> ${request.user_name} (${request.user_email})</div>
                </div>

                <div class="description-section">
                    <h4>Описание:</h4>
                    <p>${request.description || 'Описание отсутствует'}</p>
                </div>

                <div class="actions">
                    <button class="btn btn-success" onclick="approveRequest(${requestId})">
                        <i class="fas fa-check"></i> Принять
                    </button>
                    <button class="btn btn-danger" onclick="rejectRequest(${requestId})">
                        <i class="fas fa-times"></i> Отклонить
                    </button>
                </div>
            </div>
        `;

        document.getElementById('request-details').innerHTML = modalContent;
        document.getElementById('request-modal').classList.add('active');
    } catch (error) {
        console.error('Ошибка загрузки деталей заявки:', error);
        alert('Ошибка загрузки данных');
    }
}

// Одобрение заявки
async function approveRequest(requestId) {
    if (!confirm('Вы уверены, что хотите принять эту заявку?')) return;

    try {
        const response = await fetch(`/api/admin/approve-zone/${requestId}`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            alert('Заявка принята!');
            location.reload();
        } else {
            alert(data.error || 'Ошибка принятия заявки');
        }
    } catch (error) {
        console.error('Ошибка принятия заявки:', error);
        alert('Ошибка соединения');
    }
}

// Отклонение заявки
async function rejectRequest(requestId) {
    const reason = prompt('Укажите причину отклонения заявки:');
    if (reason === null) return;

    try {
        const response = await fetch(`/api/admin/reject-zone/${requestId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason })
        });

        const data = await response.json();

        if (data.success) {
            alert('Заявка отклонена!');
            location.reload();
        } else {
            alert(data.error || 'Ошибка отклонения заявки');
        }
    } catch (error) {
        console.error('Ошибка отклонения заявки:', error);
        alert('Ошибка соединения');
    }
}

// Просмотр зоны на карте
async function viewZoneOnMap(zoneId) {
    try {
        const response = await fetch(`/api/admin/zone/${zoneId}`);
        const zone = await response.json();

        if (zone.error) {
            alert(zone.error);
            return;
        }

        // Открываем карту в новой вкладке с координатами зоны
        const url = `/?city=${encodeURIComponent(zone.city)}&lat=${zone.lat}&lng=${zone.lng}&zoom=16&highlight=${zoneId}`;
        window.open(url, '_blank');
    } catch (error) {
        console.error('Ошибка загрузки данных зоны:', error);
        alert('Ошибка загрузки данных зоны');
    }
}

// Редактирование зоны
async function editZone(zoneId) {
    try {
        const response = await fetch(`/api/admin/zone/${zoneId}`);
        const zone = await response.json();

        if (zone.error) {
            alert(zone.error);
            return;
        }

        const formHtml = `
            <form id="edit-zone-form-${zoneId}">
                <div class="form-row">
                    <div class="form-group">
                        <label for="edit-name-${zoneId}">Название зоны *</label>
                        <input type="text" id="edit-name-${zoneId}" value="${zone.name}" required class="admin-form-input">
                    </div>
                    <div class="form-group">
                        <label for="edit-city-${zoneId}">Город *</label>
                        <select id="edit-city-${zoneId}" required class="admin-form-input">
                            <option value="">Выберите город</option>
                            ${Object.keys(citiesData).map(city => `
                                <option value="${city}" ${zone.city === city ? 'selected' : ''}>${city}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="edit-type-${zoneId}">Тип зоны *</label>
                        <select id="edit-type-${zoneId}" required class="admin-form-input">
                            ${zoneTypes.map(type => `
                                <option value="${type}" ${zone.type === type ? 'selected' : ''}>${type}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-status-${zoneId}">Статус *</label>
                        <select id="edit-status-${zoneId}" required class="admin-form-input">
                            ${Object.keys(statuses).map(status => `
                                <option value="${status}" ${zone.status === status ? 'selected' : ''}>${status}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="edit-lat-${zoneId}">Широта *</label>
                        <input type="text" id="edit-lat-${zoneId}" value="${zone.lat}" required
                               pattern="^-?\d+(\.\d+)?$"
                               title="Только цифры и точка" class="admin-form-input">
                    </div>
                    <div class="form-group">
                        <label for="edit-lng-${zoneId}">Долгота *</label>
                        <input type="text" id="edit-lng-${zoneId}" value="${zone.lng}" required
                               pattern="^-?\d+(\.\d+)?$"
                               title="Только цифры и точка" class="admin-form-input">
                    </div>
                </div>

                <div class="form-group">
                    <label for="edit-description-${zoneId}">Описание *</label>
                    <textarea id="edit-description-${zoneId}" rows="4" required class="admin-form-input">${zone.description || ''}</textarea>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i> Сохранить изменения
                    </button>
                </div>
            </form>
        `;

        document.getElementById('edit-zone-form-container').innerHTML = formHtml;
        document.getElementById('edit-zone-modal').classList.add('active');

        // Валидация ввода координат
        const latInput = document.getElementById(`edit-lat-${zoneId}`);
        const lngInput = document.getElementById(`edit-lng-${zoneId}`);

        if (latInput) {
            latInput.addEventListener('input', function() {
                this.value = this.value.replace(/[^\d.-]/g, '');
            });
        }

        if (lngInput) {
            lngInput.addEventListener('input', function() {
                this.value = this.value.replace(/[^\d.-]/g, '');
            });
        }

        // Обработка формы
        document.getElementById(`edit-zone-form-${zoneId}`).addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateZone(zoneId);
        });
    } catch (error) {
        console.error('Ошибка загрузки данных зоны:', error);
        alert('Ошибка загрузки данных');
    }
}

// Обновление зоны
async function updateZone(zoneId) {
    const formData = {
        name: document.getElementById(`edit-name-${zoneId}`).value,
        city: document.getElementById(`edit-city-${zoneId}`).value,
        type: document.getElementById(`edit-type-${zoneId}`).value,
        status: document.getElementById(`edit-status-${zoneId}`).value,
        lat: document.getElementById(`edit-lat-${zoneId}`).value,
        lng: document.getElementById(`edit-lng-${zoneId}`).value,
        description: document.getElementById(`edit-description-${zoneId}`).value
    };

    // Валидация координат с исправлением запятых на точки
    const lat = parseFloat(formData.lat.replace(',', '.'));
    const lng = parseFloat(formData.lng.replace(',', '.'));

    if (isNaN(lat) || lat < -90 || lat > 90) {
        alert('Пожалуйста, укажите корректную широту (-90 до 90)');
        return;
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
        alert('Пожалуйста, укажите корректную долготу (-180 до 180)');
        return;
    }

    // Обновляем значения координат с правильным форматом
    formData.lat = lat;
    formData.lng = lng;

    try {
        const response = await fetch(`/api/admin/zone/${zoneId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            alert('Зона успешно обновлена!');
            document.getElementById('edit-zone-modal').classList.remove('active');
            location.reload();
        } else {
            alert(data.error || 'Ошибка обновления зоны');
        }
    } catch (error) {
        console.error('Ошибка обновления зоны:', error);
        alert('Ошибка соединения с сервером');
    }
}

// Удаление зоны
async function deleteZone(zoneId) {
    if (!confirm('Вы уверены, что хотите удалить эту зону? Все связанные отчеты и история обслуживания также будут удалены.')) return;

    try {
        const response = await fetch(`/api/admin/zone/${zoneId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            alert('Зона удалена!');
            // Удаляем строку из таблицы без перезагрузки страницы
            const row = document.getElementById('zone-row-' + zoneId);
            if (row) {
                row.remove();
            }
            // Обновляем статистику
            updateZoneStats();
        } else {
            alert(data.error || 'Ошибка удаления зоны');
        }
    } catch (error) {
        console.error('Ошибка удаления зоны:', error);
        alert('Ошибка соединения');
    }
}

// Функция для обновления статистики зон
function updateZoneStats() {
    const zoneCount = document.querySelectorAll('#zones-tab tbody tr').length;
    const statCard = document.querySelector('.stat-card:nth-child(2) .stat-value');
    if (statCard) {
        statCard.textContent = zoneCount;
    }
}

// Генерация системного отчета
function generateSystemReport() {
    const report = {
        title: 'Системный отчет ЭКОПУЛЬС',
        date: new Date().toLocaleDateString('ru-RU'),
        data: {}
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecopulse_system_report_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Функция для загрузки справочника
// Загрузка справочника
async function loadDictionary(dictType) {
    try {
        const response = await fetch(`/api/dictionaries/${dictType}`);
        let data = await response.json();

        const container = document.getElementById('dictionary-content');

        if (!data.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-database"></i>
                    <h3>Справочник пуст</h3>
                    <p>Данные не найдены</p>
                </div>
            `;
            return;
        }

        // Определяем заголовки в зависимости от типа справочника
        let headers = [];
        let tableRows = '';

        switch(dictType) {
            case 'cities':
                headers = ['№', 'Название', 'Широта', 'Долгота', 'Зум', 'Статус', 'Действия'];
                tableRows = data.map((item, index) => `
                    <tr data-id="${item.id}" data-active="${item.is_active}">
                        <td>${item.display_id || index + 1}</td>
                        <td>${item.name}</td>
                        <td>${item.lat}</td>
                        <td>${item.lng}</td>
                        <td>${item.zoom}</td>
                        <td>
                            <span class="status-badge ${item.is_active ? 'active' : 'inactive'}">
                                ${item.is_active ? 'Активен' : 'Неактивен'}
                            </span>
                        </td>
                        <td class="actions-cell">
                            <div class="actions-inline">
                                <button class="btn-edit action-btn" onclick="editDictionaryItem('${dictType}', ${item.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-delete action-btn" onclick="deleteDictionaryItem('${dictType}', ${item.id}, '${item.name}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
                break;

            case 'statuses':
                headers = ['№', 'Название', 'Цвет', 'Иконка', 'Приоритет', 'Статус', 'Действия'];
                tableRows = data.map((item, index) => `
                    <tr data-id="${item.id}" data-active="${item.is_active}">
                        <td>${item.display_id || index + 1}</td>
                        <td>${item.name}</td>
                        <td>
                            <span class="color-preview" style="background-color: ${item.color}"></span>
                            ${item.color}
                        </td>
                        <td>${item.icon || '—'}</td>
                        <td>${item.priority}</td>
                        <td>
                            <span class="status-badge ${item.is_active ? 'active' : 'inactive'}">
                                ${item.is_active ? 'Активен' : 'Неактивен'}
                            </span>
                        </td>
                        <td class="actions-cell">
                            <div class="actions-inline">
                                <button class="btn-edit action-btn" onclick="editDictionaryItem('${dictType}', ${item.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-delete action-btn" onclick="deleteDictionaryItem('${dictType}', ${item.id}, '${item.name}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
                break;

            default:
                headers = ['№', 'Название', 'Описание', 'Статус', 'Действия'];
                tableRows = data.map((item, index) => `
                    <tr data-id="${item.id}" data-active="${item.is_active}">
                        <td>${item.display_id || index + 1}</td>
                        <td>${item.name}</td>
                        <td>${item.description || '—'}</td>
                        <td>
                            <span class="status-badge ${item.is_active ? 'active' : 'inactive'}">
                                ${item.is_active ? 'Активен' : 'Неактивен'}
                            </span>
                        </td>
                        <td class="actions-cell">
                            <div class="actions-inline">
                                <button class="btn-edit action-btn" onclick="editDictionaryItem('${dictType}', ${item.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-delete action-btn" onclick="deleteDictionaryItem('${dictType}', ${item.id}, '${item.name}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
        }

        container.innerHTML = `
            <div class="dictionary-header">
                <h3>Справочник: ${getDictionaryTitle(dictType)} (${data.length} записей)</h3>
                <div class="dictionary-filters">
                    <select id="dictionary-status-filter" onchange="filterDictionaryTable('${dictType}')">
                        <option value="all">Все статусы</option>
                        <option value="active">Только активные</option>
                        <option value="inactive">Только неактивные</option>
                    </select>
                    <div class="sort-buttons">
                        <button class="btn btn-outline" onclick="sortDictionaryTable('${dictType}', 'id')">
                            <i class="fas fa-sort-numeric-down"></i> По номеру
                        </button>
                        <button class="btn btn-outline" onclick="sortDictionaryTable('${dictType}', 'name')">
                            <i class="fas fa-sort-alpha-down"></i> По алфавиту
                        </button>
                        <button class="btn btn-outline" onclick="sortDictionaryTable('${dictType}', 'status')">
                            <i class="fas fa-sort"></i> По статусу
                        </button>
                    </div>
                    <button class="btn btn-primary" onclick="addDictionaryItem('${dictType}')">
                        <i class="fas fa-plus"></i> Добавить
                    </button>
                </div>
            </div>
            <table class="dictionary-table" id="${dictType}-table">
                <thead>
                    <tr>
                        ${headers.map(header => `<th>${header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `;

    } catch (error) {
        console.error('Ошибка загрузки справочника:', error);
        document.getElementById('dictionary-content').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Ошибка загрузки</h3>
                <p>Не удалось загрузить данные справочника</p>
            </div>
        `;
    }
}

// Функция для фильтрации таблицы справочника по статусу
// Функция для фильтрации таблицы справочника по статусу
function filterDictionaryTable(dictType) {
    const filterValue = document.getElementById('dictionary-status-filter').value;
    const table = document.getElementById(`${dictType}-table`);

    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');

    rows.forEach(row => {
        const isActive = row.getAttribute('data-active') === '1';

        switch(filterValue) {
            case 'all':
                row.style.display = '';
                break;
            case 'active':
                row.style.display = isActive ? '' : 'none';
                break;
            case 'inactive':
                row.style.display = isActive ? 'none' : '';
                break;
        }
    });
}

// Функция для сортировки таблицы справочника
function sortDictionaryTable(dictType, sortBy) {
    const table = document.getElementById(`${dictType}-table`);
    if (!table) return;

    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    rows.sort((a, b) => {
        const aActive = a.getAttribute('data-active') === '1';
        const bActive = b.getAttribute('data-active') === '1';
        const aName = a.cells[1].textContent;
        const bName = b.cells[1].textContent;

        if (sortBy === 'status') {
            // Сначала активные, потом неактивные
            if (aActive === bActive) {
                return aName.localeCompare(bName, 'ru');
            }
            return aActive ? -1 : 1;
        } else if (sortBy === 'name') {
            // По алфавиту
            return aName.localeCompare(bName, 'ru');
        } else if (sortBy === 'id') {
            // По порядковому номеру
            const aId = parseInt(a.cells[0].textContent);
            const bId = parseInt(b.cells[0].textContent);
            return aId - bId;
        }
        return 0;
    });

    // Очищаем и перезаполняем таблицу
    rows.forEach(row => tbody.appendChild(row));
}

function getDictionaryTitle(dictType) {
    const titles = {
        'cities': 'Города',
        'zone_types': 'Типы зон',
        'statuses': 'Статусы зон',
        'problem_types': 'Типы проблем'
    };
    return titles[dictType] || dictType;
}

function getDictionaryTitle(dictType) {
    const titles = {
        'cities': 'Города',
        'zone_types': 'Типы зон',
        'statuses': 'Статусы зон',
        'problem_types': 'Типы проблем'
    };
    return titles[dictType] || dictType;
}
// Сортировка таблицы городов
function sortCitiesTable(sortBy) {
    const table = document.getElementById('cities-table');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    rows.sort((a, b) => {
        let aValue, bValue;
        if (sortBy === 'id') {
            aValue = parseInt(a.cells[0].textContent);
            bValue = parseInt(b.cells[0].textContent);
            return aValue - bValue;
        } else if (sortBy === 'name') {
            aValue = a.cells[1].textContent;
            bValue = b.cells[1].textContent;
            return aValue.localeCompare(bValue, 'ru');
        }
        return 0;
    });

    // Удаляем существующие строки
    rows.forEach(row => tbody.removeChild(row));

    // Добавляем отсортированные строки
    rows.forEach(row => tbody.appendChild(row));
}

// Функция для сортировки таблицы справочника
function sortDictionaryTable(dictType, sortBy) {
    const table = document.getElementById(`${dictType}-table`);
    if (!table) return;

    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    rows.sort((a, b) => {
        const aActive = a.getAttribute('data-active') === '1';
        const bActive = b.getAttribute('data-active') === '1';
        const aName = a.cells[1].textContent;
        const bName = b.cells[1].textContent;

        if (sortBy === 'status') {
            // Сначала активные, потом неактивные
            if (aActive === bActive) {
                return aName.localeCompare(bName, 'ru');
            }
            return aActive ? -1 : 1;
        } else if (sortBy === 'name') {
            // По алфавиту
            return aName.localeCompare(bName, 'ru');
        } else if (sortBy === 'id') {
            // По порядковому номеру
            const aId = parseInt(a.cells[0].textContent);
            const bId = parseInt(b.cells[0].textContent);
            return aId - bId;
        }
        return 0;
    });

    // Очищаем и перезаполняем таблицу
    rows.forEach(row => tbody.appendChild(row));
}

function addDictionaryItem(dictType) {
    let formHtml = '';
    const title = getDictionaryTitle(dictType);

    switch(dictType) {
        case 'cities':
            formHtml = `
                <form id="add-dictionary-form">
                    <div class="form-group">
                        <label for="dict-name">Название города *</label>
                        <input type="text" id="dict-name" required class="admin-form-input">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="dict-lat">Широта *</label>
                            <input type="number" step="0.000001" id="dict-lat" required class="admin-form-input">
                        </div>
                        <div class="form-group">
                            <label for="dict-lng">Долгота *</label>
                            <input type="number" step="0.000001" id="dict-lng" required class="admin-form-input">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="dict-zoom">Уровень зума</label>
                        <input type="number" id="dict-zoom" value="12" min="1" max="18" class="admin-form-input">
                    </div>
                    <div class="form-group">
                        <label for="dict-active">Статус</label>
                        <select id="dict-active" class="admin-form-input">
                            <option value="1">Активен</option>
                            <option value="0">Неактивен</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Добавить</button>
                    </div>
                </form>
            `;
            break;

        case 'statuses':
            formHtml = `
                <form id="add-dictionary-form">
                    <div class="form-group">
                        <label for="dict-name">Название статуса *</label>
                        <input type="text" id="dict-name" required class="admin-form-input">
                    </div>
                    <div class="form-group">
                        <label for="dict-color">Цвет *</label>
                        <input type="color" id="dict-color" value="#4caf50" required class="admin-form-input">
                    </div>
                    <div class="form-group">
                        <label for="dict-icon">Иконка (emoji)</label>
                        <input type="text" id="dict-icon" placeholder="🟢" class="admin-form-input">
                    </div>
                    <div class="form-group">
                        <label for="dict-priority">Приоритет (1-5)</label>
                        <input type="number" id="dict-priority" value="3" min="1" max="5" class="admin-form-input">
                    </div>
                    <div class="form-group">
                        <label for="dict-active">Статус</label>
                        <select id="dict-active" class="admin-form-input">
                            <option value="1">Активен</option>
                            <option value="0">Неактивен</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Добавить</button>
                    </div>
                </form>
            `;
            break;

        default:
            formHtml = `
                <form id="add-dictionary-form">
                    <div class="form-group">
                        <label for="dict-name">Название *</label>
                        <input type="text" id="dict-name" required class="admin-form-input">
                    </div>
                    <div class="form-group">
                        <label for="dict-description">Описание</label>
                        <textarea id="dict-description" rows="3" class="admin-form-input"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="dict-active">Статус</label>
                        <select id="dict-active" class="admin-form-input">
                            <option value="1">Активен</option>
                            <option value="0">Неактивен</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Добавить</button>
                    </div>
                </form>
            `;
    }

    document.getElementById('dictionary-modal-title').textContent = `Добавить в справочник: ${title}`;
    document.getElementById('dictionary-modal-content').innerHTML = formHtml;
    document.getElementById('dictionary-modal').classList.add('active');

    // Обработка формы
    document.getElementById('add-dictionary-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveDictionaryItem(dictType, null);
    });
}

async function editDictionaryItem(dictType, itemId) {
    try {
        const response = await fetch(`/api/dictionaries/${dictType}`);
        let data = await response.json();

        // Сортировка данных по ID для поиска элемента
        if (dictType === 'zone_types' || dictType === 'statuses' || dictType === 'problem_types') {
            data.sort((a, b) => a.id - b.id);
        }

        const item = data.find(i => i.id === itemId);

        if (!item) {
            alert('Элемент не найден');
            return;
        }

        const title = getDictionaryTitle(dictType);
        let formHtml = '';

        switch(dictType) {
            case 'cities':
                formHtml = `
                    <form id="edit-dictionary-form">
                        <div class="form-group">
                            <label for="dict-name">Название города *</label>
                            <input type="text" id="dict-name" value="${item.name}" required class="admin-form-input">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="dict-lat">Широта *</label>
                                <input type="number" step="0.000001" id="dict-lat" value="${item.lat}" required class="admin-form-input">
                            </div>
                            <div class="form-group">
                                <label for="dict-lng">Долгота *</label>
                                <input type="number" step="0.000001" id="dict-lng" value="${item.lng}" required class="admin-form-input">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="dict-zoom">Уровень зума</label>
                            <input type="number" id="dict-zoom" value="${item.zoom}" min="1" max="18" class="admin-form-input">
                        </div>
                        <div class="form-group">
                            <label for="dict-active">Статус</label>
                            <select id="dict-active" class="admin-form-input">
                                <option value="1" ${item.is_active ? 'selected' : ''}>Активен</option>
                                <option value="0" ${!item.is_active ? 'selected' : ''}>Неактивен</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Сохранить</button>
                        </div>
                    </form>
                `;
                break;

            case 'statuses':
                formHtml = `
                    <form id="edit-dictionary-form">
                        <div class="form-group">
                            <label for="dict-name">Название статуса *</label>
                            <input type="text" id="dict-name" value="${item.name}" required class="admin-form-input">
                        </div>
                        <div class="form-group">
                            <label for="dict-color">Цвет *</label>
                            <input type="color" id="dict-color" value="${item.color}" required class="admin-form-input">
                        </div>
                        <div class="form-group">
                            <label for="dict-icon">Иконка (emoji)</label>
                            <input type="text" id="dict-icon" value="${item.icon || ''}" placeholder="🟢" class="admin-form-input">
                        </div>
                        <div class="form-group">
                            <label for="dict-priority">Приоритет (1-5)</label>
                            <input type="number" id="dict-priority" value="${item.priority}" min="1" max="5" class="admin-form-input">
                        </div>
                        <div class="form-group">
                            <label for="dict-active">Статус</label>
                            <select id="dict-active" class="admin-form-input">
                                <option value="1" ${item.is_active ? 'selected' : ''}>Активен</option>
                                <option value="0" ${!item.is_active ? 'selected' : ''}>Неактивен</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Сохранить</button>
                        </div>
                    </form>
                `;
                break;

            default:
                formHtml = `
                    <form id="edit-dictionary-form">
                        <div class="form-group">
                            <label for="dict-name">Название *</label>
                            <input type="text" id="dict-name" value="${item.name}" required class="admin-form-input">
                        </div>
                        <div class="form-group">
                            <label for="dict-description">Описание</label>
                            <textarea id="dict-description" rows="3" class="admin-form-input">${item.description || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="dict-active">Статус</label>
                            <select id="dict-active" class="admin-form-input">
                                <option value="1" ${item.is_active ? 'selected' : ''}>Активен</option>
                                <option value="0" ${!item.is_active ? 'selected' : ''}>Неактивен</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Сохранить</button>
                        </div>
                    </form>
                `;
        }

        document.getElementById('dictionary-modal-title').textContent = `Редактирование: ${title}`;
        document.getElementById('dictionary-modal-content').innerHTML = formHtml;
        document.getElementById('dictionary-modal').classList.add('active');

        // Обработка формы
        document.getElementById('edit-dictionary-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            await saveDictionaryItem(dictType, itemId);
        });

    } catch (error) {
        console.error('Ошибка загрузки элемента:', error);
        alert('Ошибка загрузки данных');
    }
}

async function saveDictionaryItem(dictType, itemId) {
    const form = document.getElementById(itemId ? 'edit-dictionary-form' : 'add-dictionary-form');
    const formData = new FormData(form);

    let data = {};

    if (dictType === 'cities') {
        data = {
            name: document.getElementById('dict-name').value,
            lat: parseFloat(document.getElementById('dict-lat').value),
            lng: parseFloat(document.getElementById('dict-lng').value),
            zoom: parseInt(document.getElementById('dict-zoom').value),
            is_active: parseInt(document.getElementById('dict-active').value)
        };
    } else if (dictType === 'statuses') {
        data = {
            name: document.getElementById('dict-name').value,
            color: document.getElementById('dict-color').value,
            icon: document.getElementById('dict-icon').value,
            priority: parseInt(document.getElementById('dict-priority').value),
            is_active: parseInt(document.getElementById('dict-active').value)
        };
    } else {
        data = {
            name: document.getElementById('dict-name').value,
            description: document.getElementById('dict-description').value,
            is_active: parseInt(document.getElementById('dict-active').value)
        };
    }

    try {
        const url = itemId ?
            `/api/admin/dictionaries/${dictType}/${itemId}` :
            `/api/admin/dictionaries/${dictType}`;

        const method = itemId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            alert(result.message);
            document.getElementById('dictionary-modal').classList.remove('active');
            loadDictionary(dictType);
        } else {
            alert(result.error || 'Ошибка сохранения');
        }
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка соединения с сервером');
    }
}

// Функция для полного удаления элемента справочника
async function deleteDictionaryItem(dictType, itemId, itemName) {
    if (!confirm(`Вы уверены, что хотите полностью удалить элемент "${itemName}"?\n\n⚠️ Внимание: Это действие невозможно отменить!`)) return;

    try {
        const response = await fetch(`/api/admin/dictionaries/${dictType}/${itemId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            alert(result.message);
            loadDictionary(dictType);
        } else {
            alert(result.error || 'Ошибка удаления элемента');
        }
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка соединения с сервером');
    }
}
// Функция для загрузки справочника
async function loadDictionary(dictType) {
    try {
        const response = await fetch(`/api/dictionaries/${dictType}`);
        let data = await response.json();

        const container = document.getElementById('dictionary-content');

        if (!data.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-database"></i>
                    <h3>Справочник пуст</h3>
                    <p>Данные не найдены</p>
                </div>
            `;
            return;
        }

        // Определяем заголовки в зависимости от типа справочника
        let headers = [];
        let tableRows = '';

        switch(dictType) {
            case 'cities':
                headers = ['№', 'Название', 'Широта', 'Долгота', 'Зум', 'Статус', 'Действия'];
                tableRows = data.map((item, index) => `
                    <tr data-id="${item.id}" data-active="${item.is_active}">
                        <td>${index + 1}</td>
                        <td>${item.name}</td>
                        <td>${item.lat}</td>
                        <td>${item.lng}</td>
                        <td>${item.zoom}</td>
                        <td>
                            <span class="status-badge ${item.is_active ? 'active' : 'inactive'}">
                                ${item.is_active ? 'Активен' : 'Неактивен'}
                            </span>
                        </td>
                        <td class="actions-cell">
                            <div class="actions-inline">
                                <button class="btn-edit action-btn" onclick="editDictionaryItem('${dictType}', ${item.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-toggle action-btn" onclick="toggleDictionaryItemActive('${dictType}', ${item.id}, ${item.is_active})"
                                        title="${item.is_active ? 'Деактивировать' : 'Активировать'}">
                                    <i class="fas ${item.is_active ? 'fa-ban' : 'fa-check'}"></i>
                                </button>
                                <button class="btn-delete-hard action-btn" onclick="deleteDictionaryItem('${dictType}', ${item.id}, '${item.name}')" title="Полностью удалить">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
                break;

            case 'statuses':
                headers = ['№', 'Название', 'Цвет', 'Иконка', 'Приоритет', 'Статус', 'Действия'];
                tableRows = data.map((item, index) => `
                    <tr data-id="${item.id}" data-active="${item.is_active}">
                        <td>${index + 1}</td>
                        <td>${item.name}</td>
                        <td>
                            <span class="color-preview" style="background-color: ${item.color}"></span>
                            ${item.color}
                        </td>
                        <td>${item.icon || '—'}</td>
                        <td>${item.priority}</td>
                        <td>
                            <span class="status-badge ${item.is_active ? 'active' : 'inactive'}">
                                ${item.is_active ? 'Активен' : 'Неактивен'}
                            </span>
                        </td>
                        <td class="actions-cell">
                            <div class="actions-inline">
                                <button class="btn-edit action-btn" onclick="editDictionaryItem('${dictType}', ${item.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-toggle action-btn" onclick="toggleDictionaryItemActive('${dictType}', ${item.id}, ${item.is_active})"
                                        title="${item.is_active ? 'Деактивировать' : 'Активировать'}">
                                    <i class="fas ${item.is_active ? 'fa-ban' : 'fa-check'}"></i>
                                </button>
                                <button class="btn-delete-hard action-btn" onclick="deleteDictionaryItem('${dictType}', ${item.id}, '${item.name}')" title="Полностью удалить">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
                break;

            default:
                headers = ['№', 'Название', 'Описание', 'Статус', 'Действия'];
                tableRows = data.map((item, index) => `
                    <tr data-id="${item.id}" data-active="${item.is_active}">
                        <td>${index + 1}</td>
                        <td>${item.name}</td>
                        <td>${item.description || '—'}</td>
                        <td>
                            <span class="status-badge ${item.is_active ? 'active' : 'inactive'}">
                                ${item.is_active ? 'Активен' : 'Неактивен'}
                            </span>
                        </td>
                        <td class="actions-cell">
                            <div class="actions-inline">
                                <button class="btn-edit action-btn" onclick="editDictionaryItem('${dictType}', ${item.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-toggle action-btn" onclick="toggleDictionaryItemActive('${dictType}', ${item.id}, ${item.is_active})"
                                        title="${item.is_active ? 'Деактивировать' : 'Активировать'}">
                                    <i class="fas ${item.is_active ? 'fa-ban' : 'fa-check'}"></i>
                                </button>
                                <button class="btn-delete-hard action-btn" onclick="deleteDictionaryItem('${dictType}', ${item.id}, '${item.name}')" title="Полностью удалить">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
        }

        container.innerHTML = `
            <div class="dictionary-header">
                <h3>Справочник: ${getDictionaryTitle(dictType)} (${data.length} записей)</h3>
                <div class="dictionary-filters">
                    <select id="dictionary-status-filter" onchange="filterDictionaryTable('${dictType}')">
                        <option value="all">Все статусы</option>
                        <option value="active">Только активные</option>
                        <option value="inactive">Только неактивные</option>
                    </select>
                    <div class="sort-buttons">
                        <button class="btn btn-outline" onclick="sortDictionaryTable('${dictType}', 'id')">
                            <i class="fas fa-sort-numeric-down"></i> По номеру
                        </button>
                        <button class="btn btn-outline" onclick="sortDictionaryTable('${dictType}', 'name')">
                            <i class="fas fa-sort-alpha-down"></i> По алфавиту
                        </button>
                        <button class="btn btn-outline" onclick="sortDictionaryTable('${dictType}', 'status')">
                            <i class="fas fa-sort"></i> По статусу
                        </button>
                    </div>
                    <button class="btn btn-primary" onclick="addDictionaryItem('${dictType}')">
                        <i class="fas fa-plus"></i> Добавить
                    </button>
                </div>
            </div>
            <table class="dictionary-table" id="${dictType}-table">
                <thead>
                    <tr>
                        ${headers.map(header => `<th>${header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `;

    } catch (error) {
        console.error('Ошибка загрузки справочника:', error);
        document.getElementById('dictionary-content').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Ошибка загрузки</h3>
                <p>Не удалось загрузить данные справочника</p>
            </div>
        `;
    }
}

// Функция для переключения активности элемента справочника
async function toggleDictionaryItemActive(dictType, itemId, currentActive) {
    const action = currentActive ? 'деактивации' : 'активации';
    if (!confirm(`Вы уверены, что хотите выполнить ${action} элемента?`)) return;

    try {
        const response = await fetch(`/api/admin/dictionaries/${dictType}/${itemId}/toggle`, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            alert(result.message);
            loadDictionary(dictType);
        } else {
            alert(result.error || 'Ошибка при изменении активности');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка соединения с сервером');
    }
}

// Функция для полного удаления элемента справочника
async function deleteDictionaryItem(dictType, itemId, itemName) {
    if (!confirm(`Вы уверены, что хотите полностью удалить элемент "${itemName}"? Это действие нельзя отменить!`)) return;

    try {
        const response = await fetch(`/api/admin/dictionaries/${dictType}/${itemId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            alert(result.message);
            loadDictionary(dictType);
        } else {
            alert(result.error || 'Ошибка удаления');
        }
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка соединения с сервером');
    }
}

// Функция для фильтрации таблицы справочника по статусу
function filterDictionaryTable(dictType) {
    const filterValue = document.getElementById('dictionary-status-filter').value;
    const table = document.getElementById(`${dictType}-table`);

    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');

    rows.forEach(row => {
        const isActive = row.getAttribute('data-active') === '1';

        switch(filterValue) {
            case 'all':
                row.style.display = '';
                break;
            case 'active':
                row.style.display = isActive ? '' : 'none';
                break;
            case 'inactive':
                row.style.display = isActive ? 'none' : '';
                break;
        }
    });
}

// Функция для сортировки таблицы справочника
function sortDictionaryTable(dictType, sortBy) {
    const table = document.getElementById(`${dictType}-table`);
    if (!table) return;

    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    rows.sort((a, b) => {
        const aActive = a.getAttribute('data-active') === '1';
        const bActive = b.getAttribute('data-active') === '1';
        const aName = a.cells[1].textContent;
        const bName = b.cells[1].textContent;
        const aId = parseInt(a.cells[0].textContent);
        const bId = parseInt(b.cells[0].textContent);

        if (sortBy === 'status') {
            // Сначала активные, потом неактивные
            if (aActive === bActive) {
                return aName.localeCompare(bName, 'ru');
            }
            return aActive ? -1 : 1;
        } else if (sortBy === 'name') {
            // По алфавиту
            return aName.localeCompare(bName, 'ru');
        } else if (sortBy === 'id') {
            // По порядковому номеру
            return aId - bId;
        }
        return 0;
    });

    // Очищаем и перезаполняем таблицу
    rows.forEach(row => tbody.appendChild(row));
}
// Вспомогательные функции для обработки форм
async function submitAddZoneForm(form) {
    const formData = {
        name: document.getElementById('admin-zone-name').value,
        city: document.getElementById('admin-zone-city').value,
        type: document.getElementById('admin-zone-type').value,
        status: document.getElementById('admin-zone-status').value,
        lat: document.getElementById('admin-zone-lat').value,
        lng: document.getElementById('admin-zone-lng').value,
        description: document.getElementById('admin-zone-description').value
    };

    // Валидация координат с исправлением запятых на точки
    const lat = parseFloat(formData.lat.replace(',', '.'));
    const lng = parseFloat(formData.lng.replace(',', '.'));

    if (isNaN(lat) || lat < -90 || lat > 90) {
        alert('Пожалуйста, укажите корректную широту (-90 до 90)');
        return;
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
        alert('Пожалуйста, укажите корректную долготу (-180 до 180)');
        return;
    }

    // Обновляем значения координат с правильным форматом
    formData.lat = lat;
    formData.lng = lng;

    if (!formData.name || !formData.city || !formData.type) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Добавление...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/admin/add-zone', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            alert(`Зона успешно добавлена! ID: ${data.zone_id}`);
            document.getElementById('add-zone-admin-modal').classList.remove('active');
            form.reset();

            setTimeout(() => location.reload(), 1000);
        } else {
            alert(data.error || 'Ошибка добавления зоны');
        }
    } catch (error) {
        console.error('Ошибка добавления зоны:', error);
        alert('Ошибка соединения с сервером');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function submitPromoteJuniorForm(form) {
    const userId = document.getElementById('promote-junior-user-id').value;
    const adminPassword = document.getElementById('super-admin-password').value;

    if (!adminPassword) {
        alert('Пожалуйста, введите пароль супер-администратора');
        return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Назначение...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`/api/admin/promote-junior-admin/${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ admin_password: adminPassword })
        });

        const data = await response.json();

        if (data.success) {
            alert('Пользователь успешно назначен младшим администратором!');
            document.getElementById('promote-junior-admin-modal').classList.remove('active');
            loadUsers();
        } else {
            alert(data.error || 'Ошибка назначения младшего администратора');
        }
    } catch (error) {
        console.error('Ошибка назначения младшего администратора:', error);
        alert('Ошибка соединения с сервером');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        form.reset();
    }
}

async function submitPromoteModeratorForm(form) {
    const userId = document.getElementById('promote-user-id').value;
    let adminPassword = '';

    if (currentUser.role === 'super_admin') {
        adminPassword = document.getElementById('admin-password').value;
        if (!adminPassword) {
            alert('Пожалуйста, введите пароль администратора');
            return;
        }
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Назначение...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`/api/admin/promote-moderator/${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ admin_password: adminPassword })
        });

        const data = await response.json();

        if (data.success) {
            alert('Пользователь успешно назначен модератором!');
            document.getElementById('promote-moderator-modal').classList.remove('active');
            loadUsers();
        } else {
            alert(data.error || 'Ошибка назначения модератора');
        }
    } catch (error) {
        console.error('Ошибка назначения модератора:', error);
        alert('Ошибка соединения с сервером');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        form.reset();
    }
}

async function submitDemoteForm(form) {
    const userId = document.getElementById('demote-user-id').value;
    const action = document.getElementById('confirm-demote').value;
    let adminPassword = '';

    if (!action) {
        alert('Пожалуйста, выберите действие');
        return;
    }

    if (action === 'delete') {
        adminPassword = document.getElementById('delete-admin-password').value;
        if (!adminPassword) {
            alert('Пожалуйста, введите пароль супер-администратора для удаления пользователя');
            return;
        }
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обработка...';
    submitBtn.disabled = true;

    try {
        let response;
        if (action === 'delete') {
            response = await fetch(`/api/admin/delete-user/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ admin_password: adminPassword })
            });
        } else {
            response = await fetch(`/api/admin/demote-user/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({})
            });
        }

        const data = await response.json();

        if (data.success) {
            const message = action === 'delete' ? 'Пользователь удален!' : 'Пользователь понижен до обычного пользователя!';
            alert(message);
            document.getElementById('demote-user-modal').classList.remove('active');
            loadUsers();
        } else {
            alert(data.error || 'Ошибка выполнения операции');
        }
    } catch (error) {
        console.error('Ошибка выполнения операции:', error);
        alert('Ошибка соединения с сервером');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        form.reset();
    }
}