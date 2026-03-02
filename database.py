# database.py (изменённый)
import sqlite3
import json
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config
import os

def get_db():
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(force=False):
    db_dir = os.path.dirname(Config.DATABASE_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir)
    conn = get_db()
    needs_init = force
    if not force:
        try:
            cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            table_names = [table['name'] for table in tables]
            required_tables = [
                'users', 'cities', 'zone_types', 'zone_statuses',
                'problem_types', 'zones', 'problem_reports',
                'zone_requests', 'maintenance_logs'
            ]
            needs_init = not all(table in table_names for table in required_tables)
            if needs_init:
                print("✓ Не все таблицы существуют, выполняем инициализацию...")
            else:
                print(f"✓ База данных уже существует с {len(tables)} таблицами")
                print(f"✓ Таблицы: {', '.join(sorted(table_names))}")
        except Exception as e:
            print(f"✓ Ошибка проверки таблиц: {e}")
            needs_init = True
    if needs_init or force:
        print(f"✓ Выполняется инициализация базы данных...")
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                city TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS cities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                zoom INTEGER DEFAULT 12,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS zone_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                icon TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS zone_statuses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                color TEXT NOT NULL,
                icon TEXT,
                priority INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                is_default BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS problem_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS zone_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                city TEXT NOT NULL,
                type TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS zones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                city TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                created_by INTEGER NOT NULL,
                is_approved BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_maintenance TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users (id)
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS problem_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                zone_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                problem_type TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT DEFAULT 'new',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP,
                FOREIGN KEY (zone_id) REFERENCES zones (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS zone_request_photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                mime_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES zone_requests (id) ON DELETE CASCADE
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS maintenance_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                zone_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                action_type TEXT NOT NULL,
                description TEXT NOT NULL,
                cost REAL,
                duration_minutes INTEGER,
                performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (zone_id) REFERENCES zones (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        print("✓ Структура базы данных создана")
        fill_initial_data(conn)
    conn.commit()
    conn.close()
    print("✓ База данных готова к работе")

def fill_initial_data(conn):
    cities_data = [
        ('Барнаул', 53.347996, 83.779836, 12),
        ('Бийск', 52.5181, 85.2072, 12),
        ('Рубцовск', 51.5147, 81.2064, 12),
        ('Котельниково', 47.6316, 43.1461, 13),
        ('Ленинск-Кузнецкий', 54.6565, 86.1737, 13),
        ('Полысаево', 54.6056, 86.2809, 13),
        ('Прокопьевск', 53.8606, 86.7183, 12),
        ('Мыски', 53.7125, 87.8056, 13),
        ('Кемерово', 55.3547, 86.0873, 12),
        ('Бородино', 55.9056, 94.9025, 13),
        ('Назарово', 56.0064, 90.3914, 13),
        ('Шарыпово', 55.5278, 89.2000, 13),
        ('Ковдор', 67.5667, 30.4667, 13),
        ('Кингисепп', 59.3769, 28.6111, 13),
        ('Березники', 59.4081, 56.8056, 12),
        ('Усолье', 59.4167, 56.6833, 13),
        ('Абакан', 53.7167, 91.4167, 12),
        ('Черногорск', 53.8236, 91.2842, 13),
        ('Рефтинский', 57.1167, 61.6833, 13),
        ('Чегдомын', 51.1167, 133.0333, 13)
    ]
    for city in cities_data:
        conn.execute('''
            INSERT OR IGNORE INTO cities (name, lat, lng, zoom)
            VALUES (?, ?, ?, ?)
        ''', city)
    zone_types_data = [
        ('Парк', '🌳'),
        ('Сквер', '🌿'),
        ('Газон', '🌱'),
        ('Сад', '🌸'),
        ('Лесопарк', '🌲'),
        ('Бульвар', '🌳'),
        ('Аллея', '🌲'),
        ('Спортивная площадка', '⚽'),
        ('Детская площадка', '🧸'),
        ('Площадь', '🏛️')
    ]
    for zone_type, icon in zone_types_data:
        conn.execute('''
            INSERT OR IGNORE INTO zone_types (name, icon)
            VALUES (?, ?)
        ''', (zone_type, icon))
    statuses_data = [
        ('Отличный', '#4caf50', '🟢', 5, 1),
        ('Хороший', '#8bc34a', '🟢', 4, 1),
        ('Удовлетворительный', '#ffeb3b', '🟡', 3, 1),
        ('Требует ухода', '#ff9800', '🟠', 2, 1),
        ('Критический', '#f44336', '🔴', 1, 1)
    ]
    for status in statuses_data:
        conn.execute('''
            INSERT OR IGNORE INTO zone_statuses (name, color, icon, priority, is_default)
            VALUES (?, ?, ?, ?, ?)
        ''', status)
    problem_types_data = [
        'Полив', 'Обрезка', 'Уборка', 'Ремонт', 'Посадка',
        'Освещение', 'Безопасность', 'Другое'
    ]
    for problem_type in problem_types_data:
        conn.execute('''
            INSERT OR IGNORE INTO problem_types (name)
            VALUES (?)
        ''', (problem_type,))
    admin_email = 'admin@ecopulse.ru'
    admin_password = 'Admin123!'
    cursor = conn.execute('SELECT * FROM users WHERE email = ?', (admin_email,))
    if not cursor.fetchone():
        conn.execute('''
            INSERT INTO users (email, password_hash, name, role)
            VALUES (?, ?, ?, ?)
        ''', (admin_email, generate_password_hash(admin_password), 'Главный Администратор', 'super_admin'))
        print(f"✓ Создан супер-администратор: {admin_email} / {admin_password}")
    else:
        cursor = conn.execute(
            'UPDATE users SET role = "super_admin", name = "Главный Администратор" WHERE email = ?',
            (admin_email,)
        )
        if cursor.rowcount > 0:
            print(f"✓ Администратор обновлен до супер-администратора: {admin_email}")
    cursor = conn.execute('SELECT COUNT(*) as count FROM zones')
    zones_count = cursor.fetchone()['count']
    if zones_count == 0:
        print("✓ Добавляем начальные данные зон")
        all_test_zones = [
            ('Тестовая Зона', 'Барнаул', 'Парк', 'Удовлетворительный', 53.347996, 83.779836, 1),
        ]
        zones_added = 0
        for zone in all_test_zones:
            try:
                conn.execute('''
                    INSERT INTO zones (
                        name, city, type, status, lat, lng, created_by, is_approved
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                ''', zone)
                zones_added += 1
            except sqlite3.IntegrityError as e:
                print(f"  Ошибка при добавлении зоны {zone[0]}: {e}")
                continue
        print(f"✓ Добавлены начальные зоны: {zones_added} зон")
    else:
        print(f"✓ В базе уже есть {zones_count} зон")
    test_users = [
        ('user1@ecopulse.ru', 'User123!', 'Иван Петров', 'user', 'Барнаул'),
        ('user2@ecopulse.ru', 'User123!', 'Мария Сидорова', 'user', 'Бийск'),
        ('user3@ecopulse.ru', 'User123!', 'Алексей Иванов', 'user', 'Прокопьевск'),
        ('moderator@ecopulse.ru', 'Moder123!', 'Модератор Системы', 'moderator', 'Москва'),
        ('junior_admin@ecopulse.ru', 'Junior123!', 'Младший Администратор', 'junior_admin', 'Москва'),
    ]
    users_added = 0
    for email, password, name, role, city in test_users:
        cursor = conn.execute('SELECT * FROM users WHERE email = ?', (email,))
        if not cursor.fetchone():
            conn.execute('''
                INSERT INTO users (email, password_hash, name, role, city)
                VALUES (?, ?, ?, ?, ?)
            ''', (email, generate_password_hash(password), name, role, city))
            users_added += 1
            print(f"✓ Создан пользователь: {email}")
    if users_added > 0:
        print(f"✓ Создано {users_added} тестовых пользователей")

def check_database_exists():
    return os.path.exists(Config.DATABASE_PATH)

def backup_database():
    if check_database_exists():
        import shutil
        import time
        backup_file = f"{Config.DATABASE_PATH}.backup.{int(time.time())}"
        shutil.copy2(Config.DATABASE_PATH, backup_file)
        print(f"✓ Резервная копия создана: {backup_file}")
        return backup_file
    return None