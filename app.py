from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from database import get_db, init_db
from auth import auth_bp
from config import Config
import json
from datetime import datetime
from utils import calculate_zone_stats, generate_predictions, estimate_maintenance_cost, get_status_color, \
    get_type_icon, format_date
import sqlite3
import re

app = Flask(__name__)
app.config.from_object(Config)
app.secret_key = Config.SECRET_KEY

# Регистрация Blueprint
app.register_blueprint(auth_bp, url_prefix='/auth')

# Инициализация базы данных при запуске
with app.app_context():
    init_db()

def get_cities_from_db():
    conn = get_db()
    cities = conn.execute('SELECT * FROM cities WHERE is_active = 1 ORDER BY name').fetchall()
    conn.close()
    return {row['name']: {'lat': row['lat'], 'lng': row['lng'], 'zoom': row['zoom']} for row in cities}

def get_zone_types_from_db():
    conn = get_db()
    zone_types = conn.execute('SELECT name FROM zone_types WHERE is_active = 1 ORDER BY name').fetchall()
    conn.close()
    return [row['name'] for row in zone_types]

def get_statuses_from_db():
    conn = get_db()
    statuses = conn.execute('SELECT * FROM zone_statuses WHERE is_active = 1 ORDER BY priority DESC').fetchall()
    conn.close()
    return {row['name']: {'color': row['color'], 'icon': row['icon']} for row in statuses}

def get_problem_types_from_db():
    conn = get_db()
    problem_types = conn.execute('SELECT name FROM problem_types WHERE is_active = 1 ORDER BY name').fetchall()
    conn.close()
    return [row['name'] for row in problem_types]







# Функция для преобразования Row в dict
def row_to_dict(row):
    if row is None:
        return None
    if isinstance(row, sqlite3.Row):
        return dict(row)
    return dict(row)


# Функция для получения словарей из базы данных
def get_dictionaries():
    conn = get_db()

    # Города
    cities_data = conn.execute('SELECT * FROM cities WHERE is_active = 1 ORDER BY name').fetchall()
    cities = {row['name']: {'lat': row['lat'], 'lng': row['lng'], 'zoom': row['zoom']} for row in cities_data}

    # Типы зон
    zone_types_data = conn.execute('SELECT * FROM zone_types WHERE is_active = 1 ORDER BY name').fetchall()
    zone_types = [row['name'] for row in zone_types_data]

    # Статусы
    statuses_data = conn.execute('SELECT * FROM zone_statuses WHERE is_active = 1 ORDER BY priority DESC').fetchall()
    statuses = {row['name']: {'color': row['color'], 'icon': row['icon']} for row in statuses_data}

    # Типы проблем
    problem_types_data = conn.execute('SELECT * FROM problem_types WHERE is_active = 1 ORDER BY name').fetchall()
    problem_types = [row['name'] for row in problem_types_data]

    conn.close()

    return cities, zone_types, statuses, problem_types


