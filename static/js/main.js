document.addEventListener('DOMContentLoaded', function() {
    // Night Mode Toggle
    const nightModeToggle = document.getElementById('night-mode-toggle');
    const darkTheme = document.getElementById('dark-theme');
    const body = document.body;
    
    // Проверяем сохранённую тему
    if (localStorage.getItem('darkMode') === 'enabled') {
        enableDarkMode();
    }
    
    nightModeToggle.addEventListener('click', function() {
        if (body.classList.contains('dark-mode')) {
            disableDarkMode();
        } else {
            enableDarkMode();
        }
    });
    
    function enableDarkMode() {
        body.classList.add('dark-mode');
        darkTheme.disabled = false;
        localStorage.setItem('darkMode', 'enabled');
        nightModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        nightModeToggle.title = 'Дневной режим';
    }
    
    function disableDarkMode() {
        body.classList.remove('dark-mode');
        darkTheme.disabled = true;
        localStorage.setItem('darkMode', 'disabled');
        nightModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        nightModeToggle.title = 'Ночной режим';
    }
    
    // City Selector
    const citySelect = document.getElementById('city-select');

    if (citySelect) {
        citySelect.addEventListener('change', function() {
            const selectedCity = this.value;
            window.location.href = `/?city=${encodeURIComponent(selectedCity)}`;
        });
    }

    // Modal Management
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close-modal');
    const loginBtn = document.getElementById('login-btn');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const addZoneBtn = document.getElementById('add-zone-btn');

    // Open Login Modal
    if (loginBtn) {
        loginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openModal('login-modal');
        });
    }

    // Switch between login and register
    if (showRegister) {
        showRegister.addEventListener('click', function(e) {
            e.preventDefault();
            closeAllModals();
            openModal('register-modal');
        });
    }

    if (showLogin) {
        showLogin.addEventListener('click', function(e) {
            e.preventDefault();
            closeAllModals();
            openModal('login-modal');
        });
    }

    // Add Zone Button (в шапке)
    const headerAddZoneBtn = document.querySelector('.dropdown-content a[href*="add-zone"]');
    if (headerAddZoneBtn) {
        headerAddZoneBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/add-zone';
        });
    }

    // Close modals
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            closeModal(modal);
        });
    });

    // Close modal on outside click
    modals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal(this);
            }
        });
    });

    // Escape key to close modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });

    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal(modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function closeAllModals() {
        modals.forEach(modal => {
            closeModal(modal);
        });
    }

    // Форма входа
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            // Показываем индикатор загрузки
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вход...';
            submitBtn.disabled = true;

            try {
                // Отправляем запрос на сервер
                const response = await fetch('/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: new URLSearchParams({
                        'email': email,
                        'password': password
                    })
                });

                // Обрабатываем ответ
                if (response.redirected) {
                    // Если сервер вернул редирект, следуем за ним
                    window.location.href = response.url;
                } else if (response.ok) {
                    // Если успешный ответ без редиректа
                    const data = await response.json();
                    if (data.success) {
                        showMessage('Вход выполнен успешно!', 'success');
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    } else {
                        showMessage(data.error || 'Ошибка входа. Проверьте данные.', 'error');
                    }
                } else {
                    const errorData = await response.json();
                    showMessage(errorData.error || 'Ошибка сервера. Попробуйте позже.', 'error');
                }
            } catch (error) {
                console.error('Ошибка входа:', error);
                showMessage('Ошибка соединения. Проверьте интернет.', 'error');
            } finally {
                // Восстанавливаем кнопку
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Форма регистрации
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const confirm = document.getElementById('reg-confirm').value;
            const city = document.getElementById('reg-city').value;

            // Валидация
            if (password !== confirm) {
                showMessage('Пароли не совпадают', 'error');
                return;
            }

            if (password.length < 6) {
                showMessage('Пароль должен быть не менее 6 символов', 'error');
                return;
            }

            // Показываем индикатор загрузки
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Регистрация...';
            submitBtn.disabled = true;

            try {
                // Отправляем запрос на сервер
                const response = await fetch('/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: new URLSearchParams({
                        'name': name,
                        'email': email,
                        'password': password,
                        'confirm_password': confirm,
                        'city': city
                    })
                });

                // Обрабатываем ответ
                if (response.redirected) {
                    // Если сервер вернул редирект, следуем за ним
                    window.location.href = response.url;
                } else if (response.ok) {
                    // Если успешный ответ без редиректа
                    const data = await response.json();
                    if (data.success) {
                        showMessage('Регистрация прошла успешно!', 'success');
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    } else {
                        showMessage(data.error || 'Ошибка регистрации. Возможно email уже занят.', 'error');
                    }
                } else {
                    const errorData = await response.json();
                    showMessage(errorData.error || 'Ошибка сервера. Попробуйте позже.', 'error');
                }
            } catch (error) {
                console.error('Ошибка регистрации:', error);
                showMessage('Ошибка соединения. Проверьте интернет.', 'error');
            } finally {
                // Восстанавливаем кнопку
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Filter Buttons (только на главной странице)
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filterType = this.dataset.status ? 'status' : 'type';
            const filterValue = this.dataset.status || this.dataset.type;

            // Убираем активный класс у всех кнопок в этой группе
            this.parentElement.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            // Добавляем активный класс текущей кнопке
            this.classList.add('active');

            // Обновляем карту с новыми фильтрами
            if (window.updateMapFilters) {
                window.updateMapFilters(filterType, filterValue);
            }
        });
    });

    // Analytics Buttons (только на главной странице)
    const analyticsButtons = document.querySelectorAll('.analytics-btn');
    analyticsButtons.forEach(button => {
        button.addEventListener('click', function() {
            const chartType = this.dataset.chart;

            if (window.loadAnalyticsChart) {
                window.loadAnalyticsChart(chartType);
                openModal('analytics-modal');

                // Устанавливаем заголовок
                const titleMap = {
                    'pollution': 'Аналитика загрязнения воздуха',
                    'zone-dynamics': 'Динамика состояния зон',
                    'problem-types': 'Распределение типов проблем',
                    'maintenance-costs': 'Затраты на обслуживание зон'
                };

                document.getElementById('chart-title').textContent = titleMap[chartType] || 'Аналитика';
            }
        });
    });

    // Utility Functions
    function showMessage(text, type) {
        // Удаляем старые сообщения
        const oldMessages = document.querySelectorAll('.message');
        oldMessages.forEach(msg => msg.remove());

        // Создаём новое сообщение
        const message = document.createElement('div');
        message.className = `message message-${type}`;
        message.textContent = text;
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            background-color: ${type === 'error' ? '#f44336' : '#4caf50'};
            color: white;
            z-index: 3000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(message);

        // Удаляем сообщение через 5 секунд
        setTimeout(() => {
            message.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => message.remove(), 300);
        }, 5000);
    }

    // Добавляем стили для анимации
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    // Обработка flash сообщений
    const flashMessages = document.querySelectorAll('.alert');
    flashMessages.forEach(msg => {
        setTimeout(() => {
            msg.style.opacity = '0';
            setTimeout(() => msg.remove(), 300);
        }, 5000);
    });
    function checkAdminAccess() {
    const user = window.user;
    if (!user) {
        return false;
    }

    // Разрешенные роли для админ-панели
    const allowedRoles = ['super_admin', 'junior_admin', 'moderator'];
    return allowedRoles.includes(user.role);
}

// Проверяем при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Если на странице есть ссылка на админ-панель, проверяем доступ
    const adminLinks = document.querySelectorAll('a[href*="admin"]');
    adminLinks.forEach(link => {
        if (!checkAdminAccess()) {
            link.style.display = 'none';
        }
    });

    // Также проверяем, если мы уже на странице админ-панели
    if (window.location.pathname.includes('/admin') && !checkAdminAccess()) {
        alert('Доступ запрещен. Требуются права администратора или модератора.');
        window.location.href = '/';
    }
});
});