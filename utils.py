# utils.py (изменённый)
import hashlib
import json
from datetime import datetime, timedelta
from config import Config

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def validate_email(email):
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def get_status_color(status):
    colors = {
        'Отличный': '#4caf50',
        'Хороший': '#8bc34a',
        'Удовлетворительный': '#ffeb3b',
        'Требует ухода': '#ff9800',
        'Критический': '#f44336'
    }
    return colors.get(status, '#4caf50')

def get_type_icon(zone_type):
    icons = {
        'Парк': '🏞️',
        'Сквер': '🌳',
        'Газон': '🌿',
        'Сад': '🏵️',
        'Лесопарк': '🌲',
        'Бульвар': '🌴',
        'Аллея': '🍃',
        'Спортивная площадка': '⚽',
        'Детская площадка': '🛝',
        'Площадь': '🏛️'
    }
    return icons.get(zone_type, '📍')

def format_date(date_string):
    if not date_string:
        return ''
    try:
        if isinstance(date_string, str):
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
    good_count = sum(1 for z in zones if z.get('status') in ['Отличный', 'Хороший'])
    needs_care_count = sum(1 for z in zones if z.get('status') == 'Требует ухода')
    critical_count = sum(1 for z in zones if z.get('status') == 'Критический')
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
    predictions = []
    for zone in zones_data:
        status = zone.get('status', 'Удовлетворительный')
        problems_count = zone.get('problems_count', 0)
        if status in ['Отличный', 'Хороший']:
            if problems_count == 0:
                prediction = 'Стабильное состояние на ближайший месяц'
                priority = 'низкий'
            else:
                prediction = 'Требуется профилактика в течение 2 недель'
                priority = 'средний'
        elif status == 'Требует ухода':
            prediction = 'Требуется вмешательство в течение недели'
            priority = 'высокий'
        else:
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
    actions = []
    if status in ['Требует ухода', 'Критический']:
        actions.append('Провести осмотр территории')
        actions.append('Составить план восстановительных работ')
    if problems_count > 0:
        actions.append('Рассмотреть активные проблемы')
    if status == 'Критический':
        actions.append('Выделить дополнительные ресурсы')
        actions.append('Уведомить ответственных лиц')
    if not actions:
        actions.append('Плановое обслуживание не требуется')
    return actions

# Оценивает ежемесячные, квартальные и годовые затраты на обслуживание зон
def estimate_maintenance_cost(zones, city):
    cost_per_hectare = {
        'Отличный': 5000,
        'Хороший': 7500,
        'Удовлетворительный': 10000,
        'Требует ухода': 15000,
        'Критический': 25000
    }
    total_cost = 0
    detailed_costs = []
    for zone in zones:
        if zone.get('city') == city:
            area = parse_area(zone.get('area', '0 га'))
            status = zone.get('status', 'Удовлетворительный')
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

# Преобразует строку с площадью (например, "15 га") в число гектаров
def parse_area(area_string):
    if not area_string:
        return 1.0
    try:
        area_str = str(area_string).strip().lower()
        import re
        clean_str = re.sub(r'[^\d.,]', '', area_str)
        clean_str = clean_str.replace(',', '.')
        area = float(clean_str)
        if any(x in area_str for x in ['м²', 'м2', 'кв.м', 'кв м']):
            area = area / 10000
        return max(area, 0.1)
    except:
        return 1.0