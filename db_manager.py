#!/usr/bin/env python3
"""
Менеджер базы данных ЭКОПУЛЬС
Использование: python db_manager.py [команда]
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, backup_database, check_database_exists, get_db
from config import Config

# Выводит справку по командам
def show_help():
    print("""
Менеджер базы данных ЭКОПУЛЬС
=============================

Доступные команды:
  init     - Инициализировать/обновить базу данных
  backup   - Создать резервную копию базы данных
  status   - Показать статус базы данных
  stats    - Показать статистику базы данных
  help     - Показать эту справку

Примеры:
  python db_manager.py init     # Инициализировать базу данных
  python db_manager.py backup   # Создать резервную копию
  python db_manager.py status   # Показать статус
    """)

# Показывает статус базы данных (существует, размер, таблицы)
def show_status():
    if check_database_exists():
        print(f"✓ База данных существует: {Config.DATABASE_PATH}")
        size = os.path.getsize(Config.DATABASE_PATH)
        size_mb = size / (1024 * 1024)
        print(f"✓ Размер файла: {size_mb:.2f} MB")
        conn = get_db()
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        conn.close()
        print(f"✓ Количество таблиц: {len(tables)}")
        print("✓ Таблицы:", ", ".join(sorted([table['name'] for table in tables])))
    else:
        print(f"✗ База данных не существует: {Config.DATABASE_PATH}")
        print("  Используйте команду 'init' для создания базы данных")

# Показывает статистику по записям в таблицах
def show_stats():
    if not check_database_exists():
        print("✗ База данных не существует")
        return
    conn = get_db()
    print("Статистика базы данных:")
    print("-" * 30)
    tables = ['users', 'cities', 'zones', 'problem_reports', 'zone_requests', 'maintenance_logs']
    for table in tables:
        try:
            cursor = conn.execute(f'SELECT COUNT(*) as count FROM {table}')
            count = cursor.fetchone()['count']
            print(f"  {table:20} : {count:5} записей")
        except:
            print(f"  {table:20} : таблица не существует")
    conn.close()

# Основная функция, обрабатывающая аргументы командной строки
def main():
    if len(sys.argv) < 2:
        show_help()
        return
    command = sys.argv[1].lower()
    if command == 'init':
        print("Инициализация базы данных...")
        init_db(force=True)
        print("✓ Инициализация завершена")
    elif command == 'backup':
        print("Создание резервной копии...")
        backup_file = backup_database()
        if backup_file:
            print(f"✓ Резервная копия создана: {backup_file}")
        else:
            print("✗ Не удалось создать резервную копию")
    elif command == 'status':
        show_status()
    elif command == 'stats':
        show_stats()
    elif command == 'help':
        show_help()
    else:
        print(f"✗ Неизвестная команда: {command}")
        show_help()

if __name__ == '__main__':
    main()