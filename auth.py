from flask import Blueprint, render_template, redirect, url_for, flash, request, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db
from config import Config
import re

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        # Рендерим страницу логина
        return render_template('login.html',
                               cities=Config.CITIES,
                               statuses=Config.STATUSES,
                               zone_types=Config.ZONE_TYPES,
                               user=session.get('user'))

    elif request.method == 'POST':
        # Обработка POST запроса
        email = request.form.get('email')
        password = request.form.get('password')

        conn = get_db()
        user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        conn.close()

        if user and check_password_hash(user['password_hash'], password):
            session['user'] = {
                'id': user['id'],
                'email': user['email'],
                'name': user['name'],
                'role': user['role'],
                'city': user['city']
            }

            # Если запрос пришел через AJAX (fetch), возвращаем JSON
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': True, 'message': 'Вход выполнен успешно!'})
            else:
                flash('Вход выполнен успешно!', 'success')
                return redirect(url_for('index'))
        else:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'error': 'Неверный email или пароль'}), 401
            else:
                flash('Неверный email или пароль', 'danger')
                return redirect(url_for('auth.login'))


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'GET':
        # Рендерим страницу регистрации
        return render_template('login.html',
                               register=True,
                               cities=Config.CITIES,
                               statuses=Config.STATUSES,
                               zone_types=Config.ZONE_TYPES,
                               user=session.get('user'))

    elif request.method == 'POST':
        email = request.form.get('email')
        name = request.form.get('name')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        city = request.form.get('city')

        errors = []

        # Валидация
        if not email or not name or not password or not confirm_password or not city:
            errors.append('Все поля обязательны для заполнения')

        if password != confirm_password:
            errors.append('Пароли не совпадают')

        if len(password) < 6:
            errors.append('Пароль должен содержать минимум 6 символов')

        # Проверка email
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if email and not re.match(email_pattern, email):
            errors.append('Некорректный email')

        if errors:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'error': errors[0]}), 400
            else:
                flash(errors[0], 'danger')
                return redirect(url_for('auth.register'))

        conn = get_db()

        # Проверяем, существует ли пользователь
        existing_user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        if existing_user:
            conn.close()
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'error': 'Пользователь с таким email уже существует'}), 400
            else:
                flash('Пользователь с таким email уже существует', 'danger')
                return redirect(url_for('auth.register'))

        # Создаем пользователя
        conn.execute('''
            INSERT INTO users (email, password_hash, name, role, city)
            VALUES (?, ?, ?, 'user', ?)
        ''', (email, generate_password_hash(password), name, city))

        conn.commit()

        # Получаем созданного пользователя
        user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        conn.close()

        session['user'] = {
            'id': user['id'],
            'email': user['email'],
            'name': user['name'],
            'role': user['role'],
            'city': user['city']
        }

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': True, 'message': 'Регистрация прошла успешно!'})
        else:
            flash('Регистрация прошла успешно!', 'success')
            return redirect(url_for('index'))


@auth_bp.route('/logout')
def logout():
    session.pop('user', None)
    flash('Вы вышли из системы', 'info')
    return redirect(url_for('index'))