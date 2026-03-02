// static/js/admin.js

let currentUser = window.templateData.user || {};
let citiesData = window.templateData.cities || {};
let zoneTypes = window.templateData.zone_types || [];
let statuses = window.templateData.statuses || {};

let adminMap = null;
let adminMarker = null;
let editMap = null;
let editMarker = null;

document.addEventListener('DOMContentLoaded', function() {
    loadUsers();
    loadStatistics();

    // Открытие модалки добавления зоны
    document.getElementById('open-add-zone-modal').addEventListener('click', function() {
        document.getElementById('add-zone-admin-modal').classList.add('active');
        setTimeout(initAdminAddZoneMap, 200);
    });

    // Закрытие модалок и очистка карт
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').classList.remove('active');
            if (this.closest('.modal')?.id === 'add-zone-admin-modal' && adminMap) {
                adminMap.remove();
                adminMap = null;
            }
            if (this.closest('.modal')?.id === 'edit-zone-modal' && editMap) {
                editMap.remove();
                editMap = null;
            }
        });
    });

    // Закрытие модалки при клике вне её
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
                if (this.id === 'add-zone-admin-modal' && adminMap) {
                    adminMap.remove();
                    adminMap = null;
                }
                if (this.id === 'edit-zone-modal' && editMap) {
                    editMap.remove();
                    editMap = null;
                }
            }
        });
    });

    // Переключение вкладок админки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
            if (tabId === 'users') loadUsers();
            else if (tabId === 'reports') loadStatistics();
            else if (tabId === 'dictionaries') loadDictionary('cities');
        });
    });

    // Фильтр по зонам
    const zoneSearch = document.getElementById('zone-search');
    if (zoneSearch) zoneSearch.addEventListener('input', () => filterZones(zoneSearch.value));

    const cityFilter = document.getElementById('city-filter');
    const statusFilter = document.getElementById('status-filter');
    if (cityFilter) cityFilter.addEventListener('change', filterZones);
    if (statusFilter) statusFilter.addEventListener('change', filterZones);

    // Валидация полей координат
    const adminZoneLat = document.getElementById('admin-zone-lat');
    const adminZoneLng = document.getElementById('admin-zone-lng');
    if (adminZoneLat) adminZoneLat.addEventListener('input', function() {
        this.value = this.value.replace(/[^\d.-]/g, '');
    });
    if (adminZoneLng) adminZoneLng.addEventListener('input', function() {
        this.value = this.value.replace(/[^\d.-]/g, '');
    });

    // Отправка формы добавления зоны
    const addZoneForm = document.getElementById('add-zone-admin-form');
    if (addZoneForm) addZoneForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitAddZoneForm(e.target);
    });

    // Форма назначения младшим админом
    const promoteJuniorForm = document.getElementById('promote-junior-admin-form');
    if (promoteJuniorForm) promoteJuniorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitPromoteJuniorForm(e.target);
    });

    // Форма назначения модератором
    const promoteModeratorForm = document.getElementById('promote-moderator-form');
    if (promoteModeratorForm) promoteModeratorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitPromoteModeratorForm(e.target);
    });

    // Форма понижения/удаления
    const demoteForm = document.getElementById('demote-user-form');
    if (demoteForm) demoteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitDemoteForm(e.target);
    });

    // Переключение поля пароля при удалении
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

    // Переключение справочников
    document.querySelectorAll('[data-dict]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('[data-dict]').forEach(b => b.classList.remove('active-dict'));
            this.classList.add('active-dict');
            loadDictionary(this.dataset.dict);
        });
    });

    // Восстановление координат из sessionStorage
    if (sessionStorage.getItem('pickedLocation')) {
        try {
            const location = JSON.parse(sessionStorage.getItem('pickedLocation'));
            if (document.getElementById('admin-zone-lat')) {
                document.getElementById('admin-zone-lat').value = location.lat;
                document.getElementById('admin-zone-lng').value = location.lng;
                if (adminMarker) {
                    adminMarker.setLatLng([location.lat, location.lng]);
                    adminMap.setView([location.lat, location.lng], 15);
                }
            }
            sessionStorage.removeItem('pickedLocation');
            sessionStorage.removeItem('adminAddingZone');
            if (document.getElementById('add-zone-admin-modal').classList.contains('active')) {
                alert('Координаты успешно загружены из карты!');
            }
        } catch (e) {
            console.error('Ошибка загрузки координат:', e);
        }
    }
});

