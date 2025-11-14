document.addEventListener("DOMContentLoaded", function () {
    const statCards = document.querySelectorAll('.stat-card');

    const labels = [];
    const data = [];
    const backgroundColors = [];

    statCards.forEach(card => {
        labels.push(card.querySelector('span').textContent.trim());
        data.push(parseInt(card.querySelector('.number').textContent.trim()));
        const style = window.getComputedStyle(card);
        backgroundColors.push(style.backgroundColor);
    });

    const ctx = document.getElementById('statsPieChart').getContext('2d');
    const statsPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'right', 
                    labels: {
                        boxWidth: 20,
                        padding: 15 // increase padding to push legend further right
                    }
                },
                tooltip: {
                    enabled: true, // enable hover tooltip
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                            const value = context.raw;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                },
                datalabels: {
                    display: false // hide permanent inside-chart labels
                }
            }
        },
        plugins: [ChartDataLabels]
    });
});
