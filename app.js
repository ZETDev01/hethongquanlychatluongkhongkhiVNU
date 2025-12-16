// Import Firebase configuration
import { database, ref, onValue } from './firebase-config.js';

// Chart.js instances
let dataChart = null;
let tempHumidChart = null;
let airQualityChart = null;
const maxDataPoints = 20;

// Data storage for chart
const chartData = {
    labels: [],
    temperature: [],
    humidity: [],
    co: [],
    pm25: []
};

// Alert thresholds (default values)
let thresholds = {
    temperature: { min: 18, max: 35, enabled: true },
    humidity: { min: 30, max: 80, enabled: true },
    co: { max: 200, enabled: true },
    pm25: { max: 55, enabled: true }
};

// Alert history storage
let alertHistory = [];

// Active alerts
let activeAlerts = [];

// Map instance
let map = null;

// Fan control state
let fanState = {
    isOn: false,
    speed: 0,
    mode: 'auto', // 'auto' or 'manual'
    startTime: null,
    totalRuntime: 0
};

// Initialize the application
function initApp() {
    console.log('Initializing Air Quality Monitoring System...');
    loadThresholds();
    loadAlertHistory();
    loadFanState();
    initChart();
    initTabs();
    initNavigation();
    initMap();
    initFanUI();
    listenToFirebaseData();
    updateThresholdDisplays();
    setInterval(updateFanRuntime, 1000);
}

// Initialize navigation
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('data-page');
            switchPage(page);
        });
    });
}

// Switch between pages
function switchPage(pageName) {
    // Remove active from all nav links and pages
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    
    // Add active to selected
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');
    document.getElementById(`${pageName}-page`).classList.add('active');
    
    // Initialize page-specific features
    if (pageName === 'map' && map) {
        setTimeout(() => map.invalidateSize(), 100);
    } else if (pageName === 'charts') {
        initChartsPage();
    }
}

// Initialize map with VNU IS location
function initMap() {
    if (typeof L === 'undefined') return;
    
    const vnuLocation = [21.0370717, 105.7487065]; // VNU IS coordinates
    
    map = L.map('map-container').setView(vnuLocation, 16);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Add marker
    const marker = L.marker(vnuLocation).addTo(map);
    marker.bindPopup(`
        <div style="text-align: center;">
            <h3>🌬️ Trạm Giám Sát</h3>
            <p><strong>VNU IS</strong></p>
            <p>Số 1 Trịnh Văn Bô</p>
            <p>Nam Từ Liêm, Hà Nội</p>
        </div>
    `).openPopup();
    
    // Add circle to show monitoring area
    L.circle(vnuLocation, {
        color: '#1e3a8a',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        radius: 200
    }).addTo(map);
}

// Initialize charts page
function initChartsPage() {
    if (!tempHumidChart) {
        const ctx1 = document.getElementById('tempHumidChart');
        if (ctx1) {
            const tempGrad = ctx1.getContext('2d').createLinearGradient(0, 0, 0, 300);
            tempGrad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
            tempGrad.addColorStop(1, 'rgba(239, 68, 68, 0.05)');
            
            const humidGrad = ctx1.getContext('2d').createLinearGradient(0, 0, 0, 300);
            humidGrad.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
            humidGrad.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
            
            tempHumidChart = new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: chartData.labels,
                    datasets: [
                        {
                            label: '🌡️ Nhiệt Độ (°C)',
                            data: chartData.temperature,
                            borderColor: '#ef4444',
                            backgroundColor: tempGrad,
                            borderWidth: 3,
                            tension: 0.4,
                            fill: true,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            pointBackgroundColor: '#ef4444',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            yAxisID: 'y'
                        },
                        {
                            label: '💧 Độ Ẩm (%)',
                            data: chartData.humidity,
                            borderColor: '#3b82f6',
                            backgroundColor: humidGrad,
                            borderWidth: 3,
                            tension: 0.4,
                            fill: true,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            pointBackgroundColor: '#3b82f6',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            labels: {
                                usePointStyle: true,
                                padding: 15,
                                font: { size: 13, weight: '600' },
                                color: '#1e293b'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            padding: 12,
                            borderColor: 'rgba(59, 130, 246, 0.5)',
                            borderWidth: 1,
                            cornerRadius: 8
                        }
                    },
                    animation: { duration: 750 },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: { display: true, text: 'Nhiệt Độ (°C)' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: { display: true, text: 'Độ Ẩm (%)' },
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });
        }
    }
    
    if (!airQualityChart) {
        const ctx2 = document.getElementById('airQualityChart');
        if (ctx2) {
            airQualityChart = new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: chartData.labels,
                    datasets: [
                        {
                            label: '☁️ CO (ppm)',
                            data: chartData.co,
                            backgroundColor: 'rgba(245, 158, 11, 0.85)',
                            borderColor: '#f59e0b',
                            borderWidth: 2,
                            borderRadius: 6,
                            yAxisID: 'y'
                        },
                        {
                            label: '🫁 PM2.5 (μg/m³)',
                            data: chartData.pm25,
                            backgroundColor: 'rgba(139, 92, 246, 0.85)',
                            borderColor: '#8b5cf6',
                            borderWidth: 2,
                            borderRadius: 6,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            labels: {
                                usePointStyle: true,
                                padding: 15,
                                font: { size: 13, weight: '600' },
                                color: '#1e293b'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            padding: 12,
                            borderColor: 'rgba(139, 92, 246, 0.5)',
                            borderWidth: 1,
                            cornerRadius: 8
                        }
                    },
                    animation: { duration: 750 },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: { display: true, text: 'CO (ppm)' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: { display: true, text: 'PM2.5 (μg/m³)' },
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });
        }
    }
    
    // Update charts with current data
    if (tempHumidChart) tempHumidChart.update();
    if (airQualityChart) airQualityChart.update();
}

