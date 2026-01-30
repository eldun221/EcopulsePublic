// static/js/login.js
document.addEventListener('DOMContentLoaded', function() {
    // Форма входа
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вход...';
            submitBtn.disabled = true;

            try {
                const formData = new FormData(this);
                const response = await fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: new URLSearchParams(new URLSearchParams(formData))
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        // Показываем сообщение об успехе
                        const alertDiv = document.createElement('div');
                        alertDiv.className = 'alert alert-success';
                        alertDiv.textContent = data.message || 'Вход выполнен успешно!';
                        this.parentNode.insertBefore(alertDiv, this);

                        // Перезагружаем страницу через секунду
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 1000);
                    } else {
                        // Показываем ошибку
                        const alertDiv = document.createElement('div');
                        alertDiv.className = 'alert alert-danger';
                        alertDiv.textContent = data.error || 'Ошибка входа';
                        this.parentNode.insertBefore(alertDiv, this);
                    }
                } else {
                    const data = await response.json();
                    const alertDiv = document.createElement('div');
                    alertDiv.className = 'alert alert-danger';
                    alertDiv.textContent = data.error || 'Ошибка сервера';
                    this.parentNode.insertBefore(alertDiv, this);
                }
            } catch (error) {
                console.error('Ошибка входа:', error);
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert alert-danger';
                alertDiv.textContent = 'Ошибка соединения';
                this.parentNode.insertBefore(alertDiv, this);
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

            // Валидация паролей
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm_password').value;

            if (password !== confirmPassword) {
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert alert-danger';
                alertDiv.textContent = 'Пароли не совпадают';
                this.parentNode.insertBefore(alertDiv, this);
                return;
            }

            if (password.length < 6) {
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert alert-danger';
                alertDiv.textContent = 'Пароль должен быть не менее 6 символов';
                this.parentNode.insertBefore(alertDiv, this);
                return;
            }

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Регистрация...';
            submitBtn.disabled = true;

            try {
                const formData = new FormData(this);
                const response = await fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: new URLSearchParams(new URLSearchParams(formData))
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        // Показываем сообщение об успехе
                        const alertDiv = document.createElement('div');
                        alertDiv.className = 'alert alert-success';
                        alertDiv.textContent = data.message || 'Регистрация прошла успешно!';
                        this.parentNode.insertBefore(alertDiv, this);

                        // Перезагружаем страницу через секунду
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 1000);
                    } else {
                        // Показываем ошибку
                        const alertDiv = document.createElement('div');
                        alertDiv.className = 'alert alert-danger';
                        alertDiv.textContent = data.error || 'Ошибка регистрации';
                        this.parentNode.insertBefore(alertDiv, this);
                    }
                } else {
                    const data = await response.json();
                    const alertDiv = document.createElement('div');
                    alertDiv.className = 'alert alert-danger';
                    alertDiv.textContent = data.error || 'Ошибка сервера';
                    this.parentNode.insertBefore(alertDiv, this);
                }
            } catch (error) {
                console.error('Ошибка регистрации:', error);
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert alert-danger';
                alertDiv.textContent = 'Ошибка соединения';
                this.parentNode.insertBefore(alertDiv, this);
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }
});