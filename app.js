// app.js - Lógica do Dashboard JF Mercado Macro

let rawTrades = [];
let currentTab = 'consolidated';
let currentMonth = 'all';
let searchQuery = '';

// Elementos DOM
const pnlMetricEl = document.getElementById('metric-pnl');
const ddMetricEl = document.getElementById('metric-dd');
const wrMetricEl = document.getElementById('metric-wr');
const tradesMetricEl = document.getElementById('metric-trades');
const tableBodyEl = document.getElementById('trades-table-body');
const tableShowingEl = document.getElementById('table-showing-text');
const monthFilterEl = document.getElementById('month-filter');
const searchEl = document.getElementById('table-search');
const tabTitleEl = document.getElementById('current-tab-title');
const tabDescEl = document.getElementById('current-tab-desc');

// Instâncias de Gráficos
let equityChart = null;
let drawdownChart = null;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('trades_cleaned.json');
        rawTrades = await response.json();
        
        // Configurar Eventos
        setupTabEvents();
        setupFilterEvents();
        
        // Renderizar inicial
        updateDashboard();
    } catch (error) {
        console.error("Erro ao carregar dados dos trades:", error);
    }
});

function setupTabEvents() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            
            const targetBtn = e.currentTarget;
            targetBtn.classList.add('active');
            
            currentTab = targetBtn.getAttribute('data-tab');
            
            // Atualiza títulos
            if (currentTab === 'consolidated') {
                tabTitleEl.innerText = "Consolidado das Estratégias";
                tabDescEl.innerText = "Visão agregada e curva de capital de todo o portfólio.";
            } else {
                tabTitleEl.innerText = currentTab;
                tabDescEl.innerText = `Resultados e histórico individual para a estratégia ${currentTab}.`;
            }
            
            updateDashboard();
        });
    });
}

function setupFilterEvents() {
    monthFilterEl.addEventListener('change', (e) => {
        currentMonth = e.target.value;
        updateDashboard();
    });

    searchEl.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderTable();
    });
}

// Filtra os trades baseados no Tab e no Mês ativos
function getFilteredTrades() {
    return rawTrades.filter(t => {
        // Filtro de Tab
        const matchTab = currentTab === 'consolidated' || t.strategy === currentTab;
        
        // Filtro de Mês
        const matchMonth = currentMonth === 'all' || t.date.startsWith(currentMonth);
        
        return matchTab && matchMonth;
    });
}

function updateDashboard() {
    const filteredTrades = getFilteredTrades();
    
    // 1. Calcular Métricas
    calculateMetrics(filteredTrades);
    
    // 2. Gerar Gráficos
    renderCharts(filteredTrades);
    
    // 3. Renderizar Tabela
    renderTable();
}

function formatCurrency(val) {
    // Format to Brazilian Real
    const isIndice = currentTab === 'ABERTURA INDICE';
    if (isIndice && currentTab !== 'consolidated') {
        // Se estiver apenas vendo Índice, exibe em pontos
        return `${val.toLocaleString('pt-BR')} pts`;
    }
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calculateMetrics(trades) {
    if (trades.length === 0) {
        pnlMetricEl.innerText = formatCurrency(0);
        ddMetricEl.innerText = formatCurrency(0);
        wrMetricEl.innerText = "0.0%";
        tradesMetricEl.innerText = "0";
        pnlMetricEl.className = "metric-value";
        return;
    }

    let totalPnl = 0;
    let winCount = 0;
    let totalTrades = 0;
    
    // Variáveis para drawdown
    let currentEquity = 0;
    let peakEquity = 0;
    let maxDrawdown = 0;

    // Ordenar trades por data para calcular curva corretamente
    const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));

    sorted.forEach(t => {
        totalPnl += t.pnl;
        currentEquity += t.pnl;
        
        // Drawdown
        if (currentEquity > peakEquity) {
            peakEquity = currentEquity;
        }
        const dd = peakEquity - currentEquity;
        if (dd > maxDrawdown) {
            maxDrawdown = dd;
        }

        // Win Rate (considera ganhos > 0)
        if (t.pnl > 0) {
            winCount++;
        }
        
        // Apenas conta como trade se não for INABILITADO
        if (t.stop !== 'INABILITADO' && t.stop !== 'INABILITOU') {
            totalTrades++;
        }
    });

    // PnL classe css
    pnlMetricEl.innerText = formatCurrency(totalPnl);
    if (totalPnl > 0) {
        pnlMetricEl.className = "metric-value positive";
    } else if (totalPnl < 0) {
        pnlMetricEl.className = "metric-value negative";
    } else {
        pnlMetricEl.className = "metric-value";
    }

    ddMetricEl.innerText = formatCurrency(maxDrawdown);
    tradesMetricEl.innerText = totalTrades;
    
    const wr = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
    wrMetricEl.innerText = `${wr.toFixed(1)}%`;
}