// Initialize tabs functionality
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

// Switch between tabs
function switchTab(tabName) {
    // Remove active class from all buttons and contents
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Add active class to selected tab
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Load thresholds from localStorage
function loadThresholds() {
    const saved = localStorage.getItem('airQualityThresholds');
    if (saved) {
        thresholds = JSON.parse(saved);
        updateThresholdInputs();
    }
}

// Update threshold inputs with current values
function updateThresholdInputs() {
    document.getElementById('temp-min').value = thresholds.temperature.min;
    document.getElementById('temp-max').value = thresholds.temperature.max;
    document.getElementById('temp-alert-enabled').checked = thresholds.temperature.enabled;

    document.getElementById('humidity-min').value = thresholds.humidity.min;
    document.getElementById('humidity-max').value = thresholds.humidity.max;
    document.getElementById('humidity-alert-enabled').checked = thresholds.humidity.enabled;

    document.getElementById('co-max').value = thresholds.co.max;
    document.getElementById('co-alert-enabled').checked = thresholds.co.enabled;

    document.getElementById('pm25-max').value = thresholds.pm25.max;
    document.getElementById('pm25-alert-enabled').checked = thresholds.pm25.enabled;
}

// Load alert history from localStorage
function loadAlertHistory() {
    const saved = localStorage.getItem('alertHistory');
    if (saved) {
        alertHistory = JSON.parse(saved);
        renderAlertHistory();
    }
}

// Initialize Chart.js
function initChart() {
    const ctx = document.getElementById('dataChart').getContext('2d');
    
    // Create gradients
    const tempGradient = ctx.createLinearGradient(0, 0, 0, 400);
    tempGradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
    tempGradient.addColorStop(1, 'rgba(239, 68, 68, 0.05)');
    
    const humidGradient = ctx.createLinearGradient(0, 0, 0, 400);
    humidGradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
    humidGradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
    
    const coGradient = ctx.createLinearGradient(0, 0, 0, 400);
    coGradient.addColorStop(0, 'rgba(245, 158, 11, 0.3)');
    coGradient.addColorStop(1, 'rgba(245, 158, 11, 0.05)');
    
    const pm25Gradient = ctx.createLinearGradient(0, 0, 0, 400);
    pm25Gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    pm25Gradient.addColorStop(1, 'rgba(139, 92, 246, 0.05)');
    
    dataChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: '🌡️ Nhiệt độ (°C)',
                    data: chartData.temperature,
                    borderColor: '#ef4444',
                    backgroundColor: tempGradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    yAxisID: 'y'
                },
                {
                    label: '💧 Độ ẩm (%)',
                    data: chartData.humidity,
                    borderColor: '#3b82f6',
                    backgroundColor: humidGradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    yAxisID: 'y'
                },
                {
                    label: '☁️ CO (ppm)',
                    data: chartData.co,
                    borderColor: '#f59e0b',
                    backgroundColor: coGradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#f59e0b',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    yAxisID: 'y1'
                },
                {
                    label: '🫁 PM2.5 (μg/m³)',
                    data: chartData.pm25,
                    borderColor: '#8b5cf6',
                    backgroundColor: pm25Gradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#8b5cf6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 13,
                            weight: '600'
                        },
                        color: '#1e293b'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 12,
                    borderColor: 'rgba(59, 130, 246, 0.5)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        title: function(context) {
                            return '⏰ ' + context[0].label;
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (context.parsed.y !== null) {
                                label += ': ' + context.parsed.y.toFixed(1);
                            }
                            return label;
                        }
                    }
                }
            },
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: { size: 11 },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '🌡️ Nhiệt độ (°C) / 💧 Độ ẩm (%)',
                        font: {
                            size: 13,
                            weight: 'bold'
                        },
                        color: '#1e293b'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        color: '#64748b'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: '☁️ CO (ppm) / 🫁 PM2.5 (μg/m³)',
                        font: {
                            size: 13,
                            weight: 'bold'
                        },
                        color: '#1e293b'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 11
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 13
                        },
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 13
                    }
                }
            }
        }
    });
}

// Listen to Firebase Realtime Database
function listenToFirebaseData() {
    const dataRef = ref(database, '/');
    
    onValue(dataRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            console.log('Data received:', data);
            updateUI(data);
            updateConnectionStatus(true);
        } else {
            console.log('No data available');
            updateConnectionStatus(false);
        }
    }, (error) => {
        console.error('Firebase error:', error);
        updateConnectionStatus(false);
    });
}

// Update UI with new data
function updateUI(data) {
    // Store last data for auto control
    localStorage.setItem('lastSensorData', JSON.stringify(data));
    
    // Update temperature
    updateCard('temperature', data.t, '°C', getTempStatus(data.t));

    // Update humidity
    updateCard('humidity', data.h, '%', getHumidityStatus(data.h));

    // Update CO
    updateCard('co', data.co, 'ppm', getCOStatus(data.co));

    // Update PM2.5
    updateCard('pm25', data.pm25, 'μg/m³', getPM25Status(data.pm25));

    // Check thresholds and trigger alerts
    checkThresholds(data);

    // Auto control fan if in auto mode
    autoControlFan(data);

    // Update AQI
    updateAQI(data);

    // Update chart
    updateChart(data);

    // Update last update time
    updateLastUpdateTime();
    
    // Update header AQI
    updateHeaderAQI(data);
}

