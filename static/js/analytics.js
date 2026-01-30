// static/js/analytics.js
// Цвета для светлой и темной темы
const chartColors = {
    light: {
        excellent: '#4caf50',
        good: '#8bc34a',
        satisfactory: '#ffeb3b',
        needsCare: '#ff9800',
        critical: '#f44336',
        primary: '#2e7d32',
        secondary: '#81c784',
        accent: '#8bc34a',
        blue: '#2196f3',
        purple: '#9c27b0',
        gray: '#607d8b'
    },
    dark: {
        excellent: '#388e3c',
        good: '#689f38',
        satisfactory: '#fbc02d',
        needsCare: '#f57c00',
        critical: '#d32f2f',
        primary: '#4caf50',
        secondary: '#81c784',
        accent: '#8bc34a',
        blue: '#1976d2',
        purple: '#7b1fa2',
        gray: '#455a64'
    }
};

// Получение текущей цветовой схемы
function getChartColors() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    return isDarkMode ? chartColors.dark : chartColors.light;
}

class AnalyticsDashboard {
    constructor() {
        this.charts = {};
        this.currentCity = document.getElementById('analytics-city')?.value || window.currentCity || '{{ city }}';
        this.currentPeriod = 'month';
        this.initialize();
    }

    initialize() {
        this.setupEventListeners();
        this.loadAnalyticsData();
        this.loadPredictions();
        this.loadDetailedStats();
    }

