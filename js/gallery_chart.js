let statsChart = null; // chart reference
let currentChartType = 'pie'; // default chart type

// Get chart data from stat cards (now including Healthy)
function getChartData() {
    const statCards = document.querySelectorAll('.stat-card');
    const labels = [];
    const data = [];
    const backgroundColors = [];

    statCards.forEach(card => {
        const labelEl = card.querySelector('span');
        const numberEl = card.querySelector('.number');
        if (!labelEl || !numberEl) return; // skip if missing

        labels.push(labelEl.textContent.trim());
        data.push(parseInt(numberEl.textContent.trim()));
        const style = window.getComputedStyle(card);
        backgroundColors.push(style.backgroundColor || '#000'); // fallback color
    });

    return { labels, data, backgroundColors };
}

// Initialize or reinitialize chart
function initStatsChart(type = 'pie') {
    const { labels, data, backgroundColors } = getChartData();
    const canvas = document.getElementById('statsPieChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (statsChart) statsChart.destroy();

    statsChart = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderColor: type === 'bar' ? '#000' : null,
                borderWidth: type === 'bar' ? 1 : 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                            const value = context.raw;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                },
                datalabels: { display: false }
            },
            scales: type === 'bar' ? {
                x: {
                    ticks: { display: false }, // hide x-axis labels
                    grid: { display: false }   // optional: hide vertical grid lines
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255,255,255,0.2)' } // subtle horizontal grid
                }
            } : {}
        },
        plugins: [ChartDataLabels]
    });

    updateCustomLegend(labels, data, backgroundColors);
}

// Update chart dynamically
function updateStatsChart() {
    if (!statsChart) return;
    const { labels, data, backgroundColors } = getChartData();

    statsChart.data.labels = labels;
    statsChart.data.datasets[0].data = data;
    statsChart.data.datasets[0].backgroundColor = backgroundColors;
    statsChart.update();

    updateCustomLegend(labels, data, backgroundColors);
}

// Custom legend
function updateCustomLegend(labels, data, backgroundColors) {
    const legendContainer = document.getElementById("chartLegend");
    if (!legendContainer) return;

    legendContainer.innerHTML = "";
    labels.forEach((label, i) => {
        const legendItem = document.createElement("span");
        legendItem.innerHTML = `
            <div class="legend-color-box" style="background-color:${backgroundColors[i]}"></div>
            ${label} (${data[i]})
        `;
        legendContainer.appendChild(legendItem);
    });
}

// Change chart type
function changeChartType(type) {
    const chartTypeMap = { 'Pie Chart': 'pie', 'Bar Chart': 'bar' };
    currentChartType = chartTypeMap[type] || 'pie';
    initStatsChart(currentChartType);
}

// Dropdown logic
const chartDropdown = document.getElementById("chartTypeDropdown");
const chartDropdownButton = document.getElementById("chartDropdownButton");
const chartDropdownMenu = document.getElementById("chartdropdownMenu");

chartDropdownButton.addEventListener("click", () => chartDropdown.classList.toggle("show"));
chartDropdownMenu.querySelectorAll("div").forEach(item => {
    item.addEventListener("click", () => {
        chartDropdownButton.firstChild.textContent = item.textContent + " ";
        chartDropdownButton.querySelector("span").textContent = "▼";
        chartDropdown.classList.remove("show");
        changeChartType(item.textContent);
    });
});
window.addEventListener("click", e => {
    if (!chartDropdown.contains(e.target)) chartDropdown.classList.remove("show");
});

// Initialize chart on load
window.addEventListener("load", () => initStatsChart(currentChartType));
