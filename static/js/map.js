// static/js/map.js

let map;
let currentMarkers = [];
let currentCity = 'Барнаул';
let currentFilters = { status: 'all', type: 'all' };
let locationPickerActive = false;
let currentChart = null;
let adminMode = false;
let selectedLocation = null;
let locationMarker = null;

// Инициализация карты
function initMap() {
    const city = document.getElementById('city-select')?.value || 'Барнаул';
    currentCity = city;

    adminMode = window.isAdminMode === 'true';

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('pick_location') === 'true') {
        locationPickerActive = true;
        alert('Кликните на карте, чтобы выбрать координаты. После выбора вернитесь к форме.');
    }

    const cityData = window.citiesData ? window.citiesData[city] : { lat: 53.347996, lng: 83.779836, zoom: 12 };

    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([cityData.lat, cityData.lng], cityData.zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: ''
    }).addTo(map);

    loadZones();

    map.on('moveend', function() {
        if (!locationPickerActive && !adminMode) {
            loadZones();
        }
    });

    map.on('click', function(e) {
        if (locationPickerActive) {
            handleLocationPick(e.latlng);
        } else if (adminMode) {
            selectLocationForAdmin(e.latlng);
        }
    });
}

// Загрузка зон с сервера
async function loadZones() {
    try {
        const response = await fetch(`/api/zones?city=${encodeURIComponent(currentCity)}`);
        const zones = await response.json();

        updateMarkers(zones);
        updateStatistics(zones);
    } catch (error) {
        console.error('Ошибка загрузки зон:', error);
    }
}

// Обновление маркеров на карте
function updateMarkers(zones) {
    currentMarkers.forEach(marker => map.removeLayer(marker));
    currentMarkers = [];

    const filteredZones = zones.filter(zone => {
        if (currentFilters.status !== 'all' && zone.status !== currentFilters.status) return false;
        if (currentFilters.type !== 'all' && zone.type !== currentFilters.type) return false;
        return true;
    });

    filteredZones.forEach(zone => {
        const marker = createMarker(zone);
        marker.addTo(map);
        currentMarkers.push(marker);
    });
}

