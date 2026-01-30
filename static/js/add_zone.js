// static/js/add_zone.js
let mapPreview = null;
let previewMarker = null;
let uploadedPhotos = [];

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('zone-form');
    const browsePhotosBtn = document.getElementById('browse-photos');
    const photoInput = document.getElementById('photo-input');
    const uploadArea = document.getElementById('upload-area');
    const photoPreview = document.getElementById('photo-preview');
    const previewBtn = document.getElementById('preview-btn');
    const submitBtn = document.getElementById('submit-btn');
    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');
    const citySelect = document.getElementById('city');

    citySelect.addEventListener('change', function() {
        const selectedCity = this.value;
        if (window.citiesData && window.citiesData[selectedCity]) {
            const cityData = window.citiesData[selectedCity];
            if (mapPreview) {
                mapPreview.setView([cityData.lat, cityData.lng], cityData.zoom || 12);
                if (previewMarker) {
                    previewMarker.setLatLng([cityData.lat, cityData.lng]);
                }
            }
        }
    });
    // Валидация ввода координат (только цифры и точка)
    latInput.addEventListener('input', function(e) {
        this.value = this.value.replace(/[^\d.-]/g, '');
        updateMapPreview();
    });

    lngInput.addEventListener('input', function(e) {
        this.value = this.value.replace(/[^\d.-]/g, '');
        updateMapPreview();
    });

    // Инициализация карты предпросмотра
    function initMapPreview() {
        const mapContainer = document.getElementById('map-preview');
        if (!mapContainer) return;

        // Удаляем предыдущую карту если есть
        if (mapPreview) {
            mapPreview.remove();
            mapPreview = null;
        }

        // Создаем карту
        mapPreview = L.map(mapContainer, {
            center: [53.347996, 83.779836],
            zoom: 12,
            zoomControl: false,
            attributionControl: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 18
        }).addTo(mapPreview);

        // Добавляем маркер
        previewMarker = L.marker([53.347996, 83.779836], {
            draggable: true
        }).addTo(mapPreview);

        // Обработка перетаскивания маркера
        previewMarker.on('dragend', function(e) {
            const latlng = e.target.getLatLng();
            latInput.value = latlng.lat.toFixed(6);
            lngInput.value = latlng.lng.toFixed(6);
        });
    }

    // Обновление карты предпросмотра
    function updateMapPreview() {
        if (!mapPreview) return;

        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);

        if (!isNaN(lat) && !isNaN(lng)) {
            const newLatLng = [lat, lng];
            mapPreview.setView(newLatLng, 15);

            if (previewMarker) {
                previewMarker.setLatLng(newLatLng);
            } else {
                previewMarker = L.marker(newLatLng, {
                    draggable: true
                }).addTo(mapPreview);

                previewMarker.on('dragend', function(e) {
                    const latlng = e.target.getLatLng();
                    latInput.value = latlng.lat.toFixed(6);
                    lngInput.value = latlng.lng.toFixed(6);
                });
            }
        }
    }

    // Инициализация карты при загрузке
    setTimeout(() => {
        if (document.getElementById('map-preview')) {
            initMapPreview();
        }
    }, 500);

    // Выбор местоположения на карте - ОТКРЫВАЕМ В ТОЙ ЖЕ ВКЛАДКЕ
