// static/js/main.js

document.addEventListener('DOMContentLoaded', function() {
    // Переключение ночного режима
    const nightModeToggle = document.getElementById('night-mode-toggle');
    const darkTheme = document.getElementById('dark-theme');
    const body = document.body;

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

    // Выбор города
    const citySelect = document.getElementById('city-select');
    if (citySelect) {
        citySelect.addEventListener('change', function() {
            const selectedCity = this.value;
            window.location.href = `/?city=${encodeURIComponent(selectedCity)}`;
        });
    }

    // Управление модальными окнами
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close-modal');
    const loginBtn = document.getElementById('login-btn');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');

    if (loginBtn) {
        loginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openModal('login-modal');
        });
    }

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

    const headerAddZoneBtn = document.querySelector('.dropdown-content a[href*="add-zone"]');
    if (headerAddZoneBtn) {
        headerAddZoneBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/add-zone';
        });
    }

    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            closeModal(modal);
        });
    });

    modals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal(this);
            }
        });
    });

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
        modals.forEach(modal => closeModal(modal));
    }

    // Форма входа
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вход...';
            submitBtn.disabled = true;

            try {
                const response = await fetch('/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: new URLSearchParams({ email, password })
                });

                if (response.redirected) {
                    window.location.href = response.url;
                } else if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        showMessage('Вход выполнен успешно!', 'success');
                        setTimeout(() => window.location.reload(), 1000);
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

            if (password !== confirm) {
                showMessage('Пароли не совпадают', 'error');
                return;
            }

            if (password.length < 6) {
                showMessage('Пароль должен быть не менее 6 символов', 'error');
                return;
            }

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Регистрация...';
            submitBtn.disabled = true;

            try {
                const response = await fetch('/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: new URLSearchParams({ name, email, password, confirm_password: confirm, city })
                });

                if (response.redirected) {
                    window.location.href = response.url;
                } else if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        showMessage('Регистрация прошла успешно!', 'success');
                        setTimeout(() => window.location.reload(), 1000);
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
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Фильтры на карте
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filterType = this.dataset.status ? 'status' : 'type';
            const filterValue = this.dataset.status || this.dataset.type;

            this.parentElement.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');

            if (window.updateMapFilters) {
                window.updateMapFilters(filterType, filterValue);
            }
        });
    });

    // Кнопки аналитики
    const analyticsButtons = document.querySelectorAll('.analytics-btn');
    analyticsButtons.forEach(button => {
        button.addEventListener('click', function() {
            const chartType = this.dataset.chart;
            if (window.loadAnalyticsChart) {
                window.loadAnalyticsChart(chartType);
                openModal('analytics-modal');
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

    // Утилита для показа сообщений
    function showMessage(text, type) {
        const oldMessages = document.querySelectorAll('.message');
        oldMessages.forEach(msg => msg.remove());

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

        setTimeout(() => {
            message.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => message.remove(), 300);
        }, 5000);
    }

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

    const flashMessages = document.querySelectorAll('.alert');
    flashMessages.forEach(msg => {
        setTimeout(() => {
            msg.style.opacity = '0';
            setTimeout(() => msg.remove(), 300);
        }, 5000);
    });

    // Проверка доступа к админке
    function checkAdminAccess() {
        const user = window.user;
        if (!user) return false;
        const allowedRoles = ['super_admin', 'junior_admin', 'moderator'];
        return allowedRoles.includes(user.role);
    }

    const adminLinks = document.querySelectorAll('a[href*="admin"]');
    adminLinks.forEach(link => {
        if (!checkAdminAccess()) {
            link.style.display = 'none';
        }
    });

    if (window.location.pathname.includes('/admin') && !checkAdminAccess()) {
        alert('Доступ запрещен. Требуются права администратора или модератора.');
        window.location.href = '/';
    }
});