// ---------- Карта для добавления зоны (админ) ----------
function initAdminAddZoneMap() {
    const mapContainer = document.getElementById('admin-map-preview');
    if (!mapContainer) return;

    // Удаляем старую карту, если есть
    if (adminMap) {
        adminMap.remove();
        adminMap = null;
    }

    // Получаем текущие значения из полей
    let lat = 53.347996, lng = 83.779836;
    const citySelect = document.getElementById('admin-zone-city');
    const latInput = document.getElementById('admin-zone-lat');
    const lngInput = document.getElementById('admin-zone-lng');

    if (latInput && lngInput && latInput.value && lngInput.value) {
        const parsedLat = parseFloat(latInput.value);
        const parsedLng = parseFloat(lngInput.value);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
            lat = parsedLat;
            lng = parsedLng;
        }
    } else if (citySelect && citySelect.value && citiesData[citySelect.value]) {
        lat = citiesData[citySelect.value].lat;
        lng = citiesData[citySelect.value].lng;
        // Заполняем поля, если они пусты
        if (latInput) latInput.value = lat.toFixed(6);
        if (lngInput) lngInput.value = lng.toFixed(6);
    }

    // Создаём карту
    adminMap = L.map(mapContainer, { zoomControl: false, attributionControl: false }).setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '' }).addTo(adminMap);

    // Создаём перетаскиваемый маркер
    adminMarker = L.marker([lat, lng], { draggable: true }).addTo(adminMap);

    // Обработка перетаскивания маркера
    adminMarker.on('dragend', function(e) {
        const pos = e.target.getLatLng();
        latInput.value = pos.lat.toFixed(6);
        lngInput.value = pos.lng.toFixed(6);
    });

    // Обновление маркера при изменении полей
    if (latInput && lngInput) {
        latInput.addEventListener('input', function() {
            const newLat = parseFloat(this.value);
            const newLng = parseFloat(lngInput.value);
            if (!isNaN(newLat) && !isNaN(newLng) && adminMarker && adminMap) {
                adminMarker.setLatLng([newLat, newLng]);
                adminMap.setView([newLat, newLng], 15);
            }
        });
        lngInput.addEventListener('input', function() {
            const newLat = parseFloat(latInput.value);
            const newLng = parseFloat(this.value);
            if (!isNaN(newLat) && !isNaN(newLng) && adminMarker && adminMap) {
                adminMarker.setLatLng([newLat, newLng]);
                adminMap.setView([newLat, newLng], 15);
            }
        });
    }

    // Центрирование при смене города
    if (citySelect) {
        citySelect.addEventListener('change', function() {
            const city = this.value;
            if (citiesData[city]) {
                const newLat = citiesData[city].lat;
                const newLng = citiesData[city].lng;
                adminMap.setView([newLat, newLng], 13);
                adminMarker.setLatLng([newLat, newLng]);
                latInput.value = newLat.toFixed(6);
                lngInput.value = newLng.toFixed(6);
            }
        });
    }
}

// Обновление маркера по значениям полей ввода
function updateAdminMarkerFromInputs() {
    const lat = parseFloat(document.getElementById('admin-zone-lat').value);
    const lng = parseFloat(document.getElementById('admin-zone-lng').value);
    if (!isNaN(lat) && !isNaN(lng) && adminMarker && adminMap) {
        adminMarker.setLatLng([lat, lng]);
        adminMap.setView([lat, lng], 15);
    }
}

// ---------- Карта для редактирования зоны ----------
function initEditZoneMap(zoneId, lat, lng, city) {
    const mapContainer = document.getElementById(`edit-map-preview-${zoneId}`);
    if (!mapContainer) return;

    // Удаляем старую карту, если есть
    if (editMap) {
        editMap.remove();
        editMap = null;
    }

    editMap = L.map(mapContainer, { zoomControl: false, attributionControl: false }).setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '' }).addTo(editMap);

    // Создаём перетаскиваемый маркер
    editMarker = L.marker([lat, lng], { draggable: true }).addTo(editMap);

    const latInput = document.getElementById(`edit-lat-${zoneId}`);
    const lngInput = document.getElementById(`edit-lng-${zoneId}`);
    const citySelect = document.getElementById(`edit-city-${zoneId}`);

    // Обработка перетаскивания маркера
    editMarker.on('dragend', function(e) {
        const pos = e.target.getLatLng();
        latInput.value = pos.lat.toFixed(6);
        lngInput.value = pos.lng.toFixed(6);
    });

    // Обновление маркера при изменении полей
    if (latInput && lngInput) {
        latInput.addEventListener('input', function() {
            const newLat = parseFloat(this.value);
            const newLng = parseFloat(lngInput.value);
            if (!isNaN(newLat) && !isNaN(newLng) && editMarker && editMap) {
                editMarker.setLatLng([newLat, newLng]);
                editMap.setView([newLat, newLng], 15);
            }
        });
        lngInput.addEventListener('input', function() {
            const newLat = parseFloat(latInput.value);
            const newLng = parseFloat(this.value);
            if (!isNaN(newLat) && !isNaN(newLng) && editMarker && editMap) {
                editMarker.setLatLng([newLat, newLng]);
                editMap.setView([newLat, newLng], 15);
            }
        });
    }

    // Центрирование при смене города
    if (citySelect) {
        citySelect.addEventListener('change', function() {
            const selectedCity = this.value;
            if (citiesData[selectedCity]) {
                const newLat = citiesData[selectedCity].lat;
                const newLng = citiesData[selectedCity].lng;
                editMap.setView([newLat, newLng], 13);
                editMarker.setLatLng([newLat, newLng]);
                latInput.value = newLat.toFixed(6);
                lngInput.value = newLng.toFixed(6);
            }
        });
    }
}

