document.addEventListener("DOMContentLoaded", function () {
    // Grab all the stat cards
    const statCards = document.querySelectorAll('.stats-cards-grid .stat-card');

    const labels = [];
    const data = [];
    const backgroundColors = [];

    statCards.forEach(card => {
        // Label
        labels.push(card.querySelector('span').textContent.trim());
        // Number
        data.push(parseInt(card.querySelector('.number').textContent.trim()));
        // Background color (computed from CSS)
        const style = window.getComputedStyle(card);
        backgroundColors.push(style.backgroundColor);
    });

    // Initialize Chart.js
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
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(217, 185, 155, 0.8)', // semi-transparent #d9b99b
                    titleColor: '#000',    // optional: title text color
                    bodyColor: '#000',     // optional: body text color
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                            const value = context.raw;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${percentage}%`;
                        }
                    }
                }
            }
        }
    });
});