// Update individual card
function updateCard(id, value, _unit, status) {
    const valueElement = document.getElementById(id);
    const statusElement = document.getElementById(`${id === 'temperature' ? 'temp' : id}-status`);

    if (valueElement && value !== undefined && value !== null) {
        valueElement.textContent = typeof value === 'number' ? value.toFixed(1) : value;
    }

    if (statusElement && status) {
        statusElement.textContent = status.text;
        statusElement.style.background = status.color;
        statusElement.style.color = status.textColor || '#fff';
    }
}

// Get temperature status
function getTempStatus(temp) {
    if (temp < 18) return { text: 'Lạnh', color: '#2196F3', textColor: '#fff' };
    if (temp < 25) return { text: 'Mát mẻ', color: '#4CAF50', textColor: '#fff' };
    if (temp < 30) return { text: 'Bình thường', color: '#8BC34A', textColor: '#fff' };
    if (temp < 35) return { text: 'Nóng', color: '#FF9800', textColor: '#fff' };
    return { text: 'Rất nóng', color: '#F44336', textColor: '#fff' };
}

// Get humidity status
function getHumidityStatus(humidity) {
    if (humidity < 30) return { text: 'Khô', color: '#FF9800', textColor: '#fff' };
    if (humidity < 60) return { text: 'Thoải mái', color: '#4CAF50', textColor: '#fff' };
    if (humidity < 80) return { text: 'Ẩm', color: '#2196F3', textColor: '#fff' };
    return { text: 'Rất ẩm', color: '#3F51B5', textColor: '#fff' };
}

// Get CO status
function getCOStatus(co) {
    if (co < 100) return { text: 'Tốt', color: '#4CAF50', textColor: '#fff' };
    if (co < 300) return { text: 'Trung bình', color: '#8BC34A', textColor: '#fff' };
    if (co < 500) return { text: 'Kém', color: '#FF9800', textColor: '#fff' };
    if (co < 600) return { text: 'Xấu', color: '#FF5722', textColor: '#fff' };
    return { text: 'Nguy hiểm', color: '#F44336', textColor: '#fff' };
}

// Get PM2.5 status
function getPM25Status(pm25) {
    if (pm25 <= 12) return { text: 'Tốt', color: '#00e400', textColor: '#000' };
    if (pm25 <= 35.4) return { text: 'Trung bình', color: '#ffff00', textColor: '#000' };
    if (pm25 <= 55.4) return { text: 'Kém (nhạy cảm)', color: '#ff7e00', textColor: '#fff' };
    if (pm25 <= 150.4) return { text: 'Kém', color: '#ff0000', textColor: '#fff' };
    if (pm25 <= 250.4) return { text: 'Rất kém', color: '#8f3f97', textColor: '#fff' };
    return { text: 'Nguy hại', color: '#7e0023', textColor: '#fff' };
}

// Calculate and update AQI
function updateAQI(data) {
    // Simple AQI calculation based on PM2.5 (US EPA standard)
    let aqi = 0;
    let label = '';
    let description = '';
    let colorClass = '';

    const pm25 = data.pm25;

    if (pm25 <= 12.0) {
        aqi = linearScale(pm25, 0, 12.0, 0, 50);
        label = 'Tốt';
        description = 'Chất lượng không khí tốt, không ảnh hưởng đến sức khỏe.';
        colorClass = 'aqi-good';
    } else if (pm25 <= 35.4) {
        aqi = linearScale(pm25, 12.1, 35.4, 51, 100);
        label = 'Trung bình';
        description = 'Chất lượng không khí chấp nhận được, một số người nhạy cảm có thể bị ảnh hưởng nhẹ.';
        colorClass = 'aqi-moderate';
    } else if (pm25 <= 55.4) {
        aqi = linearScale(pm25, 35.5, 55.4, 101, 150);
        label = 'Kém cho nhóm nhạy cảm';
        description = 'Người già, trẻ em và người bệnh hô hấp nên hạn chế hoạt động ngoài trời.';
        colorClass = 'aqi-unhealthy-sensitive';
    } else if (pm25 <= 150.4) {
        aqi = linearScale(pm25, 55.5, 150.4, 151, 200);
        label = 'Kém';
        description = 'Mọi người có thể bắt đầu gặp vấn đề về sức khỏe. Nhóm nhạy cảm có thể gặp vấn đề nghiêm trọng hơn.';
        colorClass = 'aqi-unhealthy';
    } else if (pm25 <= 250.4) {
        aqi = linearScale(pm25, 150.5, 250.4, 201, 300);
        label = 'Rất kém';
        description = 'Cảnh báo sức khỏe: mọi người có thể gặp các tác động sức khỏe nghiêm trọng hơn.';
        colorClass = 'aqi-very-unhealthy';
    } else {
        aqi = linearScale(pm25, 250.5, 500, 301, 500);
        label = 'Nguy hại';
        description = 'Cảnh báo sức khỏe khẩn cấp: toàn bộ dân số có khả năng bị ảnh hưởng nghiêm trọng.';
        colorClass = 'aqi-hazardous';
    }

    document.getElementById('aqi-value').textContent = Math.round(aqi);
    document.getElementById('aqi-label').textContent = label;
    document.getElementById('aqi-description').textContent = description;

    const aqiValueElement = document.getElementById('aqi-value');
    aqiValueElement.className = colorClass;
}