// ---------- Загрузка пользователей ----------
async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) {
            if (response.status === 401) alert('Требуется авторизация');
            throw new Error('Ошибка загрузки');
        }
        const users = await response.json();
        const tbody = document.getElementById('users-tbody');
        const currentUserRole = currentUser.role || 'user';
        if (tbody) {
            tbody.innerHTML = users.map(user => {
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
                let actions = '';
                const isCurrentUser = currentUser.id === user.id;
                if (!isCurrentUser) {
                    if (currentUserRole === 'super_admin') {
                        if (user.role === 'user') {
                            actions = `
                                <button class="btn-promote-junior action-btn"
                                        onclick="promoteToJuniorAdmin(${user.id}, '${user.name}')"
                                        title="Назначить младшим администратором">
                                    <i class="fas fa-user-shield"></i>
                                </button>
                                <button class="btn-promote-moderator action-btn"
                                        onclick="promoteToModerator(${user.id}, '${user.name}')"
                                        title="Назначить модератором">
                                    <i class="fas fa-user-check"></i>
                                </button>
                                <button class="btn-demote action-btn"
                                        onclick="demoteUser(${user.id}, '${user.name}', '${user.role}')"
                                        title="Понизить/удалить">
                                    <i class="fas fa-user-minus"></i>
                                </button>
                            `;
                        } else if (user.role === 'moderator') {
                            actions = `
                                <button class="btn-promote-junior action-btn"
                                        onclick="promoteToJuniorAdmin(${user.id}, '${user.name}')"
                                        title="Назначить младшим администратором">
                                    <i class="fas fa-user-shield"></i>
                                </button>
                                <button class="btn-demote action-btn"
                                        onclick="demoteUser(${user.id}, '${user.name}', '${user.role}')"
                                        title="Понизить/удалить">
                                    <i class="fas fa-user-minus"></i>
                                </button>
                            `;
                        } else if (user.role === 'junior_admin') {
                            actions = `<button class="btn-demote action-btn"
                                        onclick="demoteUser(${user.id}, '${user.name}', '${user.role}')"
                                        title="Понизить/удалить">
                                        <i class="fas fa-user-minus"></i>
                                    </button>`;
                        }
                    } else if (currentUserRole === 'junior_admin') {
                        if (user.role === 'user') {
                            actions = `<button class="btn-promote-moderator action-btn"
                                        onclick="promoteToModerator(${user.id}, '${user.name}')"
                                        title="Назначить модератором">
                                        <i class="fas fa-user-check"></i>
                                    </button>`;
                        } else if (user.role === 'moderator') {
                            actions = `<button class="btn-demote action-btn"
                                        onclick="demoteUser(${user.id}, '${user.name}', '${user.role}')"
                                        title="Понизить">
                                        <i class="fas fa-user-minus"></i>
                                    </button>`;
                        }
                    }
                }
                return `
                    <tr id="user-row-${user.id}">
                        <td>${user.id}</td>
                        <td><strong>${user.name}</strong>
                            ${isCurrentUser ? '<span style="color:#666;font-size:0.8rem;margin-left:0.5rem;">(Вы)</span>' : ''}
                        </td>
                        <td>${user.email}</td>
                        <td>${roleBadge}</td>
                        <td>${user.city || 'Не указан'}</td>
                        <td>${user.created_at ? user.created_at.slice(0,10) : ''}</td>
                        <td class="actions-cell"><div class="actions-inline">${actions}</div></td>
                    </tr>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        document.getElementById('users-tbody').innerHTML = '<tr><td colspan="7" style="text-align:center;color:#f44336;padding:2rem;">Ошибка загрузки данных</td></tr>';
    }
}

// Открытие модалки назначения младшим админом
function promoteToJuniorAdmin(userId, userName) {
    document.getElementById('promote-junior-user-id').value = userId;
    document.getElementById('promote-junior-user-name').value = userName;
    document.getElementById('promote-junior-admin-modal').classList.add('active');
}

// Открытие модалки назначения модератором
function promoteToModerator(userId, userName) {
    document.getElementById('promote-user-id').value = userId;
    document.getElementById('promote-user-name').value = userName;
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

// Открытие модалки понижения/удаления
function demoteUser(userId, userName, userRole) {
    document.getElementById('demote-user-id').value = userId;
    document.getElementById('demote-user-name').value = userName;
    document.getElementById('demote-user-role').value = userRole;
    document.getElementById('admin-password-group').style.display = 'none';
    document.getElementById('delete-admin-password').required = false;
    document.getElementById('confirm-demote').value = '';
    document.getElementById('demote-user-modal').classList.add('active');
}

// ---------- Загрузка статистики ----------
async function loadStatistics() {
    try {
        const response = await fetch('/api/admin/statistics');
        const stats = await response.json();
        document.getElementById('system-stats').innerHTML = `
            <div class="stat-item"><strong>Всего зон:</strong> ${stats.total_zones}</div>
            <div class="stat-item"><strong>Всего пользователей:</strong> ${stats.total_users}</div>
            <div class="stat-item"><strong>Всего отчётов:</strong> ${stats.total_reports}</div>
            <div class="stat-item"><strong>Активных проблем:</strong> ${stats.active_problems}</div>
            <div class="stat-item"><strong>Выполненных работ:</strong> ${stats.completed_maintenance}</div>
        `;
        const activeProblems = document.getElementById('active-problems');
        if (stats.problems_by_type && stats.problems_by_type.length) {
            activeProblems.innerHTML = stats.problems_by_type.map(p =>
                `<div class="problem-item"><strong>${p.problem_type}:</strong> ${p.count} проблем</div>`
            ).join('');
        } else activeProblems.innerHTML = '<p>Нет активных проблем</p>';
        const cityStats = document.getElementById('city-stats');
        if (cityStats && stats.zones_by_city) {
            cityStats.innerHTML = Object.entries(stats.zones_by_city).map(([city,count]) =>
                `<div class="city-stat"><strong>${city}:</strong> ${count} зон</div>`
            ).join('');
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// ---------- Фильтрация зон ----------
function filterZones() {
    const searchTerm = document.getElementById('zone-search')?.value.toLowerCase() || '';
    const city = document.getElementById('city-filter')?.value || '';
    const status = document.getElementById('status-filter')?.value || '';
    document.querySelectorAll('#zones-tab tbody tr').forEach(row => {
        const name = row.cells[1].textContent.toLowerCase();
        const rowCity = row.cells[2].textContent;
        const rowStatus = row.cells[4].textContent.trim();
        row.style.display = (name.includes(searchTerm) && (!city || rowCity === city) && (!status || rowStatus === status)) ? '' : 'none';
    });
}

// ---------- Просмотр деталей заявки ----------
async function viewRequestDetails(requestId) {
    try {
        const response = await fetch(`/api/admin/request/${requestId}`);
        const request = await response.json();
        document.getElementById('request-details').innerHTML = `
            <div class="request-details">
                <h3>${request.name}</h3>
                <div class="details-grid">
                    <div><strong>Город:</strong> ${request.city}</div>
                    <div><strong>Тип зоны:</strong> ${request.type}</div>
                    <div><strong>Координаты:</strong> ${request.lat}, ${request.lng}</div>
                    <div><strong>Дата подачи:</strong> ${request.created_at}</div>
                    <div><strong>Пользователь:</strong> ${request.user_name} (${request.user_email})</div>
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
        document.getElementById('request-modal').classList.add('active');
    } catch (error) {
        console.error('Ошибка загрузки заявки:', error);
        alert('Ошибка загрузки данных');
    }
}


// Принятие заявки
async function approveRequest(requestId) {
    if (!confirm('Вы уверены?')) return;
    try {
        const response = await fetch(`/api/admin/approve-zone/${requestId}`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            alert('Заявка принята!');
            location.reload();
        } else alert(data.error || 'Ошибка');
    } catch (error) {
        console.error('Ошибка принятия:', error);
        alert('Ошибка соединения');
    }
}

// Отклонение заявки
async function rejectRequest(requestId) {
    const reason = prompt('Причина отклонения:');
    if (reason === null) return;
    try {
        const response = await fetch(`/api/admin/reject-zone/${requestId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        const data = await response.json();
        if (data.success) {
            alert('Заявка отклонена!');
            location.reload();
        } else alert(data.error || 'Ошибка');
    } catch (error) {
        console.error('Ошибка отклонения:', error);
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
        window.open(`/?city=${encodeURIComponent(zone.city)}&lat=${zone.lat}&lng=${zone.lng}&zoom=16&highlight=${zoneId}`, '_blank');
    } catch (error) {
        console.error('Ошибка загрузки зоны:', error);
        alert('Ошибка загрузки');
    }
}

// ---------- Редактирование зоны с картой ----------
async function editZone(zoneId) {
    try {
        const response = await fetch(`/api/admin/zone/${zoneId}`);
        const zone = await response.json();
        if (zone.error) {
            alert(zone.error);
            return;
        }

        const escapeHtml = (str) => {
            if (!str) return '';
            return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
        };

        const formHtml = `
            <form id="edit-zone-form-${zoneId}">
                <div class="form-row">
                    <div class="form-group">
                        <label for="edit-name-${zoneId}">Название зоны *</label>
                        <input type="text" id="edit-name-${zoneId}" value="${escapeHtml(zone.name)}" required class="admin-form-input">
                    </div>
                    <div class="form-group">
                        <label for="edit-city-${zoneId}">Город *</label>
                        <select id="edit-city-${zoneId}" required class="admin-form-input">
                            ${Object.keys(citiesData).map(city =>
                                `<option value="${city}" ${zone.city === city ? 'selected' : ''}>${city}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="edit-type-${zoneId}">Тип зоны *</label>
                        <select id="edit-type-${zoneId}" required class="admin-form-input">
                            ${zoneTypes.map(type =>
                                `<option value="${type}" ${zone.type === type ? 'selected' : ''}>${type}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-status-${zoneId}">Статус *</label>
                        <select id="edit-status-${zoneId}" required class="admin-form-input">
                            ${Object.keys(statuses).map(status =>
                                `<option value="${status}" ${zone.status === status ? 'selected' : ''}>${status}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="edit-lat-${zoneId}">Широта *</label>
                        <input type="text" id="edit-lat-${zoneId}" value="${zone.lat}" required
                               pattern="-?\\d+(\\.\\d+)?" title="Только цифры и точка" class="admin-form-input">
                    </div>
                    <div class="form-group">
                        <label for="edit-lng-${zoneId}">Долгота *</label>
                        <input type="text" id="edit-lng-${zoneId}" value="${zone.lng}" required
                               pattern="-?\\d+(\\.\\d+)?" title="Только цифры и точка" class="admin-form-input">
                    </div>
                </div>

                <!-- Новый блок: количество проблем и кнопка синхронизации статуса -->
                <div class="form-row">
                    <div class="form-group">
                        <label for="edit-problems-count-${zoneId}">Количество активных проблем</label>
                        <input type="number" id="edit-problems-count-${zoneId}" value="${zone.problems_count}" min="0" class="admin-form-input">
                    </div>
                    <div class="form-group" style="display: flex; align-items: flex-end;">
                        <button type="button" class="btn btn-outline" id="sync-status-btn-${zoneId}" style="margin-bottom: 0.75rem;">
                            <i class="fas fa-sync-alt"></i> Синхронизировать статус
                        </button>
                    </div>
                </div>

                <div class="map-preview-container">
                    <h4>Выберите местоположение на карте</h4>
                    <div class="map-preview" id="edit-map-preview-${zoneId}" style="height: 300px; margin-bottom: 1rem;"></div>
                    <small class="hint">Перетащите маркер для точного позиционирования</small>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Сохранить изменения</button>
                </div>
            </form>
        `;
        document.getElementById('edit-zone-form-container').innerHTML = formHtml;
        document.getElementById('edit-zone-modal').classList.add('active');

        const latInput = document.getElementById(`edit-lat-${zoneId}`);
        const lngInput = document.getElementById(`edit-lng-${zoneId}`);
        latInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^\d.-]/g, '');
        });
        lngInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^\d.-]/g, '');
        });

        setTimeout(() => initEditZoneMap(zoneId, zone.lat, zone.lng, zone.city), 200);

        // Обработчик кнопки синхронизации статуса
        document.getElementById(`sync-status-btn-${zoneId}`).addEventListener('click', async function() {
            const btn = this;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Синхронизация...';

            try {
                const newCount = document.getElementById(`edit-problems-count-${zoneId}`).value;
                const response = await fetch(`/api/admin/zone/${zoneId}/sync-status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ problems_count: parseInt(newCount) })
                });
                const data = await response.json();

                if (data.success) {
                    // Обновить выпадающий список статуса
                    const statusSelect = document.getElementById(`edit-status-${zoneId}`);
                    if (statusSelect) {
                        statusSelect.value = data.new_status;
                    }

                    // Обновить строку в таблице зон (если открыта вкладка «Все зоны»)
                    const row = document.getElementById(`zone-row-${zoneId}`);
                    if (row) {
                        const statusCell = row.querySelector('td:nth-child(5)'); // колонка статуса
                        if (statusCell) {
                            const badge = statusCell.querySelector('.status-badge');
                            if (badge) {
                                badge.textContent = data.new_status;
                                if (window.templateData?.statuses?.[data.new_status]) {
                                    badge.style.backgroundColor = window.templateData.statuses[data.new_status].color;
                                }
                            }
                        }
                    }

                    alert('Статус синхронизирован с текущими проблемами');
                } else {
                    alert(data.error || 'Ошибка синхронизации');
                }
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Ошибка соединения');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sync-alt"></i> Синхронизировать статус';
            }
        });

        document.getElementById(`edit-zone-form-${zoneId}`).addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateZone(zoneId);
        });
    } catch (error) {
        console.error('Ошибка загрузки зоны:', error);
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
        lng: document.getElementById(`edit-lng-${zoneId}`).value
    };
    let latStr = formData.lat.toString().trim().replace(/,/g, '.').replace(/[^\d.-]/g, '');
    let lngStr = formData.lng.toString().trim().replace(/,/g, '.').replace(/[^\d.-]/g, '');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (isNaN(lat) || lat < -90 || lat > 90) {
        alert('Некорректная широта');
        return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
        alert('Некорректная долгота');
        return;
    }
    formData.lat = lat;
    formData.lng = lng;
    if (!formData.name || !formData.city || !formData.type || !formData.status) {
        alert('Заполните все поля');
        return;
    }
    try {
        const response = await fetch(`/api/admin/zone/${zoneId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await response.json();
        if (data.success) {
            alert('Зона обновлена!');
            document.getElementById('edit-zone-modal').classList.remove('active');
            location.reload();
        } else {
            alert(data.error || 'Ошибка');
            console.error(data);
        }
    } catch (error) {
        console.error('Ошибка обновления:', error);
        alert('Ошибка соединения');
    }
}

// Удаление зоны
async function deleteZone(zoneId) {
    if (!confirm('Удалить зону? Все связанные данные будут удалены.')) return;
    try {
        const response = await fetch(`/api/admin/zone/${zoneId}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
            alert('Зона удалена!');
            document.getElementById(`zone-row-${zoneId}`)?.remove();
            updateZoneStats();
        } else alert(data.error || 'Ошибка');
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка соединения');
    }
}

// Обновление счётчика зон в статистике
function updateZoneStats() {
    const zoneCount = document.querySelectorAll('#zones-tab tbody tr').length;
    const statCard = document.querySelector('.stat-card:nth-child(2) .stat-value');
    if (statCard) statCard.textContent = zoneCount;
}

// Генерация системного отчёта
function generateSystemReport() {
    const report = {
        title: 'Системный отчет ЭКОПУЛЬС',
        date: new Date().toLocaleDateString('ru-RU'),
        data: {}
    };
    const blob = new Blob([JSON.stringify(report,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ecopulse_report_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ---------- Загрузка справочника ----------
async function loadDictionary(dictType) {
    try {
        const response = await fetch(`/api/dictionaries/${dictType}`);
        let data = await response.json();
        const container = document.getElementById('dictionary-content');
        if (!data.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-database"></i><h3>Справочник пуст</h3><p>Данные не найдены</p></div>';
            return;
        }
        let headers = [], tableRows = '';
        switch(dictType) {
            case 'cities':
                headers = ['№','Название','Широта','Долгота','Зум','Статус','Действия'];
                tableRows = data.map((item,i) => `
                    <tr data-id="${item.id}" data-active="${item.is_active}">
                        <td>${i+1}</td>
                        <td>${item.name}</td>
                        <td>${item.lat}</td>
                        <td>${item.lng}</td>
                        <td>${item.zoom}</td>
                        <td><span class="status-badge ${item.is_active?'active':'inactive'}">${item.is_active?'Активен':'Неактивен'}</span></td>
                        <td class="actions-cell"><div class="actions-inline">
                            <button class="btn-edit action-btn" onclick="editDictionaryItem('${dictType}',${item.id})"><i class="fas fa-edit"></i></button>
                            <button class="btn-toggle action-btn" onclick="toggleDictionaryItemActive('${dictType}',${item.id},${item.is_active})" title="${item.is_active?'Деактивировать':'Активировать'}"><i class="fas ${item.is_active?'fa-ban':'fa-check'}"></i></button>
                            <button class="btn-delete-hard action-btn" onclick="deleteDictionaryItem('${dictType}',${item.id},'${item.name}')" title="Полностью удалить"><i class="fas fa-trash-alt"></i></button>
                        </div></td>
                    </tr>
                `).join('');
                break;
            case 'zone_types':
                headers = ['№', 'Название', 'Статус', 'Действия'];
                tableRows = data.map((item, i) => `
                    <tr data-id="${item.id}" data-active="${item.is_active}">
                        <td>${i + 1}</td>
                        <td>${item.name} ${item.icon ? `<span style="font-size:1.2rem;margin-left:0.5rem;">${item.icon}</span>` : ''}</td>
                        <td><span class="status-badge ${item.is_active ? 'active' : 'inactive'}">${item.is_active ? 'Активен' : 'Неактивен'}</span></td>
                        <td class="actions-cell"><div class="actions-inline">
                            <button class="btn-edit action-btn" onclick="editDictionaryItem('${dictType}',${item.id})"><i class="fas fa-edit"></i></button>
                            <button class="btn-toggle action-btn" onclick="toggleDictionaryItemActive('${dictType}',${item.id},${item.is_active})" title="${item.is_active ? 'Деактивировать' : 'Активировать'}"><i class="fas ${item.is_active ? 'fa-ban' : 'fa-check'}"></i></button>
                            <button class="btn-delete-hard action-btn" onclick="deleteDictionaryItem('${dictType}',${item.id},'${item.name}')" title="Полностью удалить"><i class="fas fa-trash-alt"></i></button>
                        </div></td>
                    </tr>
                `).join('');
                break;
            case 'statuses':
                data.sort((a, b) => b.priority - a.priority);
                headers = ['№','Название','Цвет','Иконка','Приоритет','Статус','Действия'];
                tableRows = data.map((item,i) => {
                    const isDefault = item.is_default === 1;
                    return `
                    <tr data-id="${item.id}" data-active="${item.is_active}" data-priority="${item.priority}">
                        <td>${i+1}</td>
                        <td>${item.name}</td>
                        <td><span class="color-preview" style="background-color:${item.color}"></span> ${item.color}</td>
                        <td>${item.icon || '—'}</td>
                        <td>${item.priority}</td>
                        <td><span class="status-badge ${item.is_active?'active':'inactive'}">${item.is_active?'Активен':'Неактивен'}</span></td>
                        <td class="actions-cell"><div class="actions-inline">
                            <button class="btn-edit action-btn" onclick="editDictionaryItem('${dictType}',${item.id})"><i class="fas fa-edit"></i></button>
                            ${!isDefault ? `<button class="btn-toggle action-btn" onclick="toggleDictionaryItemActive('${dictType}',${item.id},${item.is_active})" title="${item.is_active?'Деактивировать':'Активировать'}"><i class="fas ${item.is_active?'fa-ban':'fa-check'}"></i></button>` : ''}
                            ${!isDefault ? `<button class="btn-delete-hard action-btn" onclick="deleteDictionaryItem('${dictType}',${item.id},'${item.name}')" title="Полностью удалить"><i class="fas fa-trash-alt"></i></button>` : ''}
                        </div></td>
                    </tr>
                `}).join('');
                break;
            case 'problem_types':
                headers = ['№', 'Название', 'Статус', 'Действия'];
                tableRows = data.map((item, i) => `
                    <tr data-id="${item.id}" data-active="${item.is_active}">
                        <td>${i + 1}</td>
                        <td>${item.name}</td>
                        <td><span class="status-badge ${item.is_active ? 'active' : 'inactive'}">${item.is_active ? 'Активен' : 'Неактивен'}</span></td>
                        <td class="actions-cell"><div class="actions-inline">
                            <button class="btn-edit action-btn" onclick="editDictionaryItem('${dictType}',${item.id})"><i class="fas fa-edit"></i></button>
                            <button class="btn-toggle action-btn" onclick="toggleDictionaryItemActive('${dictType}',${item.id},${item.is_active})" title="${item.is_active ? 'Деактивировать' : 'Активировать'}"><i class="fas ${item.is_active ? 'fa-ban' : 'fa-check'}"></i></button>
                            <button class="btn-delete-hard action-btn" onclick="deleteDictionaryItem('${dictType}',${item.id},'${item.name}')" title="Полностью удалить"><i class="fas fa-trash-alt"></i></button>
                        </div></td>
                    </tr>
                `).join('');
                break;
        }
        container.innerHTML = `
            <div class="dictionary-filters">
                <select id="dictionary-status-filter" onchange="filterDictionaryTable('${dictType}')">
                    <option value="all">Все статусы</option>
                    <option value="active">Только активные</option>
                    <option value="inactive">Только неактивные</option>
                </select>
                <div class="sort-buttons">
                    <button class="btn btn-outline" onclick="sortDictionaryTable('${dictType}','id')"><i class="fas fa-sort-numeric-down"></i> По номеру</button>
                    ${dictType === 'statuses'
                        ? `<button class="btn btn-outline" onclick="sortDictionaryTable('${dictType}','priority')"><i class="fas fa-sort-amount-down"></i> По приоритету</button>`
                        : `<button class="btn btn-outline" onclick="sortDictionaryTable('${dictType}','name')"><i class="fas fa-sort-alpha-down"></i> По алфавиту</button>`
                    }
                    <button class="btn btn-outline" onclick="sortDictionaryTable('${dictType}','status')"><i class="fas fa-sort"></i> По статусу</button>
                </div>
                <button class="btn btn-primary" onclick="addDictionaryItem('${dictType}')"><i class="fas fa-plus"></i> Добавить</button>
            </div>
            <table class="dictionary-table" id="${dictType}-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>
        `;
    } catch (error) {
        console.error('Ошибка загрузки справочника:', error);
    }
}

// Возврат заголовка справочника
function getDictionaryTitle(dictType) {
    const titles = {
        'cities':'Города',
        'zone_types':'Типы зон',
        'statuses':'Статусы зон',
        'problem_types':'Типы проблем'
    };
    return titles[dictType] || dictType;
}

// ---------- Добавление/редактирование элементов справочника ----------
function addDictionaryItem(dictType) {
    let formHtml = '';
    const title = getDictionaryTitle(dictType);
    switch(dictType) {
        case 'cities':
            formHtml = `<form id="add-dictionary-form">
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
            </form>`;
            break;
        case 'zone_types':
            formHtml = `<form id="add-dictionary-form">
                <div class="form-group">
                    <label for="dict-name">Название *</label>
                    <input type="text" id="dict-name" required class="admin-form-input">
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
            </form>`;
            break;
        case 'statuses':
            formHtml = `<form id="add-dictionary-form">
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
            </form>`;
            break;
        default:
            formHtml = `<form id="add-dictionary-form">
                <div class="form-group">
                    <label for="dict-name">Название *</label>
                    <input type="text" id="dict-name" required class="admin-form-input">
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
            </form>`;
            break;
    }
    document.getElementById('dictionary-modal-title').textContent = `Добавить в справочник: ${title}`;
    document.getElementById('dictionary-modal-content').innerHTML = formHtml;
    document.getElementById('dictionary-modal').classList.add('active');
    document.getElementById('add-dictionary-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveDictionaryItem(dictType, null);
    });
}

// Редактирование элемента справочника
async function editDictionaryItem(dictType, itemId) {
    try {
        const response = await fetch(`/api/dictionaries/${dictType}`);
        let data = await response.json();
        const item = data.find(i => i.id === itemId);
        if (!item) {
            alert('Элемент не найден');
            return;
        }
        const title = getDictionaryTitle(dictType);
        const escapeHtml = (str) => {
            if (!str) return '';
            return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
        };
        let formHtml = '';
        switch(dictType) {
            case 'cities':
                formHtml = `<form id="edit-dictionary-form">
                    <div class="form-group">
                        <label for="dict-name">Название города *</label>
                        <input type="text" id="dict-name" value="${escapeHtml(item.name)}" required class="admin-form-input">
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
                            <option value="1" ${item.is_active?'selected':''}>Активен</option>
                            <option value="0" ${!item.is_active?'selected':''}>Неактивен</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Сохранить</button>
                    </div>
                </form>`;
                break;
            case 'zone_types':
                formHtml = `<form id="edit-dictionary-form">
                    <div class="form-group">
                        <label for="dict-name">Название *</label>
                        <input type="text" id="dict-name" value="${escapeHtml(item.name)}" required class="admin-form-input">
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
                </form>`;
                break;
            case 'statuses':
                formHtml = `<form id="edit-dictionary-form">
                    <div class="form-group">
                        <label for="dict-name">Название статуса *</label>
                        <input type="text" id="dict-name" value="${escapeHtml(item.name)}" required class="admin-form-input">
                    </div>
                    <div class="form-group">
                        <label for="dict-color">Цвет *</label>
                        <input type="color" id="dict-color" value="${item.color}" required class="admin-form-input">
                    </div>
                    <div class="form-group">
                        <label for="dict-icon">Иконка (emoji)</label>
                        <input type="text" id="dict-icon" value="${escapeHtml(item.icon||'')}" placeholder="🟢" class="admin-form-input">
                    </div>
                    <div class="form-group">
                        <label for="dict-priority">Приоритет (1-5)</label>
                        <input type="number" id="dict-priority" value="${item.priority}" min="1" max="5" class="admin-form-input">
                    </div>
                    <div class="form-group">
                        <label for="dict-active">Статус</label>
                        <select id="dict-active" class="admin-form-input">
                            <option value="1" ${item.is_active?'selected':''}>Активен</option>
                            <option value="0" ${!item.is_active?'selected':''}>Неактивен</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Сохранить</button>
                    </div>
                </form>`;
                break;
            default:
                formHtml = `<form id="edit-dictionary-form">
                    <div class="form-group">
                        <label for="dict-name">Название *</label>
                        <input type="text" id="dict-name" value="${escapeHtml(item.name)}" required class="admin-form-input">
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
                </form>`;
                break;
        }
        document.getElementById('dictionary-modal-title').textContent = `Редактирование: ${title}`;
        document.getElementById('dictionary-modal-content').innerHTML = formHtml;
        document.getElementById('dictionary-modal').classList.add('active');
        document.getElementById('edit-dictionary-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveDictionaryItem(dictType, itemId);
        });
    } catch (error) {
        console.error('Ошибка загрузки элемента:', error);
        alert('Ошибка загрузки данных');
    }
}

// Сохранение элемента справочника
async function saveDictionaryItem(dictType, itemId) {
    const form = document.getElementById(itemId ? 'edit-dictionary-form' : 'add-dictionary-form');
    let data = {};
    if (dictType === 'cities') {
        data = {
            name: document.getElementById('dict-name').value,
            lat: parseFloat(document.getElementById('dict-lat').value),
            lng: parseFloat(document.getElementById('dict-lng').value),
            zoom: parseInt(document.getElementById('dict-zoom').value),
            is_active: parseInt(document.getElementById('dict-active').value)
        };
    } else if (dictType === 'zone_types') {
        data = {
            name: document.getElementById('dict-name').value,
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
            is_active: parseInt(document.getElementById('dict-active').value)
        };
    }
    try {
        const url = itemId ? `/api/admin/dictionaries/${dictType}/${itemId}` : `/api/admin/dictionaries/${dictType}`;
        const method = itemId ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
            alert(result.message);
            document.getElementById('dictionary-modal').classList.remove('active');
            loadDictionary(dictType);
        } else alert(result.error || 'Ошибка сохранения');
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка соединения');
    }
}

// Переключение активности элемента справочника
async function toggleDictionaryItemActive(dictType, itemId, currentActive) {
    if (!confirm(`Вы уверены, что хотите ${currentActive ? 'деактивировать' : 'активировать'} элемент?`)) return;
    try {
        const response = await fetch(`/api/admin/dictionaries/${dictType}/${itemId}/toggle`, { method: 'POST' });
        const result = await response.json();
        if (result.success) {
            alert(result.message);
            loadDictionary(dictType);
        } else alert(result.error || 'Ошибка');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка соединения');
    }
}

// Полное удаление элемента справочника
async function deleteDictionaryItem(dictType, itemId, itemName) {
    if (!confirm(`Полностью удалить элемент "${itemName}"? Это действие нельзя отменить!`)) return;
    try {
        const response = await fetch(`/api/admin/dictionaries/${dictType}/${itemId}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
            alert(result.message);
            loadDictionary(dictType);
        } else alert(result.error || 'Ошибка удаления');
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка соединения');
    }
}

// Фильтрация таблицы справочника по статусу
function filterDictionaryTable(dictType) {
    const filter = document.getElementById('dictionary-status-filter').value;
    const table = document.getElementById(`${dictType}-table`);
    if (!table) return;
    table.querySelectorAll('tbody tr').forEach(row => {
        const active = row.getAttribute('data-active') === '1';
        if (filter === 'all') row.style.display = '';
        else if (filter === 'active') row.style.display = active ? '' : 'none';
        else row.style.display = active ? 'none' : '';
    });
}

// Сортировка таблицы справочника
function sortDictionaryTable(dictType, sortBy) {
    const table = document.getElementById(`${dictType}-table`);
    if (!table) return;
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort((a,b) => {
        const aActive = a.getAttribute('data-active') === '1';
        const bActive = b.getAttribute('data-active') === '1';
        const aName = a.cells[1].textContent;
        const bName = b.cells[1].textContent;
        const aId = parseInt(a.cells[0].textContent);
        const bId = parseInt(b.cells[0].textContent);

        if (sortBy === 'status') {
            if (aActive === bActive) return aName.localeCompare(bName, 'ru');
            return aActive ? -1 : 1;
        } else if (sortBy === 'priority') {
            const aPriority = parseInt(a.getAttribute('data-priority') || 0);
            const bPriority = parseInt(b.getAttribute('data-priority') || 0);
            if (aPriority === bPriority) return aName.localeCompare(bName, 'ru');
            return bPriority - aPriority;
        } else if (sortBy === 'name') {
            return aName.localeCompare(bName, 'ru');
        } else {
            return aId - bId;
        }
    });
    rows.forEach(row => tbody.appendChild(row));
}

// ---------- Отправка формы добавления зоны админом ----------

async function submitAddZoneForm(form) {
    const formData = {
        name: document.getElementById('admin-zone-name').value,
        city: document.getElementById('admin-zone-city').value,
        type: document.getElementById('admin-zone-type').value,
        status: document.getElementById('admin-zone-status').value,
        lat: document.getElementById('admin-zone-lat').value,
        lng: document.getElementById('admin-zone-lng').value
    };
    const lat = parseFloat(formData.lat.replace(',', '.'));
    const lng = parseFloat(formData.lng.replace(',', '.'));
    if (isNaN(lat) || lat < -90 || lat > 90) {
        alert('Некорректная широта');
        return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
        alert('Некорректная долгота');
        return;
    }
    formData.lat = lat;
    formData.lng = lng;
    if (!formData.name || !formData.city || !formData.type) {
        alert('Заполните все обязательные поля');
        return;
    }
    const btn = form.querySelector('button[type="submit"]');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Добавление...';
    btn.disabled = true;
    try {
        const response = await fetch('/api/admin/add-zone', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(formData)
        });
        const data = await response.json();
        if (data.success) {
            alert(`Зона добавлена! ID: ${data.zone_id}`);
            document.getElementById('add-zone-admin-modal').classList.remove('active');
            form.reset();
            if (adminMap) {
                adminMap.remove();
                adminMap = null;
            }
            setTimeout(() => location.reload(), 1000);
        } else alert(data.error || 'Ошибка');
    } catch (error) {
        console.error('Ошибка добавления:', error);
        alert('Ошибка соединения');
    } finally {
        btn.innerHTML = original;
        btn.disabled = false;
    }
}

// ---------- Отправка форм назначения/понижения ----------
async function submitPromoteJuniorForm(form) {
    const userId = document.getElementById('promote-junior-user-id').value;
    const adminPassword = document.getElementById('super-admin-password').value;
    if (!adminPassword) {
        alert('Введите пароль');
        return;
    }
    const btn = form.querySelector('button[type="submit"]');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Назначение...';
    btn.disabled = true;
    try {
        const response = await fetch(`/api/admin/promote-junior-admin/${userId}`, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ admin_password: adminPassword })
        });
        const data = await response.json();
        if (data.success) {
            alert('Назначен младшим администратором');
            document.getElementById('promote-junior-admin-modal').classList.remove('active');
            loadUsers();
        } else alert(data.error || 'Ошибка');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка соединения');
    } finally {
        btn.innerHTML = original;
        btn.disabled = false;
        form.reset();
    }
}