# Функция для определения статуса с учетом проблем
def get_adjusted_status(original_status, problems_count):
    status_order = ['отличный', 'хороший', 'удовлетворительный', 'требует ухода', 'критический']

    try:
        current_index = status_order.index(original_status)
        # Каждые 2 проблемы снижают статус на 1 уровень
        status_drop = min(problems_count // 2, 4)
        new_index = min(current_index + status_drop, 4)
        return status_order[new_index]
    except ValueError:
        return original_status


@app.route('/')
def index():
    city = request.args.get('city', 'Барнаул')

    # Получаем данные из базы
    cities = get_cities_from_db()

    if city not in cities:
        city = 'Барнаул'

    session['current_city'] = city

    return render_template('index.html',
                           city=city,
                           cities=cities,
                           statuses=get_statuses_from_db(),
                           zone_types=get_zone_types_from_db(),
                           user=session.get('user'))


@app.route('/api/zones')
def get_zones():
    city = request.args.get('city', 'Барнаул')
    bounds = request.args.get('bounds')

    conn = get_db()

    # Получаем все зоны города
    zones = conn.execute('''
        SELECT * FROM zones 
        WHERE city = ? AND is_approved = 1
    ''', (city,)).fetchall()

    zones_data = []
    for zone in zones:
        problems = conn.execute('''
            SELECT COUNT(*) as count FROM problem_reports 
            WHERE zone_id = ? AND status = 'new'
        ''', (zone['id'],)).fetchone()

        problems_count = problems['count']

        # Корректируем статус в зависимости от количества проблем
        adjusted_status = get_adjusted_status(zone['status'], problems_count)

        zones_data.append({
            'id': zone['id'],
            'name': zone['name'],
            'type': zone['type'],
            'status': adjusted_status,
            'lat': zone['lat'],
            'lng': zone['lng'],
            'area': zone['area'],
            'description': zone['description'],
            'problems_count': problems_count,
            'original_status': zone['status']  # Сохраняем оригинальный статус
        })

    conn.close()
    return jsonify(zones_data)


@app.route('/api/zone/<int:zone_id>')
def get_zone_details(zone_id):
    conn = get_db()

    zone = conn.execute('SELECT * FROM zones WHERE id = ?', (zone_id,)).fetchone()
    if not zone:
        conn.close()
        return jsonify({'error': 'Zone not found'}), 404

    problems = conn.execute('''
        SELECT pr.*, u.name as user_name 
        FROM problem_reports pr
        JOIN users u ON pr.user_id = u.id
        WHERE pr.zone_id = ? 
        ORDER BY pr.created_at DESC 
        LIMIT 5
    ''', (zone_id,)).fetchall()

    maintenance = conn.execute('''
        SELECT ml.*, u.name as user_name 
        FROM maintenance_logs ml
        JOIN users u ON ml.user_id = u.id
        WHERE ml.zone_id = ? 
        ORDER BY ml.performed_at DESC 
        LIMIT 5
    ''', (zone_id,)).fetchall()

    conn.close()

    return jsonify({
        'zone': row_to_dict(zone),
        'problems': [row_to_dict(p) for p in problems],
        'maintenance': [row_to_dict(m) for m in maintenance]
    })


@app.route('/api/report-problem', methods=['POST'])
def report_problem():
    if 'user' not in session:
        return jsonify({'error': 'Требуется авторизация'}), 401

    data = request.get_json()

    conn = get_db()
    conn.execute('''
        INSERT INTO problem_reports (zone_id, user_id, problem_type, description)
        VALUES (?, ?, ?, ?)
    ''', (data['zone_id'], session['user']['id'], data['problem_type'], data['description']))

    conn.commit()
    conn.close()

    return jsonify({'success': True})


@app.route('/admin')
def admin_panel():
    user = session.get('user')
    if not user:
        flash('Требуется авторизация', 'danger')
        return redirect(url_for('auth.login'))

    # Проверяем права доступа
    role = user.get('role')
    if role not in ['super_admin', 'junior_admin', 'moderator']:
        flash('Требуются права администратора или модератора', 'danger')
        return redirect(url_for('auth.login'))

    conn = get_db()

    requests = conn.execute('''
        SELECT zr.*, u.name as user_name, u.email as user_email
        FROM zone_requests zr
        JOIN users u ON zr.user_id = u.id
        WHERE zr.status = 'pending'
        ORDER BY zr.created_at DESC
    ''').fetchall()

    zones = conn.execute('''
        SELECT z.*, u.name as creator_name
        FROM zones z
        JOIN users u ON z.created_by = u.id
        ORDER BY z.created_at DESC
    ''').fetchall()

    user_count = conn.execute('SELECT COUNT(*) as count FROM users').fetchone()['count']

    conn.close()

    return render_template('admin.html',
                           requests=[row_to_dict(r) for r in requests],
                           zones=[row_to_dict(z) for z in zones],
                           user_count=user_count,
                           cities=get_cities_from_db(),
                           statuses=get_statuses_from_db(),
                           zone_types=get_zone_types_from_db(),
                           user=session.get('user'))


@app.route('/api/admin/request/<int:request_id>')
def get_request_details(request_id):
    user = session.get('user')
    if not user or user.get('role') not in ['super_admin', 'junior_admin', 'moderator']:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db()
    request_data = conn.execute('''
        SELECT zr.*, u.name as user_name, u.email as user_email
        FROM zone_requests zr
        JOIN users u ON zr.user_id = u.id
        WHERE zr.id = ?
    ''', (request_id,)).fetchone()
    conn.close()

    if not request_data:
        return jsonify({'error': 'Request not found'}), 404

    return jsonify(row_to_dict(request_data))


@app.route('/api/admin/approve-zone/<int:request_id>', methods=['POST'])
def approve_zone(request_id):
    user = session.get('user')
    if not user or user.get('role') not in ['super_admin', 'junior_admin', 'moderator']:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db()

    zone_request = conn.execute('SELECT * FROM zone_requests WHERE id = ?', (request_id,)).fetchone()
    if not zone_request:
        conn.close()
        return jsonify({'error': 'Request not found'}), 404

    conn.execute('''
        INSERT INTO zones (name, city, type, status, lat, lng, description, created_by, is_approved)
        VALUES (?, ?, ?, 'удовлетворительный', ?, ?, ?, ?, 1)
    ''', (
        zone_request['name'],
        zone_request['city'],
        zone_request['type'],
        zone_request['lat'],
        zone_request['lng'],
        zone_request['description'],
        zone_request['user_id']
    ))

    conn.execute('UPDATE zone_requests SET status = "approved" WHERE id = ?', (request_id,))

    conn.commit()
    conn.close()

    return jsonify({'success': True})


@app.route('/api/admin/reject-zone/<int:request_id>', methods=['POST'])
def reject_zone(request_id):
    user = session.get('user')
    if not user or user.get('role') not in ['super_admin', 'junior_admin', 'moderator']:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    reason = data.get('reason', 'Причина не указана')

    conn = get_db()
    conn.execute('UPDATE zone_requests SET status = "rejected", rejection_reason = ? WHERE id = ?',
                 (reason, request_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True})


@app.route('/add-zone', methods=['GET', 'POST'])
def add_zone():
    if 'user' not in session:
        flash('Требуется авторизация', 'danger')
        return redirect(url_for('auth.login'))

    if request.method == 'POST':
        name = request.form.get('name')
        city = request.form.get('city')
        zone_type = request.form.get('type')
        lat = request.form.get('lat')
        lng = request.form.get('lng')
        description = request.form.get('description')

        # Валидация координат
        try:
            lat = float(lat)
            lng = float(lng)
            if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
                flash('Некорректные координаты', 'danger')
                return redirect(url_for('add_zone'))
        except ValueError:
            flash('Некорректные координаты', 'danger')
            return redirect(url_for('add_zone'))

        conn = get_db()
        conn.execute('''
            INSERT INTO zone_requests (user_id, name, city, type, lat, lng, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (session['user']['id'], name, city, zone_type, lat, lng, description))

        conn.commit()
        conn.close()

        flash('Заявка на добавление зоны отправлена на рассмотрение', 'success')
        return redirect(url_for('index'))

    return render_template('add_zone.html',
                           cities=Config.CITIES,
                           zone_types=Config.ZONE_TYPES,
                           statuses=Config.STATUSES,
                           user=session.get('user'))


@app.route('/analytics')
def analytics():
    city = request.args.get('city', 'Барнаул')

    conn = get_db()

    # Проверяем существование города
    city_exists = \
    conn.execute('SELECT COUNT(*) as count FROM cities WHERE name = ? AND is_active = 1', (city,)).fetchone()['count']
    if not city_exists:
        default_city = conn.execute('SELECT name FROM cities WHERE is_active = 1 ORDER BY name LIMIT 1').fetchone()
        city = default_city['name'] if default_city else 'Барнаул'

    status_stats = conn.execute('''
        SELECT status, COUNT(*) as count 
        FROM zones 
        WHERE city = ? AND is_approved = 1
        GROUP BY status
    ''', (city,)).fetchall()

    type_stats = conn.execute('''
        SELECT type, COUNT(*) as count 
        FROM zones 
        WHERE city = ? AND is_approved = 1
        GROUP BY type
    ''', (city,)).fetchall()

    problem_stats = conn.execute('''
        SELECT problem_type, COUNT(*) as count 
        FROM problem_reports pr
        JOIN zones z ON pr.zone_id = z.id
        WHERE z.city = ? AND pr.status = 'new'
        GROUP BY problem_type
    ''', (city,)).fetchall()

    zones = conn.execute('SELECT * FROM zones WHERE city = ? AND is_approved = 1', (city,)).fetchall()
    zones_data = [row_to_dict(z) for z in zones]

    stats = calculate_zone_stats(zones_data)
    predictions = generate_predictions(zones_data)
    costs = estimate_maintenance_cost(zones_data, city)

    conn.close()

    cities, zone_types, statuses, problem_types = get_dictionaries()

    return render_template('analytics.html',
                           city=city,
                           cities=cities,
                           statuses=statuses,
                           zone_types=zone_types,
                           status_stats=[row_to_dict(s) for s in status_stats],
                           type_stats=[row_to_dict(t) for t in type_stats],
                           problem_stats=[row_to_dict(p) for p in problem_stats],
                           stats=stats,
                           predictions=predictions,
                           costs=costs,
                           user=session.get('user'))


@app.route('/api/analytics/data')
def get_analytics_data():
    city = request.args.get('city', 'Барнаул')

    conn = get_db()

    # Убрать статистику по месяцам

    # Статистика по статусам
    status_stats = conn.execute('''
        SELECT status, COUNT(*) as count 
        FROM zones 
        WHERE city = ? AND is_approved = 1
        GROUP BY status
    ''', (city,)).fetchall()

    # Преобразуем статусы в формат для графика
    status_counts = {}
    for stat in status_stats:
        status_counts[stat['status']] = stat['count']

    status_labels = ['отличный', 'хороший', 'удовлетворительный', 'требует ухода', 'критический']
    status_values = [status_counts.get(label, 0) for label in status_labels]

    # Статистика по типам зон
    type_stats = conn.execute('''
        SELECT type, COUNT(*) as count 
        FROM zones 
        WHERE city = ? AND is_approved = 1
        GROUP BY type
    ''', (city,)).fetchall()

    type_labels = [row['type'] for row in type_stats]
    type_values = [row['count'] for row in type_stats]

    # Статистика по типам проблем
    problem_stats = conn.execute('''
        SELECT problem_type, COUNT(*) as count 
        FROM problem_reports pr
        JOIN zones z ON pr.zone_id = z.id
        WHERE z.city = ? AND pr.status = 'new'
        GROUP BY problem_type
    ''', (city,)).fetchall()

    problem_labels = [row['problem_type'] for row in problem_stats]
    problem_values = [row['count'] for row in problem_stats]

    # Подсчет метрик
    zones = conn.execute('SELECT * FROM zones WHERE city = ? AND is_approved = 1', (city,)).fetchall()
    zones_data = [row_to_dict(z) for z in zones]
    stats = calculate_zone_stats(zones_data)

    conn.close()

    return jsonify({
        'metrics': {
            'total_zones': stats['total'],
            'good_zones': stats['good'],
            'problem_zones': stats['needs_care'] + stats['critical'],
            'maintenance_count': stats['problems_count']
        },
        'statusDistribution': {
            'labels': status_labels,
            'values': status_values
        },
        'typeDistribution': {
            'labels': type_labels,
            'values': type_values
        },
        'problemsByType': {
            'labels': problem_labels,
            'values': problem_values
        }
    })


@app.route('/api/analytics/detailed')
def get_detailed_stats():
    city = request.args.get('city', 'Барнаул')

    conn = get_db()

    # Статистика по зонам с реальными данными
    zones_stats = conn.execute('''
        SELECT 
            type,
            COUNT(*) as total,
            SUM(CASE WHEN status = 'отличный' THEN 1 ELSE 0 END) as excellent,
            SUM(CASE WHEN status = 'хороший' THEN 1 ELSE 0 END) as good,
            SUM(CASE WHEN status = 'удовлетворительный' THEN 1 ELSE 0 END) as satisfactory,
            SUM(CASE WHEN status = 'требует ухода' THEN 1 ELSE 0 END) as needs_care,
            SUM(CASE WHEN status = 'критический' THEN 1 ELSE 0 END) as critical
        FROM zones 
        WHERE city = ? AND is_approved = 1
        GROUP BY type
    ''', (city,)).fetchall()

    # Затраты на обслуживание
    zones = conn.execute('SELECT * FROM zones WHERE city = ? AND is_approved = 1', (city,)).fetchall()
    zones_data = [row_to_dict(z) for z in zones]
    costs = estimate_maintenance_cost(zones_data, city)

    conn.close()

    return jsonify({
        'zones': [row_to_dict(z) for z in zones_stats],
        'costs': costs
    })


@app.route('/api/analytics/predictions')
def get_predictions():
    city = request.args.get('city', 'Барнаул')

    conn = get_db()
    zones = conn.execute('SELECT * FROM zones WHERE city = ? AND is_approved = 1', (city,)).fetchall()
    zones_data = [row_to_dict(z) for z in zones]
    conn.close()

    predictions = generate_predictions(zones_data)
    costs = estimate_maintenance_cost(zones_data, city)

    # Подсчет прогнозов
    status_prediction = {
        'improve': len([p for p in predictions if p['priority'] == 'низкий']),
        'worsen': len([p for p in predictions if p['priority'] in ['высокий', 'критический']]),
        'stable': len([p for p in predictions if p['priority'] == 'средний']),
        'recommendation': 'Рекомендуется уделить внимание зонам с высоким приоритетом'
    }

    budget_prediction = {
        'monthly': costs['total_monthly'],
        'quarterly': costs['total_quarterly'],
        'annual': costs['total_annual'],
        'recommended': costs['total_monthly'] * 1.2  # +20% на непредвиденные расходы
    }

    recommendations = []
    for pred in predictions:
        if pred['priority'] in ['высокий', 'критический']:
            recommendations.append(f"Зона '{pred['zone_name']}': {pred['prediction']}")

    return jsonify({
        'status': status_prediction,
        'budget': budget_prediction,
        'recommendations': recommendations[:5]  # Первые 5 рекомендаций
    })


@app.route('/api/analytics/chart/<chart_type>')
def get_chart_data(chart_type):
    city = request.args.get('city', 'Барнаул')

    conn = get_db()

    if chart_type == 'problem-types':
        problem_stats = conn.execute('''
            SELECT problem_type, COUNT(*) as count 
            FROM problem_reports pr
            JOIN zones z ON pr.zone_id = z.id
            WHERE z.city = ? AND pr.status = 'new'
            GROUP BY problem_type
        ''', (city,)).fetchall()

        data = {
            'labels': [p['problem_type'] for p in problem_stats],
            'values': [p['count'] for p in problem_stats]
        }
    elif chart_type == 'maintenance-costs':
        # Расчет затрат по типам зон
        zone_types = conn.execute('''
            SELECT DISTINCT type FROM zones WHERE city = ? AND is_approved = 1
        ''', (city,)).fetchall()

        costs_by_type = []
        for zone_type in zone_types:
            zones = conn.execute('''
                SELECT * FROM zones WHERE city = ? AND type = ? AND is_approved = 1
            ''', (city, zone_type['type'])).fetchall()

            zones_data = [row_to_dict(z) for z in zones]
            cost = estimate_maintenance_cost(zones_data, city)
            costs_by_type.append({
                'type': zone_type['type'],
                'cost': cost['total_monthly']
            })

        data = {
            'labels': [c['type'] for c in costs_by_type],
            'values': [c['cost'] / 1000 for c in costs_by_type]  # в тысячах рублей
        }
    else:
        data = {'error': 'Invalid chart type'}

    conn.close()
    return jsonify(data)


@app.route('/api/admin/users')
def get_users():
    user = session.get('user')
    if not user or user.get('role') not in ['super_admin', 'junior_admin']:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db()
    users = conn.execute('SELECT * FROM users ORDER BY id').fetchall()
    conn.close()

    return jsonify([row_to_dict(u) for u in users])


@app.route('/api/admin/statistics')
def get_admin_statistics():
    user = session.get('user')
    if not user or user.get('role') not in ['super_admin', 'junior_admin', 'moderator']:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db()

    total_zones = conn.execute('SELECT COUNT(*) as count FROM zones').fetchone()['count']
    total_users = conn.execute('SELECT COUNT(*) as count FROM users').fetchone()['count']
    total_reports = conn.execute('SELECT COUNT(*) as count FROM problem_reports').fetchone()['count']
    active_problems = conn.execute('SELECT COUNT(*) as count FROM problem_reports WHERE status = "new"').fetchone()[
        'count']
    completed_maintenance = conn.execute('SELECT COUNT(*) as count FROM maintenance_logs').fetchone()['count']

    problems_by_type = conn.execute('''
        SELECT problem_type, COUNT(*) as count 
        FROM problem_reports 
        WHERE status = 'new' 
        GROUP BY problem_type
    ''').fetchall()

    zones_by_city = conn.execute('''
        SELECT city, COUNT(*) as count 
        FROM zones 
        GROUP BY city
    ''').fetchall()

    conn.close()

    return jsonify({
        'total_zones': total_zones,
        'total_users': total_users,
        'total_reports': total_reports,
        'active_problems': active_problems,
        'completed_maintenance': completed_maintenance,
        'problems_by_type': [row_to_dict(p) for p in problems_by_type],
        'zones_by_city': {row['city']: row['count'] for row in zones_by_city}
    })


# НОВЫЕ API ДЛЯ УПРАВЛЕНИЯ РОЛЯМИ ПОЛЬЗОВАТЕЛЕЙ
@app.route('/api/admin/promote-junior-admin/<int:user_id>', methods=['POST'])
def promote_junior_admin(user_id):
    user = session.get('user')
    if not user or user.get('role') != 'super_admin':
        return jsonify({'error': 'Требуются права супер-администратора'}), 401

    data = request.get_json()
    admin_password = data.get('admin_password')

    if not admin_password:
        return jsonify({'error': 'Требуется пароль администратора'}), 400

    # Проверяем пароль текущего супер-администратора
    conn = get_db()
    admin = conn.execute('SELECT * FROM users WHERE id = ?', (session['user']['id'],)).fetchone()

    from werkzeug.security import check_password_hash
    if not admin or not check_password_hash(admin['password_hash'], admin_password):
        conn.close()
        return jsonify({'error': 'Неверный пароль администратора'}), 401

    # Назначаем пользователя младшим администратором
    conn.execute('UPDATE users SET role = "junior_admin" WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Пользователь назначен младшим администратором'})


@app.route('/api/admin/promote-moderator/<int:user_id>', methods=['POST'])
def promote_moderator(user_id):
    user = session.get('user')
    if not user or user.get('role') not in ['super_admin', 'junior_admin']:
        return jsonify({'error': 'Требуются права администратора'}), 401

    data = request.get_json()
    admin_password = data.get('admin_password')

    # Для супер-администратора проверяем пароль
    if user.get('role') == 'super_admin':
        if not admin_password:
            return jsonify({'error': 'Требуется пароль администратора'}), 400

        conn = get_db()
        admin = conn.execute('SELECT * FROM users WHERE id = ?', (session['user']['id'],)).fetchone()

        from werkzeug.security import check_password_hash
        if not admin or not check_password_hash(admin['password_hash'], admin_password):
            conn.close()
            return jsonify({'error': 'Неверный пароль администратора'}), 401
    else:
        # Для младшего администратора не требуется пароль
        conn = get_db()

    # Назначаем пользователя модератором
    conn.execute('UPDATE users SET role = "moderator" WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Пользователь назначен модератором'})


@app.route('/api/admin/demote-user/<int:user_id>', methods=['POST'])
def demote_user(user_id):
    user = session.get('user')
    if not user or user.get('role') not in ['super_admin', 'junior_admin']:
        return jsonify({'error': 'Требуются права администратора'}), 401

    data = request.get_json()
    target_user_id = user_id
    current_user_role = user.get('role')

    conn = get_db()

    # Получаем информацию о целевом пользователе
    target_user = conn.execute('SELECT * FROM users WHERE id = ?', (target_user_id,)).fetchone()
    if not target_user:
        conn.close()
        return jsonify({'error': 'Пользователь не найден'}), 404

    target_role = target_user['role']

    # Проверяем права доступа
    if current_user_role == 'super_admin':
        # Супер-администратор может понижать всех, кроме других супер-администраторов
        if target_role == 'super_admin':
            conn.close()
            return jsonify({'error': 'Нельзя понизить другого супер-администратора'}), 403
        new_role = 'user'
    elif current_user_role == 'junior_admin':
        # Младший администратор может понижать только модераторов
        if target_role != 'moderator':
            conn.close()
            return jsonify({'error': 'Можно понижать только модераторов'}), 403
        new_role = 'user'
    else:
        conn.close()
        return jsonify({'error': 'Недостаточно прав'}), 403

    # Понижаем пользователя
    conn.execute('UPDATE users SET role = ? WHERE id = ?', (new_role, target_user_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Пользователь понижен до обычного пользователя'})


@app.route('/api/admin/delete-user/<int:user_id>', methods=['POST'])
def delete_user(user_id):
    user = session.get('user')
    if not user or user.get('role') != 'super_admin':
        return jsonify({'error': 'Требуются права супер-администратора'}), 401

    data = request.get_json()
    admin_password = data.get('admin_password')

    if not admin_password:
        return jsonify({'error': 'Требуется пароль администратора'}), 400

    # Проверяем пароль текущего супер-администратора
    conn = get_db()
    admin = conn.execute('SELECT * FROM users WHERE id = ?', (session['user']['id'],)).fetchone()

    from werkzeug.security import check_password_hash
    if not admin or not check_password_hash(admin['password_hash'], admin_password):
        conn.close()
        return jsonify({'error': 'Неверный пароль администратора'}), 401

    # Проверяем, не пытаемся ли удалить себя
    if user_id == session['user']['id']:
        conn.close()
        return jsonify({'error': 'Нельзя удалить свой собственный аккаунт'}), 400

    # Получаем информацию о пользователе
    target_user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not target_user:
        conn.close()
        return jsonify({'error': 'Пользователь не найден'}), 404

    # Проверяем, не пытаемся ли удалить другого супер-администратора
    if target_user['role'] == 'super_admin':
        conn.close()
        return jsonify({'error': 'Нельзя удалить другого супер-администратора'}), 403

    # Удаляем пользователя
    conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Пользователь удален'})


# Маршруты для управления зонами
@app.route('/api/admin/zone/<int:zone_id>', methods=['GET', 'PUT', 'DELETE'])
def manage_zone(zone_id):
    user = session.get('user')
    if not user or user.get('role') not in ['super_admin', 'junior_admin', 'moderator']:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db()

    if request.method == 'GET':
        zone = conn.execute('SELECT * FROM zones WHERE id = ?', (zone_id,)).fetchone()
        if not zone:
            conn.close()
            return jsonify({'error': 'Zone not found'}), 404
        conn.close()
        return jsonify(row_to_dict(zone))

    elif request.method == 'PUT':
        data = request.get_json()

        # Валидация координат
        try:
            lat = float(data.get('lat', 0))
            lng = float(data.get('lng', 0))
            if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
                return jsonify({'error': 'Некорректные координаты'}), 400
        except ValueError:
            return jsonify({'error': 'Некорректные координаты'}), 400

        conn.execute('''
            UPDATE zones SET 
                name = ?, 
                city = ?, 
                type = ?, 
                status = ?, 
                lat = ?, 
                lng = ?, 
                description = ? 
            WHERE id = ?
        ''', (
            data.get('name'),
            data.get('city'),
            data.get('type'),
            data.get('status'),
            lat,
            lng,
            data.get('description'),
            zone_id
        ))

        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Зона обновлена'})

    elif request.method == 'DELETE':
        user_role = user.get('role')
        # Только супер-администратор и младший администратор могут удалять зоны
        if user_role not in ['super_admin', 'junior_admin']:
            return jsonify({'error': 'Недостаточно прав для удаления зон'}), 403

        # Удаляем связанные записи
        conn.execute('DELETE FROM problem_reports WHERE zone_id = ?', (zone_id,))
        conn.execute('DELETE FROM maintenance_logs WHERE zone_id = ?', (zone_id,))
        conn.execute('DELETE FROM zones WHERE id = ?', (zone_id,))

        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Зона удалена'})

# Добавление зоны администратором/модератором
@app.route('/api/admin/add-zone', methods=['POST'])
def admin_add_zone():
    user = session.get('user')
    if not user or user.get('role') not in ['super_admin', 'junior_admin', 'moderator']:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()

    # Валидация обязательных полей
    required_fields = ['name', 'city', 'type', 'lat', 'lng']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'Не заполнено обязательное поле: {field}'}), 400

    # Валидация координат
    try:
        lat = float(data['lat'])
        lng = float(data['lng'])
        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return jsonify({'error': 'Некорректные координаты'}), 400
    except ValueError:
        return jsonify({'error': 'Некорректные координаты'}), 400

    conn = get_db()

    try:
        # Добавляем зону напрямую (без модерации)
        conn.execute('''
            INSERT INTO zones (name, city, type, status, lat, lng, description, created_by, is_approved)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        ''', (
            data['name'],
            data['city'],
            data['type'],
            data.get('status', 'удовлетворительный'),
            lat,
            lng,
            data.get('description'),
            session['user']['id']
        ))

        conn.commit()
        zone_id = conn.execute('SELECT last_insert_rowid() as id').fetchone()['id']
        conn.close()

        return jsonify({
            'success': True,
            'message': 'Зона успешно добавлена',
            'zone_id': zone_id
        })

    except Exception as e:
        conn.close()
        print(f"Ошибка добавления зоны: {e}")
        return jsonify({'error': f'Ошибка базы данных: {str(e)}'}), 500



# API для управления справочниками
@app.route('/api/dictionaries/<dict_type>')
def get_dictionary(dict_type):
    conn = get_db()

    if dict_type == 'cities':
        data = conn.execute('SELECT * FROM cities WHERE is_active = 1 ORDER BY name').fetchall()
    elif dict_type == 'zone_types':
        data = conn.execute('SELECT * FROM zone_types WHERE is_active = 1 ORDER BY name').fetchall()
    elif dict_type == 'statuses':
        data = conn.execute('SELECT * FROM zone_statuses WHERE is_active = 1 ORDER BY priority DESC').fetchall()
    elif dict_type == 'problem_types':
        data = conn.execute('SELECT * FROM problem_types WHERE is_active = 1 ORDER BY name').fetchall()
    else:
        conn.close()
        return jsonify({'error': 'Invalid dictionary type'}), 400

    conn.close()
    return jsonify([row_to_dict(row) for row in data])


@app.route('/api/admin/dictionaries/<dict_type>/<int:item_id>', methods=['PUT', 'DELETE'])
def manage_dictionary_item(dict_type, item_id):
    user = session.get('user')
    if not user or user.get('role') not in ['super_admin', 'junior_admin']:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db()

    table_map = {
        'cities': 'cities',
        'zone_types': 'zone_types',
        'statuses': 'zone_statuses',
        'problem_types': 'problem_types'
    }

    table = table_map.get(dict_type)
    if not table:
        conn.close()
        return jsonify({'error': 'Invalid dictionary type'}), 400

    if request.method == 'PUT':
        data = request.get_json()

        # Определяем поля для обновления в зависимости от таблицы
        if table == 'cities':
            conn.execute('''
                UPDATE cities SET name = ?, lat = ?, lng = ?, zoom = ?, is_active = ?
                WHERE id = ?
            ''', (data['name'], data['lat'], data['lng'], data['zoom'], data.get('is_active', 1), item_id))
        elif table == 'zone_statuses':
            conn.execute('''
                UPDATE zone_statuses SET name = ?, color = ?, icon = ?, priority = ?, is_active = ?
                WHERE id = ?
            ''', (data['name'], data['color'], data['icon'], data['priority'], data.get('is_active', 1), item_id))
        else:
            conn.execute(f'''
                UPDATE {table} SET name = ?, description = ?, is_active = ?
                WHERE id = ?
            ''', (data['name'], data.get('description'), data.get('is_active', 1), item_id))

        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Элемент обновлен'})

    elif request.method == 'DELETE':
        # Вместо удаления помечаем как неактивный
        conn.execute(f'UPDATE {table} SET is_active = 0 WHERE id = ?', (item_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Элемент деактивирован'})


@app.route('/api/admin/dictionaries/<dict_type>', methods=['POST'])
def add_dictionary_item(dict_type):
    user = session.get('user')
    if not user or user.get('role') not in ['super_admin', 'junior_admin']:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    conn = get_db()

    table_map = {
        'cities': 'cities',
        'zone_types': 'zone_types',
        'statuses': 'zone_statuses',
        'problem_types': 'problem_types'
    }

    table = table_map.get(dict_type)
    if not table:
        conn.close()
        return jsonify({'error': 'Invalid dictionary type'}), 400

    try:
        if table == 'cities':
            conn.execute('''
                INSERT INTO cities (name, lat, lng, zoom, is_active)
                VALUES (?, ?, ?, ?, ?)
            ''', (data['name'], data['lat'], data['lng'], data['zoom'], data.get('is_active', 1)))
        elif table == 'zone_statuses':
            conn.execute('''
                INSERT INTO zone_statuses (name, color, icon, priority, is_active)
                VALUES (?, ?, ?, ?, ?)
            ''', (data['name'], data['color'], data['icon'], data['priority'], data.get('is_active', 1)))
        else:
            conn.execute(f'''
                INSERT INTO {table} (name, description, is_active)
                VALUES (?, ?, ?)
            ''', (data['name'], data.get('description'), data.get('is_active', 1)))

        conn.commit()
        item_id = conn.execute('SELECT last_insert_rowid() as id').fetchone()['id']
        conn.close()

        return jsonify({'success': True, 'message': 'Элемент добавлен', 'id': item_id})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Элемент с таким именем уже существует'}), 400


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)