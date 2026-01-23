import hashlib
import json
from datetime import datetime, timedelta
from config import Config


def hash_password(password):
    """Хеширование пароля (используется werkzeug.security вместо этого)"""
    return hashlib.sha256(password.encode()).hexdigest()


def validate_email(email):
    """Валидация email"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def get_status_color(status):
    """Получение цвета для статуса"""
    colors = {
        'отличный': '#4caf50',
        'хороший': '#8bc34a',
        'удовлетворительный': '#ffeb3b',
        'требует ухода': '#ff9800',
        'критический': '#f44336'
    }
    return colors.get(status, '#4caf50')


def get_type_icon(zone_type):
    """Получение иконки для типа зоны"""
    icons = {
        'парк': '🏞️',
        'сквер': '🌳',
        'газон': '🌿',
        'сад': '🏵️',
        'лесопарк': '🌲',
        'бульвар': '🌴',
        'аллея': '🍃',
        'спортивная площадка': '⚽',
        'детская площадка': '🛝'
    }
    return icons.get(zone_type, '📍')


def format_date(date_string):
    """Форматирование даты"""
    if not date_string:
        return ''
    try:
        if isinstance(date_string, str):
            # Пробуем разные форматы
            formats = ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d']
            for fmt in formats:
                try:
                    date_obj = datetime.strptime(date_string, fmt)
                    return date_obj.strftime('%d.%m.%Y %H:%M')
                except:
                    continue
        elif isinstance(date_string, datetime):
            return date_string.strftime('%d.%m.%Y %H:%M')
    except:
        pass
    return str(date_string)


def calculate_zone_stats(zones):
    """Расчет статистики по зонам"""
    total = len(zones)
    if total == 0:
        return {
            'total': 0,
            'good': 0,
            'needs_care': 0,
            'critical': 0,
            'good_percent': 0,
            'problems_count': 0
        }

    good_count = sum(1 for z in zones if z.get('status') in ['отличный', 'хороший'])
    needs_care_count = sum(1 for z in zones if z.get('status') == 'требует ухода')
    critical_count = sum(1 for z in zones if z.get('status') == 'критический')
    problems_count = sum(z.get('problems_count', 0) for z in zones)

    return {
        'total': total,
        'good': good_count,
        'needs_care': needs_care_count,
        'critical': critical_count,
        'good_percent': int((good_count / total) * 100) if total > 0 else 0,
        'problems_count': problems_count
    }


def generate_predictions(zones_data):
    """Генерация прогнозов по состоянию зон"""
    predictions = []

    for zone in zones_data:
        status = zone.get('status', 'удовлетворительный')
        last_maintenance = zone.get('last_maintenance')
        problems_count = zone.get('problems_count', 0)

        # Простой алгоритм прогнозирования
        if status in ['отличный', 'хороший']:
            if problems_count == 0:
                prediction = 'Стабильное состояние на ближайший месяц'
                priority = 'низкий'
            else:
                prediction = 'Требуется профилактика в течение 2 недель'
                priority = 'средний'
        elif status == 'требует ухода':
            prediction = 'Требуется вмешательство в течение недели'
            priority = 'высокий'
        else:  # критический
            prediction = 'Срочное вмешательство требуется'
            priority = 'критический'

        predictions.append({
            'zone_name': zone.get('name', 'Неизвестная зона'),
            'current_status': status,
            'prediction': prediction,
            'priority': priority,
            'recommended_actions': get_recommended_actions(status, problems_count)
        })

    return predictions


def get_recommended_actions(status, problems_count):
    """Получение рекомендованных действий"""
    actions = []

    if status in ['требует ухода', 'критический']:
        actions.append('Провести осмотр территории')
        actions.append('Составить план восстановительных работ')

    if problems_count > 0:
        actions.append('Рассмотреть активные проблемы')

    if status == 'критический':
        actions.append('Выделить дополнительные ресурсы')
        actions.append('Уведомить ответственных лиц')

    if not actions:
        actions.append('Плановое обслуживание не требуется')

    return actions


def estimate_maintenance_cost(zones, city):
    """Оценка затрат на обслуживание"""
    cost_per_hectare = {
        'отличный': 5000,  # руб/га в месяц
        'хороший': 7500,
        'удовлетворительный': 10000,
        'требует ухода': 15000,
        'критический': 25000
    }

    total_cost = 0
    detailed_costs = []

    for zone in zones:
        if zone.get('city') == city:
            area = parse_area(zone.get('area', '0 га'))
            status = zone.get('status', 'удовлетворительный')
            cost = area * cost_per_hectare.get(status, 10000)
            total_cost += cost

            detailed_costs.append({
                'name': zone.get('name', 'Неизвестная зона'),
                'area': area,
                'status': status,
                'monthly_cost': cost,
                'quarterly_cost': cost * 3,
                'annual_cost': cost * 12
            })

    return {
        'total_monthly': total_cost,
        'total_quarterly': total_cost * 3,
        'total_annual': total_cost * 12,
        'detailed': detailed_costs
    }


def parse_area(area_string):
    """Парсинг строки с площадью"""
    if not area_string:
        return 1.0

    try:
        # Приводим к строке и удаляем пробелы
        area_str = str(area_string).strip().lower()

        # Удаляем все нечисловые символы кроме точки и запятой
        import re
        clean_str = re.sub(r'[^\d.,]', '', area_str)

        # Заменяем запятую на точку
        clean_str = clean_str.replace(',', '.')

        # Парсим число
        area = float(clean_str)

        # Если в исходной строке было "га" или "гектар", оставляем как есть
        # Если было "м²" или "м2", делим на 10000
        if any(x in area_str for x in ['м²', 'м2', 'кв.м', 'кв м']):
            area = area / 10000

        return max(area, 0.1)  # Минимальная площадь 0.1 га

    except:
        return 1.0  # значение по умолчанию