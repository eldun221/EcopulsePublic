// static/js/index.js
// Функция переключения панели
window.toggleSidePanel = function() {
    const sidePanel = document.getElementById('side-panel');
    const toggleBtn = document.querySelector('.toggle-panel-btn');

    if (sidePanel) {
        sidePanel.classList.toggle('collapsed');

        // Перерисовываем карту при изменении размера
        if (window.map) {
            setTimeout(() => {
                window.map.invalidateSize();
            }, 300);
        }
    }
}

// Сохранение выбранного местоположения для админа
window.saveSelectedLocation = function() {
    if (window.selectedLocation) {
        sessionStorage.setItem('selectedLocation', JSON.stringify(window.selectedLocation));
        alert('Местоположение сохранено! Вернитесь к форме добавления зоны.');
        window.close(); // Закрываем вкладку
    } else {
        alert('Сначала выберите точку на карте!');
    }
}

window.cancelLocationSelection = function() {
    sessionStorage.removeItem('adminAddingZone');
    sessionStorage.removeItem('selectedLocation');
    alert('Режим выбора координат отменен.');
    window.close();
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Добавляем анимацию для кнопки при первом посещении
    const toggleBtn = document.querySelector('.toggle-panel-btn');
    if (toggleBtn && !localStorage.getItem('panelHintShown')) {
        setTimeout(() => {
            toggleBtn.classList.add('pulse');
            setTimeout(() => {
                toggleBtn.classList.remove('pulse');
                localStorage.setItem('panelHintShown', 'true');
            }, 3000);
        }, 1000);
    }

    // Сортируем города в алфавитном порядке в шапке
    const citySelect = document.getElementById('city-select');
    if (citySelect) {
        const options = Array.from(citySelect.options);
        options.sort((a, b) => a.text.localeCompare(b.text, 'ru'));

        // Сохраняем выбранное значение
        const selectedValue = citySelect.value;

        // Удаляем все опции
        while (citySelect.options.length > 0) {
            citySelect.remove(0);
        }

        // Добавляем отсортированные
        options.forEach(option => {
            citySelect.appendChild(option);
        });

        // Восстанавливаем выбранное значение
        citySelect.value = selectedValue;
    }

    // Загружаем статистику города (не зависящую от видимых точек)
    loadCityStatistics();
});

// Загрузка статистики города
async function loadCityStatistics() {
    try {
        const city = document.getElementById('city-select')?.value || window.currentCity || 'Барнаул';
        const response = await fetch(`/api/analytics/data?city=${encodeURIComponent(city)}`);
        const data = await response.json();

        if (data.metrics) {
            document.getElementById('total-zones').textContent = data.metrics.total_zones || 0;
            document.getElementById('good-zones').textContent = data.metrics.good_zones || 0;
            document.getElementById('problem-zones').textContent = data.metrics.problem_zones || 0;
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Обработчик изменения города
const citySelect = document.getElementById('city-select');
if (citySelect) {
    citySelect.addEventListener('change', function() {
        loadCityStatistics();
    });
}