// Linear scale helper function for AQI calculation
function linearScale(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

// Update chart with new data
function updateChart(data) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    chartData.labels.push(timeLabel);
    chartData.temperature.push(data.t);
    chartData.humidity.push(data.h);
    chartData.co.push(data.co);
    chartData.pm25.push(data.pm25);

    // Keep only last maxDataPoints
    if (chartData.labels.length > maxDataPoints) {
        chartData.labels.shift();
        chartData.temperature.shift();
        chartData.humidity.shift();
        chartData.co.shift();
        chartData.pm25.shift();
    }

    dataChart.update();
}

// Update connection status
function updateConnectionStatus(connected) {
    const statusIcon = document.getElementById('connection-status');
    const statusText = document.getElementById('connection-text');
    const navStatusDot = document.getElementById('nav-status-dot');
    const navConnectionText = document.getElementById('nav-connection-text');
    const dbStatus = document.getElementById('db-status');

    if (connected) {
        if (statusIcon) {
            statusIcon.classList.remove('disconnected');
            statusIcon.classList.add('connected');
        }
        if (statusText) statusText.textContent = 'Đã kết nối';
        if (navStatusDot) navStatusDot.classList.add('connected');
        if (navConnectionText && activeAlerts.length === 0) navConnectionText.textContent = 'Kết nối';
        if (dbStatus) dbStatus.textContent = 'Firebase: Đã kết nối';
    } else {
        if (statusIcon) {
            statusIcon.classList.remove('connected');
            statusIcon.classList.add('disconnected');
        }
        if (statusText) statusText.textContent = 'Mất kết nối';
        if (navStatusDot) navStatusDot.classList.remove('connected');
        if (navConnectionText) navConnectionText.textContent = 'Mất kết nối';
        if (dbStatus) dbStatus.textContent = 'Firebase: Mất kết nối';
    }
}

// Update last update time
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleString('vi-VN');
    document.getElementById('last-update').textContent = `Cập nhật: ${timeString}`;
}

// Check thresholds and create alerts
function checkThresholds(data) {
    activeAlerts = [];

    // Check temperature
    if (thresholds.temperature.enabled) {
        if (data.t < thresholds.temperature.min) {
            addAlert('temperature', `Nhiệt độ quá thấp: ${data.t}°C (ngưỡng: ${thresholds.temperature.min}°C)`, data.t, 'warning');
        } else if (data.t > thresholds.temperature.max) {
            addAlert('temperature', `Nhiệt độ quá cao: ${data.t}°C (ngưỡng: ${thresholds.temperature.max}°C)`, data.t, 'danger');
        }
    }

    // Check humidity
    if (thresholds.humidity.enabled) {
        if (data.h < thresholds.humidity.min) {
            addAlert('humidity', `Độ ẩm quá thấp: ${data.h}% (ngưỡng: ${thresholds.humidity.min}%)`, data.h, 'warning');
        } else if (data.h > thresholds.humidity.max) {
            addAlert('humidity', `Độ ẩm quá cao: ${data.h}% (ngưỡng: ${thresholds.humidity.max}%)`, data.h, 'danger');
        }
    }

    // Check CO
    if (thresholds.co.enabled && data.co > thresholds.co.max) {
        addAlert('co', `Nồng độ CO vượt ngưỡng: ${data.co} ppm (ngưỡng: ${thresholds.co.max} ppm)`, data.co, 'danger');
    }

    // Check PM2.5
    if (thresholds.pm25.enabled && data.pm25 > thresholds.pm25.max) {
        addAlert('pm25', `Nồng độ PM2.5 vượt ngưỡng: ${data.pm25} μg/m³ (ngưỡng: ${thresholds.pm25.max} μg/m³)`, data.pm25, 'danger');
    }

    // Update alert display
    updateAlertDisplay();
}

// Add alert to active alerts and history
function addAlert(type, message, value, severity) {
    const alert = {
        type,
        message,
        value,
        severity,
        timestamp: new Date().toISOString()
    };

    activeAlerts.push(alert);

    // Add to history (avoid duplicates within 1 minute)
    const lastAlert = alertHistory[0];
    const now = new Date();

    if (!lastAlert ||
        lastAlert.type !== type ||
        (now - new Date(lastAlert.timestamp)) > 60000) {
        alertHistory.unshift(alert);

        // Keep only last 100 alerts
        if (alertHistory.length > 100) {
            alertHistory = alertHistory.slice(0, 100);
        }

        saveAlertHistory();
        renderAlertHistory();
    }
}

// Update alert display
function updateAlertDisplay() {
    const alertBanner = document.getElementById('alerts-banner');
    const alertMessage = document.getElementById('alert-message');
    const alertCount = document.getElementById('alert-count');
    const alertIndicator = document.getElementById('alert-indicator');
    const navStatusDot = document.getElementById('nav-status-dot');
    const navConnectionText = document.getElementById('nav-connection-text');

    if (activeAlerts.length > 0) {
        // Show banner with first alert
        if (alertBanner) {
            alertBanner.style.display = 'flex';
            alertMessage.textContent = activeAlerts[0].message;
        }

        // Update indicator
        if (alertCount) alertCount.textContent = `${activeAlerts.length} cảnh báo`;
        if (alertIndicator) alertIndicator.classList.add('has-alerts');
        
        // Show popup for critical alerts
        showAlertPopup();
        
        // Update nav status
        if (navStatusDot) navStatusDot.classList.add('connected');
        if (navConnectionText) navConnectionText.textContent = `${activeAlerts.length} cảnh báo`;
    } else {
        if (alertBanner) alertBanner.style.display = 'none';
        if (alertCount) alertCount.textContent = '0 cảnh báo';
        if (alertIndicator) alertIndicator.classList.remove('has-alerts');
        if (navConnectionText) navConnectionText.textContent = 'Kết nối';
    }
}

