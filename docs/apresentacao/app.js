document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.slide');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const slideIndicator = document.getElementById('slideIndicator');
    const progressBar = document.getElementById('progressBar');
    const container = document.getElementById('presentationContainer');
    
    let currentSlide = 0;
    const totalSlides = slides.length;

    // Inicialização de Navegação
    function updateSlides() {
        slides.forEach((slide, idx) => {
            slide.classList.remove('active', 'prev');
            if (idx === currentSlide) {
                slide.classList.add('active');
            } else if (idx < currentSlide) {
                slide.classList.add('prev');
            }
        });

        // Atualizar controles
        slideIndicator.textContent = `${currentSlide + 1} / ${totalSlides}`;
        progressBar.style.width = `${((currentSlide + 1) / totalSlides) * 100}%`;

        // Renderizar gráficos se os slides respectivos forem ativados
        // Slide 9: Drawdown
        if (currentSlide === 8) {
            renderDrawdownChart();
        }
        // Slide 10: Performance
        if (currentSlide === 9) {
            renderPerformanceChart();
        }
    }

    function nextSlide() {
        if (currentSlide < totalSlides - 1) {
            currentSlide++;
            updateSlides();
        }
    }

    function prevSlide() {
        if (currentSlide > 0) {
            currentSlide--;
            updateSlides();
        }
    }

    prevBtn.addEventListener('click', prevSlide);
    nextBtn.addEventListener('click', nextSlide);

    // Suporte a teclado
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'Space') {
            nextSlide();
        } else if (e.key === 'ArrowLeft') {
            prevSlide();
        }
    });

    // Suporte a Toque de Dedo (Swipe) para Celulares
    let touchStartX = 0;
    let touchEndX = 0;

    container.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const threshold = 50; // distância mínima
        if (touchStartX - touchEndX > threshold) {
            nextSlide();
        } else if (touchEndX - touchStartX > threshold) {
            prevSlide();
        }
    }

    // Gráfico de Drawdown Explicativo do Painel Real (Slide 9)
    function renderDrawdownChart() {
        const svg = document.getElementById('drawdownChartSvg');
        if (!svg) return;
        svg.innerHTML = '';

        // Pontos de rebaixamento realistas baseados na aba "Perfil de Rebaixamento" do print
        const points = [
            { x: 10, y: 15 },
            { x: 50, y: 55 },
            { x: 90, y: 25 },
            { x: 130, y: 80 },  // Rebaixamento maior
            { x: 170, y: 35 },
            { x: 210, y: 110 }, // Pico de rebaixamento (próximo de R$ 3.450)
            { x: 250, y: 45 },
            { x: 290, y: 95 },
            { x: 330, y: 20 },
            { x: 390, y: 15 }
        ];

        let pathD = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            pathD += ` L ${points[i].x} ${points[i].y}`;
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#ef4444');
        path.setAttribute('stroke-width', '2.5');
        svg.appendChild(path);

        // Preenchimento vermelho transparente da área de drawdown
        const fillPathD = `${pathD} L 390 140 L 10 140 Z`;
        const fillArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        fillArea.setAttribute('d', fillPathD);
        fillArea.setAttribute('fill', 'rgba(239, 68, 68, 0.12)');
        svg.appendChild(fillArea);

        // Adicionar texto informando o drawdown máximo do painel
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '15');
        text.setAttribute('y', '125');
        text.setAttribute('fill', '#ef4444');
        text.setAttribute('font-size', '10');
        text.setAttribute('font-family', 'sans-serif');
        text.setAttribute('font-weight', '600');
        text.textContent = 'Drawdown Máx Real: R$ 4.534,50';
        svg.appendChild(text);

        points.forEach((p, idx) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', p.x);
            circle.setAttribute('cy', p.y);
            circle.setAttribute('r', p.y > 90 ? '4.5' : '2.5');
            circle.setAttribute('fill', p.y > 90 ? '#ef4444' : 'rgba(239, 68, 68, 0.7)');
            svg.appendChild(circle);
        });
    }

    // Gráfico de Curva de Capital Acumulada Real (Slide 10)
    function renderPerformanceChart() {
        const svg = document.getElementById('performanceChartSvg');
        if (!svg) return;
        svg.innerHTML = '';

        // Curva de patrimônio em crescimento realista baseada na "Curva de Capital" do print
        const points = [
            { x: 10, y: 130 },
            { x: 40, y: 125 },
            { x: 70, y: 110 },
            { x: 100, y: 112 },
            { x: 130, y: 95 },
            { x: 160, y: 88 },
            { x: 190, y: 78 },
            { x: 220, y: 84 },
            { x: 250, y: 65 },
            { x: 280, y: 55 },
            { x: 310, y: 35 },
            { x: 350, y: 40 },
            { x: 390, y: 20 }
        ];

        let pathD = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            pathD += ` L ${points[i].x} ${points[i].y}`;
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#38bdf8');
        path.setAttribute('stroke-width', '3');
        svg.appendChild(path);

        const fillPathD = `${pathD} L 390 140 L 10 140 Z`;
        const fillArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        fillArea.setAttribute('d', fillPathD);
        fillArea.setAttribute('fill', 'rgba(56, 189, 248, 0.08)');
        svg.appendChild(fillArea);

        // Adicionar texto informando o Retorno Total do painel
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '15');
        text.setAttribute('y', '30');
        text.setAttribute('fill', '#10b981');
        text.setAttribute('font-size', '11');
        text.setAttribute('font-family', 'sans-serif');
        text.setAttribute('font-weight', '700');
        text.textContent = 'Retorno Real: +R$ 62.514,35 (+125.03%)';
        svg.appendChild(text);

        points.forEach((p) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', p.x);
            circle.setAttribute('cy', p.y);
            circle.setAttribute('r', '3');
            circle.setAttribute('fill', '#d4af37');
            svg.appendChild(circle);
        });
    }

    // Inicialização da primeira tela
    updateSlides();
});