function renderCharts(trades) {
    if (trades.length === 0) {
        if (equityChart) equityChart.destroy();
        if (drawdownChart) drawdownChart.destroy();
        document.getElementById('equity-chart').innerHTML = `<div class="no-data">Nenhuma operação no período.</div>`;
        document.getElementById('drawdown-chart').innerHTML = `<div class="no-data">Nenhuma operação no período.</div>`;
        return;
    }

    // Ordena por data
    const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));

    // Agrupa PnL por data para curvas mais limpas
    const dailyData = {};
    sorted.forEach(t => {
        if (!dailyData[t.date]) {
            dailyData[t.date] = 0;
        }
        dailyData[t.date] += t.pnl;
    });

    const dates = Object.keys(dailyData).sort();
    
    let cumEquity = 0;
    let peak = 0;
    const equityValues = [0];
    const drawdownValues = [0];

    dates.forEach(d => {
        cumEquity += dailyData[d];
        equityValues.push(cumEquity);
        
        if (cumEquity > peak) {
            peak = cumEquity;
        }
        const dd = peak - cumEquity;
        drawdownValues.push(-dd); // Drawdown negativo para fins de exibição clássica
    });

    const chartDates = ["Início", ...dates];

    // Opções comuns de charts
    const commonOptions = {
        theme: { mode: 'dark' },
        chart: {
            foreColor: '#8E9BAE',
            background: 'transparent',
            toolbar: { show: false },
            zoom: { enabled: false }
        },
        grid: {
            borderColor: '#202733',
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } }
        },
        tooltip: {
            theme: 'dark',
            x: { format: 'dd/MM/yyyy' }
        }
    };

    // Equity Curve Chart
    const equityOptions = {
        ...commonOptions,
        chart: {
            ...commonOptions.chart,
            type: 'line',
            id: 'equity-curve'
        },
        stroke: {
            curve: 'smooth',
            width: 3
        },
        colors: ['#00E5FF'],
        series: [{
            name: 'PnL Acumulado',
            data: equityValues
        }],
        xaxis: {
            categories: chartDates,
            labels: {
                rotate: -45,
                style: { fontSize: '10px' }
            }
        },
        yaxis: {
            labels: {
                formatter: (val) => formatCurrency(val)
            }
        }
    };

    // Drawdown Chart
    const drawdownOptions = {
        ...commonOptions,
        chart: {
            ...commonOptions.chart,
            type: 'area',
            id: 'drawdown-curve'
        },
        stroke: {
            curve: 'smooth',
            width: 2
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.4,
                opacityTo: 0.1,
                stops: [0, 90, 100]
            }
        },
        colors: ['#FF1744'],
        series: [{
            name: 'Rebaixamento',
            data: drawdownValues
        }],
        xaxis: {
            categories: chartDates,
            labels: {
                rotate: -45,
                style: { fontSize: '10px' }
            }
        },
        yaxis: {
            labels: {
                formatter: (val) => formatCurrency(Math.abs(val))
            }
        }
    };

    // Render / Update
    if (equityChart) equityChart.destroy();
    if (drawdownChart) drawdownChart.destroy();

    document.getElementById('equity-chart').innerHTML = '';
    document.getElementById('drawdown-chart').innerHTML = '';

    equityChart = new ApexCharts(document.getElementById('equity-chart'), equityOptions);
    equityChart.render();

    drawdownChart = new ApexCharts(document.getElementById('drawdown-chart'), drawdownOptions);
    drawdownChart.render();
}

function renderTable() {
    const filteredTrades = getFilteredTrades();
    
    // Filtrar por busca (pesquisa query)
    const searchedTrades = filteredTrades.filter(t => {
        return t.date.includes(searchQuery) ||
               t.strategy.toLowerCase().includes(searchQuery) ||
               t.direction.toLowerCase().includes(searchQuery) ||
               (t.stop && t.stop.toLowerCase().includes(searchQuery)) ||
               (t.alvo && t.alvo.toLowerCase().includes(searchQuery));
    });

    // Ordenar trades de forma decrescente por data para exibir os mais recentes no topo
    const sortedTrades = [...searchedTrades].sort((a, b) => b.date.localeCompare(a.date));

    tableBodyEl.innerHTML = '';
    
    if (sortedTrades.length === 0) {
        tableBodyEl.innerHTML = `<tr><td colspan="8" class="text-center" style="text-align: center; padding: 30px; color: var(--text-secondary);">Nenhuma operação encontrada.</td></tr>`;
        tableShowingEl.innerText = "Mostrando 0 de 0 operações";
        return;
    }

    sortedTrades.forEach(t => {
        const tr = document.createElement('tr');
        
        // Formata direção
        const dirBadge = t.direction === 'COMPRA' ? '<span class="badge compra">Compra</span>' : '<span class="badge venda">Venda</span>';
        
        // Formata Badges de status
        const formatStatusBadge = (status) => {
            if (!status || status === 'None' || status === 'NÃO') return '<span style="color: var(--text-secondary);">-</span>';
            if (status === 'OK') return '<span class="badge status-ok">OK</span>';
            if (status === 'INABILITADO' || status === 'INABILITOU') return '<span class="badge status-not">INAB.</span>';
            return `<span class="badge status-zero">${status}</span>`;
        };

        const stopBadge = formatStatusBadge(t.stop);
        const p1Badge = formatStatusBadge(t.p1 || t.zero_zero);
        const p2Badge = formatStatusBadge(t.p2);
        const alvoBadge = formatStatusBadge(t.alvo);

        // Resultado class
        let resultClass = "";
        let prefix = "";
        if (t.pnl > 0) {
            resultClass = "text-positive";
            prefix = "+";
        } else if (t.pnl < 0) {
            resultClass = "text-negative";
        }

        // Formata PnL de acordo com a estratégia/tab ativa
        const formattedPnL = formatCurrency(t.pnl);

        tr.innerHTML = `
            <td>${formatDateBR(t.date)}</td>
            <td><strong>${t.strategy}</strong></td>
            <td>${dirBadge}</td>
            <td>${stopBadge}</td>
            <td>${p1Badge}</td>
            <td>${p2Badge}</td>
            <td>${alvoBadge}</td>
            <td class="${resultClass}"><strong>${prefix}${formattedPnL}</strong></td>
        `;
        tableBodyEl.appendChild(tr);
    });

    tableShowingEl.innerText = `Mostrando ${sortedTrades.length} de ${filteredTrades.length} operações`;
}

function formatDateBR(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}
