// static/js/add_zone.js
let mapPreview = null;
let previewMarker = null;

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('zone-form');
    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');
    const citySelect = document.getElementById('city');
    const previewBtn = document.getElementById('preview-btn');
    const submitBtn = document.getElementById('submit-btn');
    const photoInput = document.getElementById('photo-input');
    const uploadArea = document.getElementById('upload-area');
    const photoPreview = document.getElementById('photo-preview');

    // Восстановление координат из sessionStorage (если возвращались с карты)
    if (sessionStorage.getItem('pickedLocation')) {
        try {
            const location = JSON.parse(sessionStorage.getItem('pickedLocation'));
            latInput.value = location.lat;
            lngInput.value = location.lng;
            sessionStorage.removeItem('pickedLocation');
            alert('Координаты успешно загружены из карты!');
        } catch (e) {
            console.error('Ошибка загрузки координат:', e);
        }
    }

    // Инициализация карты предпросмотра
    function initMapPreview() {
        const mapContainer = document.getElementById('admin-map-preview');
        if (!mapContainer) return;

        // Удаляем старую карту, если есть
        if (mapPreview) {
            mapPreview.remove();
            mapPreview = null;
        }

        // Определяем начальные координаты
        let lat, lng;
        if (latInput.value && lngInput.value) {
            lat = parseFloat(latInput.value);
            lng = parseFloat(lngInput.value);
            if (isNaN(lat) || isNaN(lng)) {
                lat = 53.347996;
                lng = 83.779836;
            }
        } else if (citySelect && citySelect.value && window.citiesData && window.citiesData[citySelect.value]) {
            lat = window.citiesData[citySelect.value].lat;
            lng = window.citiesData[citySelect.value].lng;
            latInput.value = lat.toFixed(6);
            lngInput.value = lng.toFixed(6);
        } else {
            lat = 53.347996;
            lng = 83.779836;
            latInput.value = lat.toFixed(6);
            lngInput.value = lng.toFixed(6);
        }

        mapPreview = L.map(mapContainer, {
            zoomControl: false,
            attributionControl: false
        }).setView([lat, lng], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: ''
        }).addTo(mapPreview);

        // Создаём перетаскиваемый маркер
        previewMarker = L.marker([lat, lng], { draggable: true }).addTo(mapPreview);

        // Обновление полей при перетаскивании маркера
        previewMarker.on('dragend', function(e) {
            const pos = e.target.getLatLng();
            latInput.value = pos.lat.toFixed(6);
            lngInput.value = pos.lng.toFixed(6);
        });

        // Обновление маркера при изменении полей ввода
        latInput.addEventListener('input', updateMarkerFromInputs);
        lngInput.addEventListener('input', updateMarkerFromInputs);

        // Центрирование карты при смене города
        if (citySelect) {
            citySelect.addEventListener('change', function() {
                const city = this.value;
                if (city && window.citiesData && window.citiesData[city]) {
                    const cityLat = window.citiesData[city].lat;
                    const cityLng = window.citiesData[city].lng;
                    mapPreview.setView([cityLat, cityLng], 13);
                    previewMarker.setLatLng([cityLat, cityLng]);
                    latInput.value = cityLat.toFixed(6);
                    lngInput.value = cityLng.toFixed(6);
                }
            });
        }
    }

    // Функция обновления маркера из полей ввода
    function updateMarkerFromInputs() {
        if (!mapPreview || !previewMarker) return;
        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);
        if (!isNaN(lat) && !isNaN(lng)) {
            previewMarker.setLatLng([lat, lng]);
            mapPreview.setView([lat, lng], 15);
        }
    }

    // Запускаем инициализацию карты после небольшой задержки
    setTimeout(() => {
        initMapPreview();
    }, 300);

    // Валидация формы перед отправкой
    function validateForm() {
        const required = ['name', 'city', 'type', 'lat', 'lng'];
        for (let field of required) {
            const el = document.querySelector(`[name="${field}"]`);
            if (!el || !el.value.trim()) {
                alert(`Пожалуйста, заполните поле "${field}"`);
                if (el) el.focus();
                return false;
            }
        }

        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);
        if (isNaN(lat) || lat < -90 || lat > 90) {
            alert('Некорректная широта (допустимо от -90 до 90)');
            latInput.focus();
            return false;
        }
        if (isNaN(lng) || lng < -180 || lng > 180) {
            alert('Некорректная долгота (допустимо от -180 до 180)');
            lngInput.focus();
            return false;
        }
        return true;
    }

    // Предпросмотр заявки (если нужен)
    if (previewBtn) {
        previewBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (!validateForm()) return;
            // Здесь можно заполнить модальное окно предпросмотра
        });
    }

    // Отправка формы
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!validateForm()) return;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';

        try {
            const formData = new FormData(form);
            const response = await fetch('/add-zone', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                alert('Заявка успешно отправлена на рассмотрение!');
                form.reset();
                window.location.href = '/';
            } else {
                const errorText = await response.text();
                console.error('Ошибка:', errorText);
                alert('Ошибка при отправке заявки. Попробуйте позже.');
            }
        } catch (error) {
            console.error('Ошибка соединения:', error);
            alert('Ошибка соединения. Проверьте интернет.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить заявку';
        }
    });

    // Закрытие модального окна
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
});