    setupEventListeners() {
        // Город селектор
        const citySelect = document.getElementById('analytics-city');
        if (citySelect) {
            citySelect.addEventListener('change', () => {
                this.currentCity = citySelect.value;
                this.reloadAllData();
            });
        }

        // Период селектор
        const periodSelect = document.getElementById('analytics-period');
        if (periodSelect) {
            periodSelect.addEventListener('change', () => {
                this.currentPeriod = periodSelect.value;
                this.reloadAllData();
            });
        }

        // Кнопка генерации отчета
        const generateReportBtn = document.getElementById('generate-report');
        if (generateReportBtn) {
            generateReportBtn.addEventListener('click', () => {
                this.generateReport();
            });
        }

        // Переключение табов статистики
        document.querySelectorAll('.stats-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;

                document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.stats-content').forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(`${tabId}-stats`).classList.add('active');
            });
        });

        // Обработчик изменения темы
        const observer = new MutationObserver(() => {
            this.updateChartsForTheme();
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    async reloadAllData() {
        await this.loadAnalyticsData();
        await this.loadPredictions();
        await this.loadDetailedStats();
    }

    async loadAnalyticsData() {
        try {
            const response = await fetch(`/api/analytics/data?city=${encodeURIComponent(this.currentCity)}&period=${this.currentPeriod}`);
            if (!response.ok) throw new Error('Ошибка загрузки данных');

            const data = await response.json();
            this.updateMetrics(data.metrics);
            this.renderCharts(data);
        } catch (error) {
            console.error('Ошибка загрузки аналитики:', error);
            this.showError('Ошибка загрузки данных. Пожалуйста, попробуйте позже.');
        }
    }

    updateMetrics(metrics) {
        document.getElementById('total-zones').textContent = metrics.total_zones || 0;

        const goodPercent = metrics.total_zones > 0
            ? Math.round((metrics.good_zones / metrics.total_zones) * 100)
            : 0;
        document.getElementById('good-zones').textContent = `${goodPercent}%`;

        document.getElementById('problem-zones').textContent = metrics.problem_zones || 0;
        document.getElementById('maintenance-count').textContent = metrics.maintenance_count || 0;
    }

    renderCharts(data) {
        this.renderStatusChart(data.statusDistribution);
        this.renderTypeChart(data.typeDistribution);
        this.renderProblemsChart(data.problemsByType);
        // Убрать: this.renderMonthlyTrendChart(data.monthly_stats);

        // Загружаем отдельно данные для графика затрат
        this.loadCostsChart();
    }

    renderStatusChart(distribution) {
        const ctx = document.getElementById('status-chart')?.getContext('2d');
        if (!ctx) return;

        if (this.charts.status) {
            this.charts.status.destroy();
        }

        const colors = getChartColors();

        this.charts.status = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: distribution.labels,
                datasets: [{
                    data: distribution.values,
                    backgroundColor: [
                        colors.excellent,
                        colors.good,
                        colors.satisfactory,
                        colors.needsCare,
                        colors.critical
                    ],
                    borderWidth: 1,
                    borderColor: document.body.classList.contains('dark-mode') ? '#333' : '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: document.body.classList.contains('dark-mode') ? '#fff' : '#333',
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    }

    renderTypeChart(distribution) {
        const ctx = document.getElementById('type-chart')?.getContext('2d');
        if (!ctx) return;

        if (this.charts.type) {
            this.charts.type.destroy();
        }

        const colors = getChartColors();

        this.charts.type = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: distribution.labels,
                datasets: [{
                    label: 'Количество зон',
                    data: distribution.values,
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: document.body.classList.contains('dark-mode') ? '#fff' : '#666'
                        },
                        grid: {
                            color: document.body.classList.contains('dark-mode') ? '#444' : '#e0e0e0'
                        }
                    },
                    x: {
                        ticks: {
                            color: document.body.classList.contains('dark-mode') ? '#fff' : '#666'
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    renderProblemsChart(data) {
        const ctx = document.getElementById('problems-chart')?.getContext('2d');
        if (!ctx) return;

        if (this.charts.problems) {
            this.charts.problems.destroy();
        }

        const colors = getChartColors();
        const backgroundColors = [
            colors.blue,
            colors.purple,
            colors.gray,
            colors.needsCare,
            colors.critical,
            colors.accent
        ];

        this.charts.problems = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: backgroundColors.slice(0, data.labels.length),
                    borderWidth: 1,
                    borderColor: document.body.classList.contains('dark-mode') ? '#333' : '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: document.body.classList.contains('dark-mode') ? '#fff' : '#333',
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    }

    async loadCostsChart() {
        try {
            const response = await fetch(`/api/analytics/chart/maintenance-costs?city=${encodeURIComponent(this.currentCity)}`);
            if (!response.ok) throw new Error('Ошибка загрузки данных');

            const data = await response.json();
            this.renderCostsChart(data);
        } catch (error) {
            console.error('Ошибка загрузки графика затрат:', error);
        }
    }

    renderCostsChart(data) {
        const ctx = document.getElementById('costs-chart')?.getContext('2d');
        if (!ctx) return;

        if (this.charts.costs) {
            this.charts.costs.destroy();
        }

        const colors = getChartColors();

        this.charts.costs = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Затраты (тыс. руб)',
                    data: data.values,
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: document.body.classList.contains('dark-mode') ? '#fff' : '#333'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: document.body.classList.contains('dark-mode') ? '#fff' : '#666',
                            callback: function(value) {
                                return value + ' тыс.';
                            }
                        },
                        grid: {
                            color: document.body.classList.contains('dark-mode') ? '#444' : '#e0e0e0'
                        }
                    },
                    x: {
                        ticks: {
                            color: document.body.classList.contains('dark-mode') ? '#fff' : '#666'
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    async loadPredictions() {
        try {
            const response = await fetch(`/api/analytics/predictions?city=${encodeURIComponent(this.currentCity)}`);
            if (!response.ok) throw new Error('Ошибка загрузки прогнозов');

            const data = await response.json();
            this.updatePredictions(data);
        } catch (error) {
            console.error('Ошибка загрузки прогнозов:', error);
            this.updatePredictions({
                status: { improve: 0, worsen: 0, stable: 0, recommendation: 'Данные временно недоступны' },
                budget: { monthly: 0, quarterly: 0, annual: 0, recommended: 0 },
                recommendations: ['Загрузка данных...']
            });
        }
    }

    updatePredictions(predictions) {
        // Прогноз состояния
        const statusPrediction = document.getElementById('status-prediction');
        if (statusPrediction && predictions.status) {
            statusPrediction.innerHTML = `
                <div class="prediction-item">
                    <strong>Улучшится:</strong> ${predictions.status.improve} зон
                </div>
                <div class="prediction-item">
                    <strong>Ухудшится:</strong> ${predictions.status.worsen} зон
                </div>
                <div class="prediction-item">
                    <strong>Останется прежним:</strong> ${predictions.status.stable} зон
                </div>
                <div class="prediction-summary">
                    <i class="fas fa-info-circle"></i>
                    ${predictions.status.recommendation}
                </div>
            `;
        }

        // Прогноз бюджета
        const budgetPrediction = document.getElementById('budget-prediction');
        if (budgetPrediction && predictions.budget) {
            budgetPrediction.innerHTML = `
                <div class="prediction-item">
                    <strong>Текущий месяц:</strong> ${Math.round(predictions.budget.monthly).toLocaleString('ru-RU')} руб.
                </div>
                <div class="prediction-item">
                    <strong>Квартал:</strong> ${Math.round(predictions.budget.quarterly).toLocaleString('ru-RU')} руб.
                </div>
                <div class="prediction-item">
                    <strong>Год:</strong> ${Math.round(predictions.budget.annual).toLocaleString('ru-RU')} руб.
                </div>
                <div class="prediction-item">
                    <strong>Рекомендуемый бюджет:</strong> ${Math.round(predictions.budget.recommended).toLocaleString('ru-RU')} руб.
                </div>
            `;
        }

        // Рекомендации
        const recommendations = document.getElementById('recommendations');
        if (recommendations && predictions.recommendations) {
            recommendations.innerHTML = predictions.recommendations.map(rec => `
                <div class="recommendation-item">
                    <i class="fas fa-check-circle"></i>
                    ${rec}
                </div>
            `).join('');
        }
    }

    async loadDetailedStats() {
        try {
            const response = await fetch(`/api/analytics/detailed?city=${encodeURIComponent(this.currentCity)}`);
            if (!response.ok) throw new Error('Ошибка загрузки детальной статистики');

            const data = await response.json();
            this.updateDetailedStats(data);
        } catch (error) {
            console.error('Ошибка загрузки детальной статистики:', error);
        }
    }

    updateDetailedStats(data) {
        // Обновляем таблицу зон
        const zonesStatsBody = document.getElementById('zones-stats-body');
        if (zonesStatsBody && data.zones) {
            zonesStatsBody.innerHTML = data.zones.map(zone => `
                <tr>
                    <td>${zone.type}</td>
                    <td>${zone.total}</td>
                    <td>${zone.excellent}</td>
                    <td>${zone.good}</td>
                    <td>${zone.satisfactory}</td>
                    <td>${zone.needs_care}</td>
                    <td>${zone.critical}</td>
                </tr>
            `).join('');
        }
    }

    updateChartsForTheme() {
        // Перерисовываем все графики при смене темы
        Object.keys(this.charts).forEach(chartName => {
            if (this.charts[chartName]) {
                this.charts[chartName].destroy();
                delete this.charts[chartName];
            }
        });

        // Перезагружаем данные
        this.loadAnalyticsData();
        this.loadCostsChart();
    }

    generateReport() {
        const report = {
            title: `Отчет ЭКОПУЛЬС - ${this.currentCity}`,
            date: new Date().toLocaleDateString('ru-RU'),
            city: this.currentCity,
            generatedAt: new Date().toISOString(),
            data: {}
        };

        // Собираем данные из DOM
        report.data = {
            totalZones: document.getElementById('total-zones').textContent,
            goodZones: document.getElementById('good-zones').textContent,
            problemZones: document.getElementById('problem-zones').textContent,
            activeProblems: document.getElementById('maintenance-count').textContent
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ecopulse_report_${this.currentCity}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showMessage('Отчет успешно скачан', 'success');
    }

    showMessage(text, type) {
        const message = document.createElement('div');
        message.className = `message message-${type}`;
        message.textContent = text;
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            background-color: ${type === 'error' ? '#f44336' : '#4caf50'};
            color: white;
            z-index: 3000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(message);

        setTimeout(() => {
            message.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => message.remove(), 300);
        }, 3000);
    }

    showError(text) {
        this.showMessage(text, 'error');
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Добавляем стили для темной темы графиков
    const style = document.createElement('style');
    style.textContent = `
        body.dark-mode .chart-card {
            background-color: #2d2d2d;
            color: #fff;
        }

        body.dark-mode .chart-header h3 {
            color: #fff;
        }

        body.dark-mode .prediction-card {
            background-color: #2d2d2d;
            color: #fff;
        }

        body.dark-mode .prediction-header {
            background: linear-gradient(135deg, #388e3c, #1b5e20);
        }

        body.dark-mode .stats-table {
            color: #fff;
        }

        body.dark-mode .stats-table th {
            background-color: #333;
            color: #fff;
        }

        body.dark-mode .stats-table td {
            border-color: #444;
        }

        body.dark-mode .stats-table tr:hover {
            background-color: #333;
        }

        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    window.analyticsDashboard = new AnalyticsDashboard();
});