// Создание маркера для зоны
function createMarker(zone) {
    const statusColors = {
        'Отличный': '#4caf50',
        'Хороший': '#8bc34a',
        'Удовлетворительный': '#ffeb3b',
        'Требует ухода': '#ff9800',
        'Критический': '#f44336'
    };

    const typeIcons = {
        'Парк': '🏞️',
        'Сквер': '🌳',
        'Газон': '🌿',
        'Сад': '🏵️',
        'Лесопарк': '🌲',
        'Бульвар': '🌴',
        'Аллея': '🍃',
        'Спортивная площадка': '⚽',
        'Детская площадка': '🛝',
        'Площадь': '🏛️'
    };

    const icon = L.divIcon({
        className: 'custom-marker',
        html: `
            <div style="
                background-color: ${statusColors[zone.status] || '#4caf50'};
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                color: white;
                font-size: 18px;
                border: 3px solid white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                cursor: pointer;
            ">
                ${typeIcons[zone.type] || '📍'}
            </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });

    const marker = L.marker([zone.lat, zone.lng], { icon: icon });

    const popupContent = `
    <div class="popup-content" style="min-width: 250px;">
        <h3 style="margin: 0 0 10px 0; color: #1b5e20;">${zone.name}</h3>
        <div style="margin-bottom: 10px;">
            <strong>Тип:</strong> ${zone.type}<br>
            <strong>Статус:</strong> <span style="color: ${statusColors[zone.status]}">${zone.status}</span><br>
            ${zone.problems_count > 0 ? `<strong>Активных проблем:</strong> ${zone.problems_count}<br>` : ''}
        </div>
        <p style="margin: 10px 0; font-size: 14px; color: #666;">${zone.description || ''}</p>
        <div style="margin-top: 15px;">
            <button onclick="reportProblem(${zone.id})"
                    style="width: 100%; padding: 12px; background: #ff9800; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <i class="fas fa-exclamation-triangle"></i> Сообщить о проблеме
            </button>
        </div>
    </div>
`;

    marker.bindPopup(popupContent);
    marker.zoneId = zone.id;

    return marker;
}

// Обновление статистики
function updateStatistics(zones) {
    document.getElementById('total-zones').textContent = zones.length;

    const goodZones = zones.filter(z => z.status === 'отличный' || z.status === 'хороший').length;
    document.getElementById('good-zones').textContent = goodZones;

    const problemZones = zones.filter(z => z.problems_count > 0).length;
    document.getElementById('problem-zones').textContent = problemZones;
}

// Выбор местоположения для админа
function selectLocationForAdmin(latlng) {
    selectedLocation = {
        lat: latlng.lat.toFixed(6),
        lng: latlng.lng.toFixed(6)
    };

    if (locationMarker) {
        map.removeLayer(locationMarker);
    }

    locationMarker = L.marker([latlng.lat, latlng.lng], {
        icon: L.divIcon({
            className: 'admin-location-marker',
            html: '<div style="background-color: #ff0000; width: 40px; height: 40px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;"><i class="fas fa-plus" style="color: white; font-size: 20px;"></i></div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        }),
        draggable: true
    }).addTo(map);

    locationMarker.bindPopup(`
        <div style="padding: 10px;">
            <h4>Выбранные координаты:</h4>
            <p>Широта: <strong>${selectedLocation.lat}</strong></p>
            <p>Долгота: <strong>${selectedLocation.lng}</strong></p>
            <button onclick="saveSelectedLocation()" style="padding: 8px 16px; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                <i class="fas fa-check"></i> Использовать эти координаты
            </button>
        </div>
    `).openPopup();

    locationMarker.on('dragend', function(e) {
        const newLatLng = e.target.getLatLng();
        selectedLocation = {
            lat: newLatLng.lat.toFixed(6),
            lng: newLatLng.lng.toFixed(6)
        };
        locationMarker.getPopup().setContent(`
            <div style="padding: 10px;">
                <h4>Выбранные координаты:</h4>
                <p>Широта: <strong>${selectedLocation.lat}</strong></p>
                <p>Долгота: <strong>${selectedLocation.lng}</strong></p>
                <button onclick="saveSelectedLocation()" style="padding: 8px 16px; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                    <i class="fas fa-check"></i> Использовать эти координаты
                </button>
            </div>
        `);
    });

    window.selectedLocation = selectedLocation;
}

// Обновление фильтров
window.updateMapFilters = function(filterType, filterValue) {
    currentFilters[filterType] = filterValue;
    loadZones();
};

// Показ детальной информации о зоне
window.showZoneDetails = async function(zoneId) {
    try {
        const response = await fetch(`/api/zone/${zoneId}`);
        const data = await response.json();

        const zone = data.zone;
        const problems = data.problems;
        const maintenance = data.maintenance;

        const modalContent = `
            <div class="zone-details">
                <h2>${zone.name}</h2>
                <div class="details-grid">
                    <div class="detail-item"><strong>Город:</strong> ${zone.city}</div>
                    <div class="detail-item"><strong>Тип:</strong> ${zone.type}</div>
                    <div class="detail-item"><strong>Статус:</strong> ${zone.status}</div>
                    <div class="detail-item"><strong>Площадь:</strong> ${zone.area || 'Не указана'}</div>
                    <div class="detail-item"><strong>Создано:</strong> ${new Date(zone.created_at).toLocaleDateString('ru-RU')}</div>
                </div>
                <div class="section"><h3>Описание</h3><p>${zone.description || 'Описание отсутствует'}</p></div>
                ${problems.length > 0 ? `
                <div class="section"><h3>Последние проблемы (${problems.length})</h3>
                    <div class="problems-list">
                        ${problems.map(p => `
                            <div class="problem-item">
                                <div class="problem-header"><strong>${p.problem_type}</strong><span class="problem-date">${new Date(p.created_at).toLocaleDateString('ru-RU')}</span></div>
                                <p>${p.description}</p>
                                <div class="problem-footer"><span>От: ${p.user_name}</span><span class="problem-status">${p.status}</span></div>
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}
                ${maintenance.length > 0 ? `
                <div class="section"><h3>История обслуживания</h3>
                    <div class="maintenance-list">
                        ${maintenance.map(m => `
                            <div class="maintenance-item">
                                <div class="maintenance-header"><strong>${m.action_type}</strong><span class="maintenance-date">${new Date(m.performed_at).toLocaleDateString('ru-RU')}</span></div>
                                <p>${m.description}</p>
                                ${m.cost ? `<div><strong>Стоимость:</strong> ${m.cost} руб.</div>` : ''}
                                ${m.duration_minutes ? `<div><strong>Длительность:</strong> ${m.duration_minutes} мин.</div>` : ''}
                                <div class="maintenance-footer"><span>Исполнитель: ${m.user_name}</span></div>
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}
                <div class="actions" style="margin-top: 20px;">
                    <button onclick="reportProblem(${zone.id})" class="btn btn-primary" style="width: 100%;">Сообщить о проблеме</button>
                </div>
            </div>
        `;

        showCustomModal('Детальная информация', modalContent);

    } catch (error) {
        console.error('Ошибка загрузки деталей зоны:', error);
        alert('Ошибка загрузки информации о зоне');
    }
};

// Сообщение о проблеме
window.reportProblem = function(zoneId) {
    if (!window.user || !window.user.id) {
        alert('Для сообщения о проблеме необходимо авторизоваться');
        return;
    }

    const modalContent = `
        <div class="report-form">
            <div class="form-group">
                <label for="report-type">Тип проблемы</label>
                <select id="report-type" class="form-control">
                    <option value="полив">Полив</option>
                    <option value="обрезка">Обрезка</option>
                    <option value="уборка">Уборка</option>
                    <option value="ремонт">Ремонт</option>
                    <option value="посадка">Посадка</option>
                    <option value="освещение">Освещение</option>
                    <option value="безопасность">Безопасность</option>
                    <option value="другое">Другое</option>
                </select>
            </div>
            <div class="form-group">
                <label for="report-description">Описание проблемы</label>
                <textarea id="report-description" class="form-control" rows="4" placeholder="Опишите проблему подробно..."></textarea>
            </div>
            <div class="form-actions">
                <button onclick="submitReport(${zoneId})" class="btn btn-primary">Отправить</button>
            </div>
        </div>
    `;

    showCustomModal('Сообщить о проблеме', modalContent);
};

// Отправка отчёта
window.submitReport = async function(zoneId) {
    const problemType = document.getElementById('report-type').value;
    const description = document.getElementById('report-description').value;

    if (!description.trim()) {
        alert('Пожалуйста, опишите проблему');
        return;
    }

    try {
        const response = await fetch('/api/report-problem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zone_id: zoneId, problem_type: problemType, description })
        });

        const data = await response.json();

        if (data.success) {
            alert('Отчёт отправлен успешно!');
            closeCustomModal();
            loadZones();

            // Обновляем данные аналитики, если страница аналитики открыта
            if (window.analyticsDashboard && typeof window.analyticsDashboard.reloadAllData === 'function') {
                window.analyticsDashboard.reloadAllData();
            }
        } else {
            alert(data.error || 'Ошибка отправки отчёта');
        }
    } catch (error) {
        console.error('Ошибка отправки отчёта:', error);
        alert('Ошибка соединения');
    }
};

// Обработка выбора координат
function handleLocationPick(latlng) {
    if (locationPickerActive) {
        sessionStorage.setItem('pickedLocation', JSON.stringify({
            lat: latlng.lat.toFixed(6),
            lng: latlng.lng.toFixed(6)
        }));

        alert('Координаты выбраны! Закройте эту вкладку и вернитесь к форме.');

        if (confirm('Координаты сохранены. Закрыть вкладку с картой?')) {
            window.close();
        }
    }
}

// Сохранение выбранного местоположения для админа
window.saveSelectedLocation = function() {
    if (window.selectedLocation) {
        sessionStorage.setItem('pickedLocation', JSON.stringify(window.selectedLocation));
        alert('Местоположение сохранено! Вернитесь к форме добавления зоны.');
        window.close();
    } else {
        alert('Сначала выберите точку на карте!');
    }
};

window.cancelLocationSelection = function() {
    sessionStorage.removeItem('adminAddingZone');
    sessionStorage.removeItem('pickedLocation');
    alert('Режим выбора координат отменен.');
    window.close();
};

// Загрузка графика аналитики
window.loadAnalyticsChart = async function(chartType) {
    try {
        const city = document.getElementById('city-select')?.value || 'Барнаул';
        const response = await fetch(`/api/analytics/chart/${chartType}?city=${encodeURIComponent(city)}`);
        const data = await response.json();

        if (currentChart) {
            currentChart.destroy();
        }

        const ctx = document.getElementById('analytics-chart').getContext('2d');

        const titleMap = {
            'pollution': 'Загрязнение воздуха по районам',
            'zone-dynamics': 'Динамика добавления зон',
            'problem-types': 'Распределение типов проблем',
            'maintenance-costs': 'Затраты на обслуживание по типам зон'
        };
        document.getElementById('chart-title').textContent = titleMap[chartType] || 'Аналитика';

        switch (chartType) {
            case 'pollution':
                currentChart = createPollutionChart(ctx, data);
                break;
            case 'zone-dynamics':
                currentChart = createZoneDynamicsChart(ctx, data);
                break;
            case 'problem-types':
                currentChart = createProblemTypesChart(ctx, data);
                break;
            case 'maintenance-costs':
                currentChart = createMaintenanceCostsChart(ctx, data);
                break;
        }
    } catch (error) {
        console.error('Ошибка загрузки графика:', error);
        alert('Ошибка загрузки данных для графика');
    }
};

// Создание графика загрязнения
function createPollutionChart(ctx, data) {
    const pollutionColors = { 'низкий': '#4caf50', 'средний': '#ff9800', 'высокий': '#f44336' };
    return new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Загрязнение воздуха',
                data: data.points.map(p => ({ x: p.x, y: p.y, label: p.label, value: p.value })),
                backgroundColor: data.points.map(p => pollutionColors[p.level] || '#cccccc'),
                borderWidth: 1,
                pointRadius: data.points.map(p => p.value / 10)
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: 'Загрязнение воздуха по районам' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Район: ${context.raw.label}\nУровень: ${context.raw.level || 'н/д'}\nИндекс: ${context.raw.value}`;
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Долгота' } },
                y: { title: { display: true, text: 'Широта' } }
            }
        }
    });
}

