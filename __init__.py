from app import app

# Импортируем Blueprint после создания app
from auth import auth_bp

app.register_blueprint(auth_bp, url_prefix='/auth')

# Переименуем основную функцию
from app import index as main_index
app.add_url_rule('/', 'main.index', main_index)
app.add_url_rule('/<path:path>', 'main.index', main_index)