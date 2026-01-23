class AnalyticsDashboard {
    constructor() {
        this.charts = {};
        this.currentCity = document.getElementById('city-select')?.value || 'Барнаул';
        this.initialize();
    }

    initialize() {
        this.loadAnalyticsData();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Город селектор
        const citySelect = document.getElementById('city-select');
        if (citySelect) {
            citySelect.addEventListener('change', () => {
                this.currentCity = citySelect.value;
                this.loadAnalyticsData();
            });
        }

        // Кнопки переключения графиков
        document.querySelectorAll('.analytics-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const chartType = btn.dataset.chart;
                this.loadChart(chartType);
            });
        });
    }

    async loadAnalyticsData() {
        try {
            const response = await fetch(`/api/analytics/data?city=${encodeURIComponent(this.currentCity)}`);
            const data = await response.json();
            this.renderAllCharts(data);
        } catch (error) {
            console.error('Ошибка загрузки аналитики:', error);
        }
    }

    renderAllCharts(data) {
        // Основные метрики
        this.renderMetrics(data.metrics);
        
        // Графики
        this.renderZonesByStatusChart(data.statusDistribution);
        this.renderZonesByTypeChart(data.typeDistribution);
        this.renderProblemsChart(data.problemsByType);
        this.renderMonthlyTrendChart(data.monthlyTrends);
        this.renderMaintenanceCostChart(data.maintenanceCosts);
        this.renderPollutionChart(data.pollutionData);
    }

    renderMetrics(metrics) {
        document.querySelectorAll('.stat-value').forEach(el => {
            const metric = el.id.replace('-', '_');
            if (metrics[metric]) {
                el.textContent = metrics[metric];
            }
        });
    }

    renderZonesByStatusChart(data) {
        const ctx = document.getElementById('zones-by-status-chart')?.getContext('2d');
        if (!ctx) return;

        if (this.charts.zonesByStatus) {
            this.charts.zonesByStatus.destroy();
        }

        const statusColors = {
            'отличный': '#4caf50',
            'хороший': '#8bc34a',
            'удовлетворительный': '#ffeb3b',
            'требует ухода': '#ff9800',
            'критический': '#f44336'
        };

        this.charts.zonesByStatus = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: data.labels.map(label => statusColors[label] || '#cccccc'),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    title: {
                        display: true,
                        text: 'Распределение зон по статусам'
                    }
                }
            }
        });
    }

    renderZonesByTypeChart(data) {
        const ctx = document.getElementById('zones-by-type-chart')?.getContext('2d');
        if (!ctx) return;

        if (this.charts.zonesByType) {
            this.charts.zonesByType.destroy();
        }

        this.charts.zonesByType = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Количество зон',
                    data: data.values,
                    backgroundColor: '#4caf50',
                    borderColor: '#2e7d32',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Распределение зон по типам'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Количество зон'
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

        const colors = ['#ff9800', '#f44336', '#2196f3', '#9c27b0', '#607d8b'];

        this.charts.problems = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: colors.slice(0, data.labels.length),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Распределение типов проблем'
                    }
                }
            }
        });
    }

    renderMonthlyTrendChart(data) {
        const ctx = document.getElementById('monthly-trend-chart')?.getContext('2d');
        if (!ctx) return;

        if (this.charts.monthlyTrend) {
            this.charts.monthlyTrend.destroy();
        }

        this.charts.monthlyTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Добавлено зон',
                        data: data.zonesAdded,
                        borderColor: '#4caf50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        tension: 0.3
                    },
                    {
                        label: 'Сообщений о проблемах',
                        data: data.problemsReported,
                        borderColor: '#f44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Динамика активности по месяцам'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Количество'
                        }
                    }
                }
            }
        });
    }

    renderMaintenanceCostChart(data) {
        const ctx = document.getElementById('maintenance-cost-chart')?.getContext('2d');
        if (!ctx) return;

        if (this.charts.maintenanceCost) {
            this.charts.maintenanceCost.destroy();
        }

        this.charts.maintenanceCost = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Затраты на обслуживание (тыс. руб)',
                    data: data.values,
                    backgroundColor: 'rgba(76, 175, 80, 0.2)',
                    borderColor: '#4caf50',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Затраты на обслуживание по типам зон'
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderPollutionChart(data) {
        const ctx = document.getElementById('pollution-chart')?.getContext('2d');
        if (!ctx) return;

        if (this.charts.pollution) {
            this.charts.pollution.destroy();
        }

        const pollutionColors = {
            'низкий': '#4caf50',
            'средний': '#ff9800',
            'высокий': '#f44336'
        };

        this.charts.pollution = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Загрязнение воздуха',
                    data: data.points,
                    backgroundColor: data.points.map(p => pollutionColors[p.level] || '#cccccc'),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Загрязнение воздуха по районам'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Район: ${context.raw.label}\nУровень: ${context.raw.level}\nAQI: ${context.raw.value}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Долгота'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Широта'
                        }
                    }
                }
            }
        });
    }

    async loadChart(chartType) {
        try {
            const response = await fetch(`/api/analytics/chart/${chartType}?city=${encodeURIComponent(this.currentCity)}`);
            const data = await response.json();
            
            const chartMethods = {
                'pollution': this.renderPollutionChart,
                'zone-dynamics': this.renderMonthlyTrendChart,
                'problem-types': this.renderProblemsChart,
                'maintenance-costs': this.renderMaintenanceCostChart
            };
            
            if (chartMethods[chartType]) {
                chartMethods[chartType].call(this, data);
            }
        } catch (error) {
            console.error(`Ошибка загрузки графика ${chartType}:`, error);
        }
    }

    generateReport() {
        const reportData = {
            city: this.currentCity,
            date: new Date().toLocaleDateString('ru-RU'),
            charts: {}
        };
        
        // Собираем данные со всех графиков
        Object.keys(this.charts).forEach(chartName => {
            if (this.charts[chartName]) {
                reportData.charts[chartName] = this.charts[chartName].data;
            }
        });
        
        // Создаем и скачиваем отчет
        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ecopulse_report_${this.currentCity}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    window.analyticsDashboard = new AnalyticsDashboard();
    
    // Кнопка генерации отчета
    const generateReportBtn = document.getElementById('generate-report-btn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', () => {
            window.analyticsDashboard.generateReport();
        });
    }
    
    // Кнопка обновления данных
    const refreshAnalyticsBtn = document.getElementById('refresh-analytics-btn');
    if (refreshAnalyticsBtn) {
        refreshAnalyticsBtn.addEventListener('click', () => {
            window.analyticsDashboard.loadAnalyticsData();
        });
    }
});