//    if (pickOnMapBtn) {
//        pickOnMapBtn.addEventListener('click', function() {
//            const city = citySelect.value || 'Барнаул';
//            // Сохраняем данные формы
//            saveFormData();
//            // Открываем в той же вкладке
//            window.location.href = `/?city=${encodeURIComponent(city)}&pick_location=true`;
//        });
//    }

    // Сохранение данных формы в sessionStorage
    function saveFormData() {
        const formData = {
            name: document.getElementById('name').value,
            city: document.getElementById('city').value,
            type: document.getElementById('type').value,
            lat: document.getElementById('lat').value,
            lng: document.getElementById('lng').value,
            description: document.getElementById('description').value
        };
        sessionStorage.setItem('formData', JSON.stringify(formData));
        sessionStorage.setItem('fromAddZone', 'true');
    }

    // Восстановление данных формы при возврате
    function restoreFormData() {
        if (sessionStorage.getItem('fromAddZone') === 'true') {
            try {
                const formData = JSON.parse(sessionStorage.getItem('formData') || '{}');
                if (formData.name) document.getElementById('name').value = formData.name;
                if (formData.city) document.getElementById('city').value = formData.city;
                if (formData.type) document.getElementById('type').value = formData.type;
                if (formData.lat) document.getElementById('lat').value = formData.lat;
                if (formData.lng) document.getElementById('lng').value = formData.lng;
                if (formData.description) document.getElementById('description').value = formData.description;

                updateMapPreview();
            } catch (e) {
                console.error('Ошибка восстановления данных формы:', e);
            }
            sessionStorage.removeItem('formData');
            sessionStorage.removeItem('fromAddZone');
        }
    }

    // Загрузка выбранных координат из сессии
    if (sessionStorage.getItem('pickedLocation')) {
        try {
            const location = JSON.parse(sessionStorage.getItem('pickedLocation'));
            latInput.value = location.lat;
            lngInput.value = location.lng;
            updateMapPreview();
            sessionStorage.removeItem('pickedLocation');

            // Показываем уведомление
            alert('Координаты успешно загружены из карты!');
        } catch (e) {
            console.error('Ошибка загрузки координат:', e);
        }
    }

    // Восстанавливаем данные формы при загрузке
    restoreFormData();

    // Загрузка фотографий
    uploadArea.addEventListener('click', () => photoInput.click());
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--primary-color)';
        uploadArea.style.background = 'rgba(46, 125, 50, 0.05)';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '#ddd';
        uploadArea.style.background = '';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#ddd';
        uploadArea.style.background = '';

        const files = e.dataTransfer.files;
        handlePhotoUpload(files);
    });

    photoInput.addEventListener('change', (e) => {
        handlePhotoUpload(e.target.files);
    });

    function handlePhotoUpload(files) {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

        Array.from(files).forEach(file => {
            if (!validTypes.includes(file.type)) {
                alert('Пожалуйста, загружайте только изображения (JPEG, PNG, GIF, WebP)');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                alert('Размер файла не должен превышать 5 МБ');
                return;
            }

            if (uploadedPhotos.length >= 5) {
                alert('Максимальное количество фотографий - 5');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const photo = {
                    name: file.name,
                    data: e.target.result,
                    type: file.type
                };

                uploadedPhotos.push(photo);
                renderPhotoPreview();
            };
            reader.readAsDataURL(file);
        });

        photoInput.value = '';
    }

    function renderPhotoPreview() {
        photoPreview.innerHTML = '';

        uploadedPhotos.forEach((photo, index) => {
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            photoItem.innerHTML = `
                <img src="${photo.data}" alt="${photo.name}">
                <button type="button" class="remove-photo" onclick="removePhoto(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            photoPreview.appendChild(photoItem);
        });
    }

    window.removePhoto = function(index) {
        uploadedPhotos.splice(index, 1);
        renderPhotoPreview();
    };

    // Предпросмотр заявки
    previewBtn.addEventListener('click', function() {
        if (!validateForm()) return;

        const formData = getFormData();
        const previewContent = generatePreviewHTML(formData);

        document.getElementById('preview-content').innerHTML = previewContent;
        document.getElementById('preview-modal').classList.add('active');
    });

    // Отправка формы
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!validateForm()) return;

        // Показываем индикатор загрузки
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';

        try {
            // Отправляем форму традиционным способом
            const response = await fetch('/add-zone', {
                method: 'POST',
                body: new FormData(form)
            });

            if (response.ok) {
                alert('Заявка успешно отправлена на рассмотрение!');
                form.reset();
                uploadedPhotos = [];
                photoPreview.innerHTML = '';
                window.location.href = '/';
            } else {
                const errorText = await response.text();
                console.error('Ошибка отправки заявки:', errorText);
                alert('Ошибка отправки заявки. Пожалуйста, попробуйте еще раз.');
            }
        } catch (error) {
            console.error('Ошибка отправки заявки:', error);
            alert('Ошибка соединения. Пожалуйста, попробуйте позже.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить заявку';
        }
    });

    function validateForm() {
        const requiredFields = [
            'name', 'city', 'type',
            'lat', 'lng', 'description'
        ];

        for (const fieldName of requiredFields) {
            const field = document.querySelector(`[name="${fieldName}"]`);
            if (field && !field.value.trim()) {
                alert(`Пожалуйста, заполните поле: ${field.previousElementSibling.textContent}`);
                field.focus();
                return false;
            }
        }

        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);

        if (isNaN(lat) || lat < -90 || lat > 90) {
            alert('Пожалуйста, укажите корректную широту (-90 до 90)');
            return false;
        }

        if (isNaN(lng) || lng < -180 || lng > 180) {
            alert('Пожалуйста, укажите корректную долготу (-180 до 180)');
            return false;
        }

        return true;
    }

    function getFormData() {
        return {
            name: document.getElementById('name').value,
            city: document.getElementById('city').value,
            type: document.getElementById('type').value,
            lat: document.getElementById('lat').value,
            lng: document.getElementById('lng').value,
            address: document.getElementById('address').value,
            status: document.getElementById('status').value,
            description: document.getElementById('description').value,
            photos: uploadedPhotos
        };
    }

    function generatePreviewHTML(data) {
        const statusColors = {
            'отличный': '#4caf50',
            'хороший': '#8bc34a',
            'удовлетворительный': '#ffeb3b',
            'требует ухода': '#ff9800',
            'критический': '#f44336'
        };

        return `
            <div class="preview-content">
                <h3>${data.name}</h3>

                <div class="preview-grid">
                    <div class="preview-item">
                        <strong>Город:</strong> ${data.city}
                    </div>
                    <div class="preview-item">
                        <strong>Тип зоны:</strong> ${data.type}
                    </div>
                    <div class="preview-item">
                        <strong>Координаты:</strong> ${data.lat}, ${data.lng}
                    </div>
                    <div class="preview-item">
                        <strong>Состояние:</strong>
                        <span style="color: ${statusColors[data.status] || '#666'}">
                            ${data.status}
                        </span>
                    </div>
                    ${data.address ? `<div class="preview-item"><strong>Адрес:</strong> ${data.address}</div>` : ''}
                </div>

                <div class="preview-section">
                    <h4>Описание:</h4>
                    <p>${data.description}</p>
                </div>

                ${data.photos.length > 0 ? `
                <div class="preview-section">
                    <h4>Фотографии (${data.photos.length}):</h4>
                    <div class="preview-photos">
                        ${data.photos.map((photo, i) => `
                            <div class="preview-photo">
                                <img src="${photo.data}" alt="Фото ${i + 1}">
                                <small>${photo.name}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="preview-notice">
                    <p><i class="fas fa-info-circle"></i> Заявка будет рассмотрена администратором в течение 3 рабочих дней.</p>
                </div>
            </div>
        `;
    }

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