// Создание графика динамики зон
function createZoneDynamicsChart(ctx, data) {
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'Добавлено зон',
                data: data.zonesAdded || [],
                borderColor: '#4caf50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: { title: { display: true, text: 'Динамика добавления зон' } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Количество зон' } },
                x: { title: { display: true, text: 'Месяц' } }
            }
        }
    });
}

// Создание круговой диаграммы проблем
function createProblemTypesChart(ctx, data) {
    const colors = ['#ff9800', '#f44336', '#2196f3', '#9c27b0', '#607d8b', '#795548'];
    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels || [],
            datasets: [{
                data: data.values || [],
                backgroundColor: colors.slice(0, data.labels.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: 'Распределение типов проблем' },
                legend: { position: 'right' }
            }
        }
    });
}

// Создание графика затрат
function createMaintenanceCostsChart(ctx, data) {
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'Затраты (тыс. руб)',
                data: data.values || [],
                backgroundColor: '#4caf50',
                borderColor: '#2e7d32',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: { title: { display: true, text: 'Затраты на обслуживание по типам зон' } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Затраты (тыс. руб)' } },
                x: { title: { display: true, text: 'Тип зоны' } }
            }
        }
    });
}

// Вспомогательные функции для модальных окон
function showCustomModal(title, content) {
    const modalId = 'custom-modal';
    let modal = document.getElementById(modalId);

    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">${content}</div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.close-modal').addEventListener('click', closeCustomModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeCustomModal(); });
    } else {
        modal.querySelector('.modal-header h3').textContent = title;
        modal.querySelector('.modal-body').innerHTML = content;
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCustomModal() {
    const modal = document.getElementById('custom-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initMap, 100);

    const citySelect = document.getElementById('city-select');
    if (citySelect) {
        citySelect.addEventListener('change', function() {
            currentCity = this.value;
            if (map) {
                const cityData = window.citiesData ? window.citiesData[currentCity] : { lat: 53.347996, lng: 83.779836, zoom: 12 };
                map.setView([cityData.lat, cityData.lng], cityData.zoom);
                loadZones();
            }
        });
    }

    const analyticsModal = document.getElementById('analytics-modal');
    if (analyticsModal) {
        const closeBtn = analyticsModal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                if (currentChart) {
                    currentChart.destroy();
                    currentChart = null;
                }
            });
        }
        analyticsModal.addEventListener('click', function(e) {
            if (e.target === this) {
                if (currentChart) {
                    currentChart.destroy();
                    currentChart = null;
                }
            }
        });
    }

    if (adminMode) {
        const style = document.createElement('style');
        style.textContent = `.admin-location-marker { z-index: 2000 !important; }`;
        document.head.appendChild(style);
        setTimeout(() => {
            alert('Режим выбора координат активирован. Кликните на карте для выбора местоположения новой зоны.');
        }, 500);
    }
});