// Show alert popup modal
function showAlertPopup() {
    if (activeAlerts.length === 0) return;
    
    const popup = document.getElementById('alert-popup');
    const popupBody = document.getElementById('alert-popup-body');
    
    if (!popup || !popupBody) return;
    
    // Build alert items HTML
    const alertsHTML = activeAlerts.map(alert => {
        const icon = alert.severity === 'danger' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';
        return `
            <div class="alert-item">
                <strong><i class="fas ${icon}"></i> ${getAlertTypeLabel(alert.type)}</strong>
                <p>${alert.message}</p>
                <small>${new Date(alert.timestamp).toLocaleString('vi-VN')}</small>
            </div>
        `;
    }).join('');
    
    popupBody.innerHTML = alertsHTML;
    popup.classList.add('show');
    
    // Play alert sound (optional)
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi77eifTRALT6fk77RgGwY4kNbzyn0qBSJzxe3glEgLDlms5O2rWhELSKDh8bllHAU2jdXzxXcpBCB0yPDckTsKEF633eyrWBIKSKXi8bllHAU2jdXzxXcpBCB0yPDckTsKEF633eyrWBIKSKXi8bllHAU2jdXzxXcpBCB0yPDckTsKEF633eyrWBIKSKXi8bllHAU2jdXzxXcpBCB0yPDckTsKEF633eyrWBIKSKXi8bllHAU2jdXzxXcpBCB0yPDckTsKEF633eyrWBIKSKXi8bllHAU2jdXzxXcpBCB0yPDckTsKEF633eyrWBIKSKXi8bllHAU2jdXzxXcpBCB0yPDckTsKEF633eyrWBIKSKXi8bllHAU2jdXzxXcpBCB0yPDckTsKEF633eyrWBIKSKXi8bllHAU=');
        audio.volume = 0.3;
        audio.play().catch(() => {});
    } catch (e) {
        // Silent fail for audio
    }
}

// Close alert popup
window.closeAlertPopup = function() {
    const popup = document.getElementById('alert-popup');
    if (popup) popup.classList.remove('show');
};

// Get alert type label in Vietnamese
function getAlertTypeLabel(type) {
    const labels = {
        'temperature': '🌡️ Nhiệt Độ',
        'humidity': '💧 Độ Ẩm',
        'co': '☁️ Khí CO',
        'pm25': '🫁 Bụi PM2.5'
    };
    return labels[type] || type;
}

// Close alert banner
window.closeAlertBanner = function() {
    document.getElementById('alerts-banner').style.display = 'none';
};

// Save thresholds
window.saveThresholds = function() {
    thresholds.temperature.min = parseFloat(document.getElementById('temp-min').value);
    thresholds.temperature.max = parseFloat(document.getElementById('temp-max').value);
    thresholds.temperature.enabled = document.getElementById('temp-alert-enabled').checked;

    thresholds.humidity.min = parseFloat(document.getElementById('humidity-min').value);
    thresholds.humidity.max = parseFloat(document.getElementById('humidity-max').value);
    thresholds.humidity.enabled = document.getElementById('humidity-alert-enabled').checked;

    thresholds.co.max = parseFloat(document.getElementById('co-max').value);
    thresholds.co.enabled = document.getElementById('co-alert-enabled').checked;

    thresholds.pm25.max = parseFloat(document.getElementById('pm25-max').value);
    thresholds.pm25.enabled = document.getElementById('pm25-alert-enabled').checked;

    localStorage.setItem('airQualityThresholds', JSON.stringify(thresholds));

    alert('✅ Đã lưu cài đặt ngưỡng cảnh báo!');
};

// Reset thresholds to default
window.resetThresholds = function() {
    if (confirm('Bạn có chắc muốn đặt lại về giá trị mặc định?')) {
        thresholds = {
            temperature: { min: 18, max: 35, enabled: true },
            humidity: { min: 30, max: 80, enabled: true },
            co: { max: 200, enabled: true },
            pm25: { max: 55, enabled: true }
        };

        updateThresholdInputs();
        localStorage.setItem('airQualityThresholds', JSON.stringify(thresholds));

        alert('✅ Đã đặt lại về giá trị mặc định!');
    }
};

// Save alert history to localStorage
function saveAlertHistory() {
    localStorage.setItem('alertHistory', JSON.stringify(alertHistory));
}

