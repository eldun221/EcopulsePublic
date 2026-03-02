# __init__.py
from app import app

# Регистрация blueprint для аутентификации с префиксом /auth
from auth import auth_bp
app.register_blueprint(auth_bp, url_prefix='/auth')

# Импорт основной функции и добавление маршрутов для главной страницы
from app import index as main_index
app.add_url_rule('/', 'main.index', main_index)
app.add_url_rule('/<path:path>', 'main.index', main_index)