async function submitPromoteModeratorForm(form) {
    const userId = document.getElementById('promote-user-id').value;
    let adminPassword = '';
    if (currentUser.role === 'super_admin') {
        adminPassword = document.getElementById('admin-password').value;
        if (!adminPassword) {
            alert('Введите пароль');
            return;
        }
    }
    const btn = form.querySelector('button[type="submit"]');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Назначение...';
    btn.disabled = true;
    try {
        const response = await fetch(`/api/admin/promote-moderator/${userId}`, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ admin_password: adminPassword })
        });
        const data = await response.json();
        if (data.success) {
            alert('Назначен модератором');
            document.getElementById('promote-moderator-modal').classList.remove('active');
            loadUsers();
        } else alert(data.error || 'Ошибка');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка соединения');
    } finally {
        btn.innerHTML = original;
        btn.disabled = false;
        form.reset();
    }
}

async function submitDemoteForm(form) {
    const userId = document.getElementById('demote-user-id').value;
    const action = document.getElementById('confirm-demote').value;
    if (!action) {
        alert('Выберите действие');
        return;
    }
    let adminPassword = '';
    if (action === 'delete') {
        adminPassword = document.getElementById('delete-admin-password').value;
        if (!adminPassword) {
            alert('Введите пароль');
            return;
        }
    }
    const btn = form.querySelector('button[type="submit"]');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обработка...';
    btn.disabled = true;
    try {
        let response;
        if (action === 'delete') {
            response = await fetch(`/api/admin/delete-user/${userId}`, {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({ admin_password: adminPassword })
            });
        } else {
            response = await fetch(`/api/admin/demote-user/${userId}`, {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({})
            });
        }
        const data = await response.json();
        if (data.success) {
            const msg = action === 'delete' ? 'Пользователь удалён' : 'Пользователь понижен';
            alert(msg);
            document.getElementById('demote-user-modal').classList.remove('active');
            loadUsers();
        } else alert(data.error || 'Ошибка');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка соединения');
    } finally {
        btn.innerHTML = original;
        btn.disabled = false;
        form.reset();
    }
}