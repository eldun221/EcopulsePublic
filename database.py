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
    """
    Инициализация базы данных
    force: принудительное создание таблиц (для миграций)
    """
    # Создаем директорию для базы данных, если её нет
    db_dir = os.path.dirname(Config.DATABASE_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir)

    conn = get_db()
    needs_init = force

    if not force:
        # Проверяем существование таблиц
        try:
            cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            table_names = [table['name'] for table in tables]

            # Основные таблицы, которые должны существовать
            required_tables = ['users', 'cities', 'zone_types', 'zone_statuses',
                               'problem_types', 'zones', 'problem_reports',
                               'zone_requests', 'maintenance_logs']

            # Если отсутствует хотя бы одна обязательная таблица, инициализируем
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

        # Пользователи
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

        # Таблица городов
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

        # Таблица типов зон
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

        # Таблица статусов зон
        conn.execute('''
            CREATE TABLE IF NOT EXISTS zone_statuses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                color TEXT NOT NULL,
                icon TEXT,
                priority INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Таблица типов проблем
        conn.execute('''
            CREATE TABLE IF NOT EXISTS problem_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Заявки на добавление зон
        conn.execute('''
            CREATE TABLE IF NOT EXISTS zone_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                city TEXT NOT NULL,
                type TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Таблица зон
        conn.execute('''
            CREATE TABLE IF NOT EXISTS zones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                city TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                area TEXT,
                description TEXT,
                created_by INTEGER NOT NULL,
                is_approved BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_maintenance TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users (id)
            )
        ''')

        # Отчёты о проблемах
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

        # Журнал обслуживания
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

        # Заполняем справочные данные (используем INSERT OR IGNORE для избежания дубликатов)
        fill_initial_data(conn)

    conn.commit()
    conn.close()
    print("✓ База данных готова к работе")


def fill_initial_data(conn):
    """Заполнение начальных данных справочников"""

    # Заполняем города
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

    # Заполняем типы зон (добавлен "площадь")
    zone_types_data = [
        ('парк', '🌳'),
        ('сквер', '🌿'),
        ('газон', '🌱'),
        ('сад', '🌸'),
        ('лесопарк', '🌲'),
        ('бульвар', '🌳'),
        ('аллея', '🌲'),
        ('спортивная площадка', '⚽'),
        ('детская площадка', '🧸'),
        ('площадь', '🏛️')
    ]
    for zone_type, icon in zone_types_data:
        conn.execute('''
            INSERT OR IGNORE INTO zone_types (name, icon)
            VALUES (?, ?)
        ''', (zone_type, icon))

    # Заполняем статусы
    statuses_data = [
        ('отличный', '#4caf50', '🟢', 5),
        ('хороший', '#8bc34a', '🟢', 4),
        ('удовлетворительный', '#ffeb3b', '🟡', 3),
        ('требует ухода', '#ff9800', '🟠', 2),
        ('критический', '#f44336', '🔴', 1)
    ]

    for status in statuses_data:
        conn.execute('''
            INSERT OR IGNORE INTO zone_statuses (name, color, icon, priority)
            VALUES (?, ?, ?, ?)
        ''', status)

    # Заполняем типы проблем
    problem_types_data = ['полив', 'обрезка', 'уборка', 'ремонт', 'посадка', 'освещение', 'безопасность', 'другое']
    for problem_type in problem_types_data:
        conn.execute('''
            INSERT OR IGNORE INTO problem_types (name)
            VALUES (?)
        ''', (problem_type,))

    # Создаём супер-администратора, если его нет
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
        # Обновляем существующего администратора до супер-администратора
        cursor = conn.execute('UPDATE users SET role = "super_admin", name = "Главный Администратор" WHERE email = ?',
                              (admin_email,))
        if cursor.rowcount > 0:
            print(f"✓ Администратор обновлен до супер-администратора: {admin_email}")

    # Проверяем, есть ли уже зоны в базе
    cursor = conn.execute('SELECT COUNT(*) as count FROM zones')
    zones_count = cursor.fetchone()['count']

    if zones_count == 0:
        print("✓ Добавляем начальные данные зон")

        # РЕАЛЬНЫЕ парки и скверы с точными координатами из OpenStreetMap/Google Maps
        all_test_zones = [
            # Барнаул - РЕАЛЬНЫЕ координаты
            ('Парк "Лесной" (Центральный парк)', 'Барнаул', 'парк', 'отличный', 53.3600, 83.7633,
             '15 га', 'Центральный парк культуры и отдыха', 1),
            ('Набережная реки Обь', 'Барнаул', 'бульвар', 'хороший', 53.3478, 83.7756,
             '8 га', 'Благоустроенная набережная', 1),
            ('Парк "Изумрудный"', 'Барнаул', 'парк', 'хороший', 53.3739, 83.7528,
             '12 га', 'Парк в жилом районе', 1),
            ('Сквер у театра драмы', 'Барнаул', 'сквер', 'отличный', 53.3561, 83.7622,
             '2 га', 'Сквер у Алтайского театра драмы', 1),

            # Бийск - РЕАЛЬНЫЕ координаты
            ('Парк культуры и отдыха', 'Бийск', 'парк', 'хороший', 52.5150, 85.2100,
             '10 га', 'Главный парк города', 1),
            ('Сквер им. Гаркавого', 'Бийск', 'сквер', 'отличный', 52.5183, 85.2139,
             '3 га', 'Мемориальный сквер', 1),

            # Рубцовск - РЕАЛЬНЫЕ координаты
            ('Парк им. С.М. Кирова', 'Рубцовск', 'парк', 'хороший', 51.5167, 81.2000,
             '8 га', 'Центральный парк города', 1),
            ('Сквер Победы', 'Рубцовск', 'сквер', 'отличный', 51.5200, 81.2033,
             '2 га', 'Мемориальный сквер', 1),

            # Котельниково - координаты центра города + смещение
            ('Парк Победы', 'Котельниково', 'парк', 'хороший', 47.6314, 43.1461,
             '5 га', 'Центральный парк', 1),

            # Ленинск-Кузнецкий - РЕАЛЬНЫЕ координаты
            ('Городской парк', 'Ленинск-Кузнецкий', 'парк', 'хороший', 54.6569, 86.1736,
             '12 га', 'Парк культуры и отдыха', 1),
            ('Сквер Шахтеров', 'Ленинск-Кузнецкий', 'сквер', 'отличный', 54.6533, 86.1700,
             '3 га', 'Мемориальный сквер', 1),

            # Полысаево - координаты центра
            ('Парк "Юбилейный"', 'Полысаево', 'парк', 'хороший', 54.6000, 86.2833,
             '4 га', 'Городской парк', 1),

            # Прокопьевск - РЕАЛЬНЫЕ координаты
            ('Парк культуры и отдыха', 'Прокопьевск', 'парк', 'отличный', 53.8833, 86.7167,
             '20 га', 'Крупнейший парк города', 1),
            ('Детский парк "Чайка"', 'Прокопьевск', 'парк', 'хороший', 53.8800, 86.7133,
             '5 га', 'Детский развлекательный парк', 1),

            # Мыски - координаты центра
            ('Городской парк', 'Мыски', 'парк', 'хороший', 53.7000, 87.8167,
             '8 га', 'Парк культуры и отдыха', 1),

            # Бородино - РЕАЛЬНЫЕ координаты
            ('Парк Победы', 'Бородино', 'парк', 'отличный', 55.9000, 94.9000,
             '6 га', 'Мемориальный парк', 1),

            # Назарово - РЕАЛЬНЫЕ координаты
            ('Городской парк', 'Назарово', 'парк', 'хороший', 56.0000, 90.4000,
             '7 га', 'Парк культуры и отдыха', 1),

            # Шарыпово - РЕАЛЬНЫЕ координаты
            ('Парк культуры и отдыха', 'Шарыпово', 'парк', 'хороший', 55.5333, 89.2000,
             '9 га', 'Основной парк города', 1),

            # Ковдор - РЕАЛЬНЫЕ координаты
            ('Городской парк', 'Ковдор', 'парк', 'хороший', 67.5667, 30.4667,
             '5 га', 'Парк в заполярном городе', 1),

            # Кингисепп - РЕАЛЬНЫЕ координаты
            ('Парк "Роща"', 'Кингисепп', 'парк', 'отличный', 59.3733, 28.6133,
             '8 га', 'Исторический парк', 1),

            # Березники - РЕАЛЬНЫЕ координаты
            ('Парк культуры и отдыха', 'Березники', 'парк', 'хороший', 59.4167, 56.8000,
             '15 га', 'Центральный парк', 1),

            # Усолье - РЕАЛЬНЫЕ координаты
            ('Строгановские сады', 'Усолье', 'парк', 'отличный', 59.4167, 56.6833,
             '6 га', 'Исторический парк', 1),

            # Абакан - РЕАЛЬНЫЕ координаты
            ('Парк топиарного искусства', 'Абакан', 'парк', 'отличный', 53.7167, 91.4333,
             '10 га', 'Парк с фигурами из растений', 1),
            ('Парк "Орлёнок"', 'Абакан', 'парк', 'хороший', 53.7133, 91.4300,
             '8 га', 'Детский парк', 1),

            # Черногорск - РЕАЛЬНЫЕ координаты
            ('Городской парк', 'Черногорск', 'парк', 'хороший', 53.8167, 91.2833,
             '7 га', 'Парк культуры и отдыха', 1),

            # Рефтинский - РЕАЛЬНЫЕ координаты
            ('Парк у водохранилища', 'Рефтинский', 'парк', 'отличный', 57.1167, 61.6667,
             '5 га', 'Парк на берегу водохранилища', 1),

            # Чегдомын - РЕАЛЬНЫЕ координаты
            ('Парк Горняков', 'Чегдомын', 'парк', 'хороший', 51.1167, 133.0167,
             '4 га', 'Парк в шахтерском поселке', 1),
        ]

        # Добавляем все зоны
        zones_added = 0
        for zone in all_test_zones:
            try:
                conn.execute('''
                    INSERT INTO zones (name, city, type, status, lat, lng, area, description, created_by, is_approved)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                ''', zone)
                zones_added += 1
            except sqlite3.IntegrityError as e:
                print(f"  Ошибка при добавлении зоны {zone[0]}: {e}")
                continue

        print(f"✓ Добавлены начальные зоны: {zones_added} зон")
    else:
        print(f"✓ В базе уже есть {zones_count} зон")

    # Создаем дополнительных тестовых пользователей (только если их нет)
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
    """Проверка существования базы данных"""
    return os.path.exists(Config.DATABASE_PATH)


def backup_database():
    """Создание резервной копии базы данных"""
    if check_database_exists():
        import shutil
        import time
        backup_file = f"{Config.DATABASE_PATH}.backup.{int(time.time())}"
        shutil.copy2(Config.DATABASE_PATH, backup_file)
        print(f"✓ Резервная копия создана: {backup_file}")
        return backup_file
    return None