// Render alert history
function renderAlertHistory() {
    const historyList = document.getElementById('history-list');

    if (alertHistory.length === 0) {
        historyList.innerHTML = `
            <div class="no-history">
                <i class="fas fa-inbox"></i>
                <p>Chưa có cảnh báo nào</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = alertHistory.map(alert => {
        const date = new Date(alert.timestamp);
        const timeString = date.toLocaleString('vi-VN');
        const icon = getAlertIcon(alert.type);

        return `
            <div class="history-item ${alert.severity}">
                <div class="history-header">
                    <div class="history-type">
                        <i class="${icon}"></i>
                        ${getAlertTypeName(alert.type)}
                    </div>
                    <div class="history-time">${timeString}</div>
                </div>
                <div class="history-message">
                    ${alert.message}
                </div>
            </div>
        `;
    }).join('');
}

// Get alert icon
function getAlertIcon(type) {
    const icons = {
        temperature: 'fas fa-temperature-high',
        humidity: 'fas fa-tint',
        co: 'fas fa-smog',
        pm25: 'fas fa-lungs'
    };
    return icons[type] || 'fas fa-exclamation-triangle';
}

// Get alert type name
function getAlertTypeName(type) {
    const names = {
        temperature: 'Nhiệt độ',
        humidity: 'Độ ẩm',
        co: 'Khí CO',
        pm25: 'Bụi PM2.5'
    };
    return names[type] || type;
}

// Clear alert history
window.clearAlertHistory = function() {
    if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử cảnh báo?')) {
        alertHistory = [];
        saveAlertHistory();
        renderAlertHistory();
        alert('✅ Đã xóa lịch sử cảnh báo!');
    }
};

// Export alert history
window.exportAlertHistory = function() {
    if (alertHistory.length === 0) {
        alert('⚠️ Không có dữ liệu để xuất!');
        return;
    }

    const csv = convertToCSV(alertHistory);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `lich-su-canh-bao-${Date.now()}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert('✅ Đã xuất file lịch sử cảnh báo!');
};

// Convert alert history to CSV
function convertToCSV(data) {
    const headers = ['Thời gian', 'Loại', 'Mức độ', 'Giá trị', 'Thông báo'];
    const rows = data.map(alert => {
        const date = new Date(alert.timestamp).toLocaleString('vi-VN');
        return [
            date,
            getAlertTypeName(alert.type),
            alert.severity === 'danger' ? 'Nguy hiểm' : 'Cảnh báo',
            alert.value,
            alert.message
        ];
    });

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return '\uFEFF' + csvContent; // Add BOM for UTF-8
}

// Update charts when data changes
function updateAllCharts(data) {
    // Update main dashboard chart
    if (dataChart) {
        dataChart.update();
    }
    
    // Update charts page if initialized
    if (tempHumidChart) {
        tempHumidChart.data.labels = chartData.labels;
        tempHumidChart.data.datasets[0].data = chartData.temperature;
        tempHumidChart.data.datasets[1].data = chartData.humidity;
        tempHumidChart.update();
    }
    
    if (airQualityChart) {
        airQualityChart.data.labels = chartData.labels;
        airQualityChart.data.datasets[0].data = chartData.co;
        airQualityChart.data.datasets[1].data = chartData.pm25;
        airQualityChart.update();
    }
}

// Load fan state from localStorage
function loadFanState() {
    const saved = localStorage.getItem('fanState');
    if (saved) {
        const savedState = JSON.parse(saved);
        fanState = { ...fanState, ...savedState, startTime: null };
    }
}

// Save fan state to localStorage
function saveFanState() {
    const stateToSave = { ...fanState, startTime: null };
    localStorage.setItem('fanState', JSON.stringify(stateToSave));
}

// Initialize fan UI
function initFanUI() {
    updateFanUI();
    updateFanModeUI();
}

// Update threshold displays
function updateThresholdDisplays() {
    const coDisplay = document.getElementById('co-threshold-display');
    const pm25Display = document.getElementById('pm25-threshold-display');
    
    if (coDisplay) coDisplay.textContent = thresholds.co.max;
    if (pm25Display) pm25Display.textContent = thresholds.pm25.max;
}

// Toggle fan power
window.toggleFan = function() {
    fanState.isOn = !fanState.isOn;
    
    if (fanState.isOn) {
        fanState.startTime = Date.now();
        if (fanState.speed === 0) {
            fanState.speed = 50; // Default speed when turning on
        }
    } else {
        if (fanState.startTime) {
            fanState.totalRuntime += Date.now() - fanState.startTime;
            fanState.startTime = null;
        }
        fanState.speed = 0;
    }
    
    updateFanUI();
    sendFanCommandToFirebase();
    saveFanState();
};

// Update fan speed
window.updateFanSpeed = function(speed) {
    speed = parseInt(speed);
    fanState.speed = speed;
    
    // Update speed display
    const speedDisplay = document.getElementById('fan-speed-display');
    if (speedDisplay) speedDisplay.textContent = speed;
    
    // Update slider background
    const slider = document.getElementById('fan-speed');
    if (slider) {
        slider.style.background = `linear-gradient(to right, var(--primary) ${speed}%, var(--bg-light) ${speed}%)`;
    }
    
    // Update ring progress
    const ring = document.getElementById('speed-ring-progress');
    if (ring) {
        const circumference = 2 * Math.PI * 50;
        const offset = circumference - (speed / 100) * circumference;
        ring.style.strokeDashoffset = offset;
    }
    
    // Turn on fan if speed > 0 and in manual mode
    if (speed > 0 && !fanState.isOn && fanState.mode === 'manual') {
        fanState.isOn = true;
        fanState.startTime = Date.now();
    } else if (speed === 0 && fanState.isOn && fanState.mode === 'manual') {
        fanState.isOn = false;
        if (fanState.startTime) {
            fanState.totalRuntime += Date.now() - fanState.startTime;
            fanState.startTime = null;
        }
    }
    
    updateFanUI();
    sendFanCommandToFirebase();
    saveFanState();
};

// Set fan mode (auto/manual)
window.setFanMode = function(mode) {
    fanState.mode = mode;
    updateFanModeUI();
    saveFanState();
    
    if (mode === 'auto') {
        // Re-check conditions immediately
        const lastData = JSON.parse(localStorage.getItem('lastSensorData') || '{}');
        if (lastData.co || lastData.pm25) {
            autoControlFan(lastData);
        }
    }
};

// Update fan UI
function updateFanUI() {
    const fanIcon = document.getElementById('fan-icon');
    const statusBadge = document.getElementById('fan-status-badge');
    const statusText = document.getElementById('fan-status-text');
    const powerBtn = document.getElementById('power-btn');
    const powerLabel = document.getElementById('power-label');
    
    if (fanIcon) {
        fanIcon.style.animationPlayState = fanState.isOn ? 'running' : 'paused';
    }
    
    if (statusBadge) {
        if (fanState.isOn) {
            statusBadge.classList.add('active');
        } else {
            statusBadge.classList.remove('active');
        }
    }
    
    if (statusText) {
        statusText.textContent = fanState.isOn ? `BẬT - ${fanState.speed}%` : 'TẮT';
    }
    
    if (powerBtn) {
        if (fanState.isOn) {
            powerBtn.classList.add('active');
        } else {
            powerBtn.classList.remove('active');
        }
    }
    
    if (powerLabel) {
        powerLabel.textContent = fanState.isOn ? 'Nhấn để tắt' : 'Nhấn để bật';
    }
}

// Update fan mode UI
function updateFanModeUI() {
    const btnManual = document.getElementById('btn-manual');
    const btnAuto = document.getElementById('btn-auto');
    const autoInfo = document.getElementById('auto-info');
    
    if (btnManual && btnAuto) {
        if (fanState.mode === 'manual') {
            btnManual.classList.add('active');
            btnAuto.classList.remove('active');
            if (autoInfo) autoInfo.style.display = 'none';
        } else {
            btnManual.classList.remove('active');
            btnAuto.classList.add('active');
            if (autoInfo) autoInfo.style.display = 'flex';
        }
    }
}

// Update fan runtime display
function updateFanRuntime() {
    let runtime = fanState.totalRuntime;
    if (fanState.isOn && fanState.startTime) {
        runtime += Date.now() - fanState.startTime;
    }
    
    const hours = Math.floor(runtime / 3600000);
    const minutes = Math.floor((runtime % 3600000) / 60000);
    
    const runtimeDisplay = document.getElementById('fan-runtime');
    if (runtimeDisplay) {
        runtimeDisplay.textContent = `${hours}h ${minutes}m`;
    }
}

// Auto control fan based on sensor data
function autoControlFan(data) {
    if (fanState.mode !== 'auto') return;
    
    const coExceeded = thresholds.co.enabled && data.co > thresholds.co.max;
    const pm25Exceeded = thresholds.pm25.enabled && data.pm25 > thresholds.pm25.max;
    
    if (coExceeded || pm25Exceeded) {
        // Calculate fan speed based on pollution level
        let targetSpeed = 0;
        
        if (coExceeded) {
            const coRatio = data.co / thresholds.co.max;
            targetSpeed = Math.max(targetSpeed, Math.min(100, Math.round(coRatio * 80)));
        }
        
        if (pm25Exceeded) {
            const pm25Ratio = data.pm25 / thresholds.pm25.max;
            targetSpeed = Math.max(targetSpeed, Math.min(100, Math.round(pm25Ratio * 80)));
        }
        
        // Ensure minimum speed of 30% when auto-on
        targetSpeed = Math.max(30, targetSpeed);
        
        if (!fanState.isOn || fanState.speed !== targetSpeed) {
            fanState.isOn = true;
            if (!fanState.startTime) {
                fanState.startTime = Date.now();
            }
            fanState.speed = targetSpeed;
            
            // Update slider
            const slider = document.getElementById('fan-speed');
            if (slider) slider.value = targetSpeed;
            
            updateFanSpeed(targetSpeed);
            
            console.log(`Auto fan activated: ${targetSpeed}% (CO: ${data.co}, PM2.5: ${data.pm25})`);
        }
    } else {
        // Turn off fan if conditions are normal
        if (fanState.isOn) {
            fanState.isOn = false;
            if (fanState.startTime) {
                fanState.totalRuntime += Date.now() - fanState.startTime;
                fanState.startTime = null;
            }
            fanState.speed = 0;
            
            const slider = document.getElementById('fan-speed');
            if (slider) slider.value = 0;
            
            updateFanSpeed(0);
            
            console.log('Auto fan deactivated: conditions normal');
        }
    }
}

// Send fan command to Firebase
function sendFanCommandToFirebase() {
    import('./firebase-config.js').then(({ database, ref, set }) => {
        const fanRef = ref(database, 'fan');
        set(fanRef, {
            status: fanState.isOn ? 1 : 0,
            speed: fanState.speed,
            mode: fanState.mode,
            timestamp: Date.now()
        }).then(() => {
            console.log('Fan command sent to Firebase:', fanState);
        }).catch((error) => {
            console.error('Error sending fan command:', error);
        });
    }).catch((error) => {
        console.error('Error importing Firebase:', error);
    });
}

// Sync threshold inputs between pages
function syncThresholdInputs() {
    // Sync from main settings to settings page
    const temp2Min = document.getElementById('temp-min-2');
    const temp2Max = document.getElementById('temp-max-2');
    const tempAlert2 = document.getElementById('temp-alert-enabled-2');
    
    if (temp2Min) temp2Min.value = thresholds.temperature.min;
    if (temp2Max) temp2Max.value = thresholds.temperature.max;
    if (tempAlert2) tempAlert2.checked = thresholds.temperature.enabled;
    
    const humidity2Min = document.getElementById('humidity-min-2');
    const humidity2Max = document.getElementById('humidity-max-2');
    const humidityAlert2 = document.getElementById('humidity-alert-enabled-2');
    
    if (humidity2Min) humidity2Min.value = thresholds.humidity.min;
    if (humidity2Max) humidity2Max.value = thresholds.humidity.max;
    if (humidityAlert2) humidityAlert2.checked = thresholds.humidity.enabled;
    
    const co2Max = document.getElementById('co-max-2');
    const coAlert2 = document.getElementById('co-alert-enabled-2');
    
    if (co2Max) co2Max.value = thresholds.co.max;
    if (coAlert2) coAlert2.checked = thresholds.co.enabled;
    
    const pm252Max = document.getElementById('pm25-max-2');
    const pm25Alert2 = document.getElementById('pm25-alert-enabled-2');
    
    if (pm252Max) pm252Max.value = thresholds.pm25.max;
    if (pm25Alert2) pm25Alert2.checked = thresholds.pm25.enabled;
}

// Enhanced save thresholds that syncs both forms
const originalSaveThresholds = window.saveThresholds;
window.saveThresholds = function() {
    // Get values from either form
    const temp1Min = document.getElementById('temp-min');
    const temp2Min = document.getElementById('temp-min-2');
    
    if (temp1Min && temp1Min.value) {
        thresholds.temperature.min = parseFloat(temp1Min.value);
        thresholds.temperature.max = parseFloat(document.getElementById('temp-max').value);
        thresholds.temperature.enabled = document.getElementById('temp-alert-enabled').checked;

        thresholds.humidity.min = parseFloat(document.getElementById('humidity-min').value);
        thresholds.humidity.max = parseFloat(document.getElementById('humidity-max').value);
        thresholds.humidity.enabled = document.getElementById('humidity-alert-enabled').checked;

        thresholds.co.max = parseFloat(document.getElementById('co-max').value);
        thresholds.co.enabled = document.getElementById('co-alert-enabled').checked;

        thresholds.pm25.max = parseFloat(document.getElementById('pm25-max').value);
        thresholds.pm25.enabled = document.getElementById('pm25-alert-enabled').checked;
    } else if (temp2Min && temp2Min.value) {
        thresholds.temperature.min = parseFloat(temp2Min.value);
        thresholds.temperature.max = parseFloat(document.getElementById('temp-max-2').value);
        thresholds.temperature.enabled = document.getElementById('temp-alert-enabled-2').checked;

        thresholds.humidity.min = parseFloat(document.getElementById('humidity-min-2').value);
        thresholds.humidity.max = parseFloat(document.getElementById('humidity-max-2').value);
        thresholds.humidity.enabled = document.getElementById('humidity-alert-enabled-2').checked;

        thresholds.co.max = parseFloat(document.getElementById('co-max-2').value);
        thresholds.co.enabled = document.getElementById('co-alert-enabled-2').checked;

        thresholds.pm25.max = parseFloat(document.getElementById('pm25-max-2').value);
        thresholds.pm25.enabled = document.getElementById('pm25-alert-enabled-2').checked;
    }

    localStorage.setItem('airQualityThresholds', JSON.stringify(thresholds));
    syncThresholdInputs();
    updateThresholdInputs();

    alert('✅ Đã lưu cài đặt ngưỡng cảnh báo!');
};

// Update header AQI display
function updateHeaderAQI(data) {
    const headerAqi = document.getElementById('header-aqi');
    const headerAqiPill = document.getElementById('header-aqi-pill');
    
    if (!headerAqi || !data.pm25) return;
    
    let aqi = 0;
    const pm25 = data.pm25;
    
    if (pm25 <= 12.0) {
        aqi = Math.round((50 / 12.0) * pm25);
    } else if (pm25 <= 35.4) {
        aqi = Math.round(50 + ((100 - 50) / (35.4 - 12.1)) * (pm25 - 12.1));
    } else if (pm25 <= 55.4) {
        aqi = Math.round(100 + ((150 - 100) / (55.4 - 35.5)) * (pm25 - 35.5));
    } else if (pm25 <= 150.4) {
        aqi = Math.round(150 + ((200 - 150) / (150.4 - 55.5)) * (pm25 - 55.5));
    } else if (pm25 <= 250.4) {
        aqi = Math.round(200 + ((300 - 200) / (250.4 - 150.5)) * (pm25 - 150.5));
    } else {
        aqi = Math.round(300 + ((500 - 300) / (500.4 - 250.5)) * (pm25 - 250.5));
    }
    
    headerAqi.textContent = aqi;
    
    // Update pill color based on AQI
    if (headerAqiPill) {
        if (aqi <= 50) {
            headerAqiPill.style.background = '#10b981';
            headerAqiPill.style.color = 'white';
        } else if (aqi <= 100) {
            headerAqiPill.style.background = '#f59e0b';
            headerAqiPill.style.color = 'white';
        } else if (aqi <= 150) {
            headerAqiPill.style.background = '#ef4444';
            headerAqiPill.style.color = 'white';
        } else {
            headerAqiPill.style.background = '#7e22ce';
            headerAqiPill.style.color = 'white';
        }
    }
}

// Update fan last on time
function updateFanLastOn() {
    if (fanState.isOn && !document.getElementById('fan-last-on').textContent.includes(':')) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('fan-last-on').textContent = timeString;
    }
}

// Call update fan last on when fan turns on
const originalToggleFan = window.toggleFan;
window.toggleFan = function() {
    originalToggleFan();
    if (fanState.isOn) {
        updateFanLastOn();
    }
};

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

