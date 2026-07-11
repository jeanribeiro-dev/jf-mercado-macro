// app.js - Lógica do Dashboard JF Mercado Macro

let rawTrades = [];
let selectedStrategies = ['ABERTURA INDICE', 'ABERTURA DOLAR', 'HEDGE DÓLAR', 'DI ABERTURA', 'HEDGE ÍNDICE'];
let currentPeriod = 'all';
let currentProfile = 'arrojado';
let searchQuery = '';
let isLocal = false;

// Elementos DOM
const pnlMetricEl = document.getElementById('metric-pnl');
const ddMetricEl = document.getElementById('metric-dd');
const wrMetricEl = document.getElementById('metric-wr');
const tradesMetricEl = document.getElementById('metric-trades');
const tableBodyEl = document.getElementById('trades-table-body');
const tableShowingEl = document.getElementById('table-showing-text');
const periodFilterEl = document.getElementById('period-filter');
const customDateInputsEl = document.getElementById('custom-date-inputs');
const dateStartEl = document.getElementById('date-start');
const dateEndEl = document.getElementById('date-end');
const searchEl = document.getElementById('table-search');
const tabTitleEl = document.getElementById('current-tab-title');
const tabDescEl = document.getElementById('current-tab-desc');

// Instâncias de Gráficos
let equityChart = null;
let drawdownChart = null;

// Lógica de Modal e Inserção de Dados
const tradeModal = document.getElementById('trade-modal');
const openModalBtn = document.getElementById('open-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelFormBtn = document.getElementById('cancel-form-btn');
const tradeForm = document.getElementById('trade-form');
const tradeStrategySelect = document.getElementById('trade-strategy');
const syncBtn = document.getElementById('sync-btn');

// Lógica de Modal do PDF
const pdfModal = document.getElementById('pdf-modal');
const openPdfModalBtn = document.getElementById('open-pdf-modal-btn');
const closePdfModalBtn = document.getElementById('close-pdf-modal-btn');
const cancelPdfBtn = document.getElementById('cancel-pdf-btn');
const pdfForm = document.getElementById('pdf-form');
const pdfMonthSelect = document.getElementById('pdf-month-select');

// Elementos de formulário dinâmicos
const groupP1 = document.getElementById('group-p1');
const labelP1 = document.getElementById('label-p1');
const groupP2 = document.getElementById('group-p2');
const groupAlvo = document.getElementById('group-alvo');

// Inicialização
document.addEventListener('DOMContentLoaded', init);

// Listeners dos Perfis de Risco
const profileBtns = document.querySelectorAll('.profile-btn');
profileBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all
        profileBtns.forEach(b => b.classList.remove('active'));
        // Add active to clicked
        btn.classList.add('active');
        // Update state
        currentProfile = btn.getAttribute('data-profile');
        // Re-render
        updateDashboard();
    });
});

async function init() {
    try {
        const response = await fetch(`data/trades_cleaned.json?t=${Date.now()}`);
        if (!response.ok) {
            alert("Erro ao carregar dados: " + response.status + " " + response.statusText);
        }
        rawTrades = await response.json();
        rawTrades.forEach((t, i) => t._originalIndex = i);
        
        // Configurar Eventos
        setupTabEvents();
        setupFilterEvents();
        setupPdfReportEvents();
        loadPdfMonths();
        
        // Verificar se está rodando via Servidor Local
        isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (!isLocal) {
            const statusDot = document.querySelector('.dot');
            statusDot.className = 'dot';
            if (window.location.protocol === 'file:') {
                statusDot.style.backgroundColor = 'var(--color-negative)';
                statusDot.style.boxShadow = '0 0 8px var(--color-negative)';
                document.getElementById('status-text').innerText = 'Modo Offline (Sem Servidor)';
                
                syncBtn.title = 'Inicie o painel pelo atalho na Área de Trabalho para poder sincronizar.';
                openModalBtn.title = 'Inicie o painel pelo atalho na Área de Trabalho para poder adicionar trades.';
            } else {
                statusDot.style.backgroundColor = 'var(--color-info)';
                statusDot.style.boxShadow = '0 0 8px var(--color-info)';
                document.getElementById('status-text').innerText = 'Nuvem (Apenas Leitura)';
                
                syncBtn.title = 'Sincronização disponível apenas no painel local.';
                openModalBtn.title = 'Registro disponível apenas no painel local.';
            }
            
            // Ocultar cabeçalho da coluna de Ações
            const actionsHeader = document.getElementById('actions-header');
            if (actionsHeader) actionsHeader.style.display = 'none';
            
            // Desabilitar botões
            syncBtn.style.opacity = '0.5';
            syncBtn.disabled = true;
            openModalBtn.style.opacity = '0.5';
            openModalBtn.disabled = true;
        }
        
        // Renderizar inicial
        updateDashboard();
    } catch (error) {
        console.error("Erro ao carregar dados dos trades:", error);
    }
}

function setupTabEvents() {
    const btnAll = document.getElementById('btn-all');
    const stratBtns = document.querySelectorAll('.strat-btn');

    // Botão "Todas Juntas"
    btnAll.addEventListener('click', () => {
        btnAll.classList.add('active');
        stratBtns.forEach(btn => btn.classList.add('active'));
        
        selectedStrategies = ['ABERTURA INDICE', 'ABERTURA DOLAR', 'HEDGE DÓLAR', 'DI ABERTURA', 'HEDGE ÍNDICE'];
        tabTitleEl.innerText = "Consolidado das Estratégias";
        tabDescEl.innerText = "Visão agregada e curva de capital de todo o portfólio.";
        
        updateDashboard();
    });

    // Botões das Estratégias individuais (Toggles)
    stratBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const activeBtns = document.querySelectorAll('.strat-btn.active');
            
            // Garantir que pelo menos uma estratégia esteja selecionada
            if (btn.classList.contains('active') && activeBtns.length === 1) {
                // Impede desmarcar o último botão ativo
                return;
            }
            
            // Alterna o estado ativo
            btn.classList.toggle('active');
            
            // Recalcula estratégias ativas
            const currentActiveBtns = document.querySelectorAll('.strat-btn.active');
            selectedStrategies = Array.from(currentActiveBtns).map(b => b.getAttribute('data-strategy'));
            
            if (currentActiveBtns.length === 5) {
                btnAll.classList.add('active');
                tabTitleEl.innerText = "Consolidado das Estratégias";
                tabDescEl.innerText = "Visão agregada e curva de capital de todo o portfólio.";
            } else {
                btnAll.classList.remove('active');
                
                // Monta título customizado com base nas selecionadas
                if (selectedStrategies.length === 1) {
                    tabTitleEl.innerText = selectedStrategies[0];
                    tabDescEl.innerText = `Resultados e histórico individual para a estratégia ${selectedStrategies[0]}.`;
                } else {
                    tabTitleEl.innerText = "Portfólio Customizado";
                    tabDescEl.innerText = `Visualização combinada das estratégias selecionadas: ${selectedStrategies.join(', ')}.`;
                }
            }
            
            updateDashboard();
        });
    });
}

function setupFilterEvents() {
    periodFilterEl.addEventListener('change', (e) => {
        currentPeriod = e.target.value;
        if (currentPeriod === 'custom') {
            customDateInputsEl.style.display = 'flex';
        } else {
            customDateInputsEl.style.display = 'none';
        }
        updateDashboard();
    });

    dateStartEl.addEventListener('change', updateDashboard);
    dateEndEl.addEventListener('change', updateDashboard);

    searchEl.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderTable();
    });
}

// Filtra os trades baseados nas estratégias e no Período ativos
function getFilteredTrades() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let multiplier = 1.0;
    if (currentProfile === 'moderado') multiplier = 0.5;
    if (currentProfile === 'conservador') multiplier = 0.3;

    return rawTrades
        .filter(t => {
            // Filtro de Estratégias
            const matchTab = selectedStrategies.includes(t.strategy);
            
            // Filtro de Período
            let matchPeriod = true;
        
        if (currentPeriod === '7days' || currentPeriod === '30days') {
            const tradeDate = new Date(t.date + 'T00:00:00');
            const diffTime = today - tradeDate;
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            
            const limit = currentPeriod === '7days' ? 7 : 30;
            matchPeriod = diffDays >= 0 && diffDays <= limit;
        } else if (currentPeriod === 'custom') {
            const startVal = dateStartEl.value;
            const endVal = dateEndEl.value;
            let matchStart = true;
            let matchEnd = true;
            if (startVal) matchStart = t.date >= startVal;
            if (endVal) matchEnd = t.date <= endVal;
            matchPeriod = matchStart && matchEnd;
        }
        
            return matchTab && matchPeriod;
        })
        .map(t => {
            return {
                ...t,
                pnl: t.pnl * multiplier
            };
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
    // Format all to Brazilian Real
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calculateMetrics(trades) {
    const pnlMetricEl = document.getElementById('metric-pnl');
    const ddMetricEl = document.getElementById('metric-dd');
    const initialDdMetricEl = document.getElementById('metric-initial-dd');
    const wrMetricEl = document.getElementById('metric-wr');
    const tradesMetricEl = document.getElementById('metric-trades');
    const winStreakEl = document.getElementById('metric-win-streak');
    const lossStreakEl = document.getElementById('metric-loss-streak');
    
    const roiMetricEl = document.getElementById('metric-roi');
    
    if (trades.length === 0) {
        pnlMetricEl.innerText = "R$ 0,00";
        if (roiMetricEl) {
            roiMetricEl.innerText = "0.00%";
            roiMetricEl.className = "roi-badge";
        }
        ddMetricEl.innerText = "R$ 0,00";
        if (initialDdMetricEl) initialDdMetricEl.innerText = "R$ 0,00";
        wrMetricEl.innerText = "0.0%";
        tradesMetricEl.innerText = "0";
        if (winStreakEl) winStreakEl.innerText = "0";
        if (lossStreakEl) lossStreakEl.innerText = "0";
        pnlMetricEl.className = "metric-value";
        return;
    }

    let totalPnl = 0;

    let winCount = 0;
    let totalTrades = 0;
    
    // Variáveis para drawdown e sequências
    let currentEquity = 0;
    let peakEquity = 0;
    let maxDrawdown = 0;
    let maxInitialDrawdown = 0;
    
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;

    // Ordenar trades por data para calcular curva corretamente
    const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));

    sorted.forEach(t => {
        totalPnl += t.pnl;
        currentEquity += t.pnl;
        
        // Rebaixamento Máx (Initial Drawdown)
        if (currentEquity < maxInitialDrawdown) {
            maxInitialDrawdown = currentEquity;
        }

        // Drawdown Histórico
        if (currentEquity > peakEquity) {
            peakEquity = currentEquity;
        }
        const dd = peakEquity - currentEquity;
        if (dd > maxDrawdown) {
            maxDrawdown = dd;
        }

        // Win Rate & Streaks (considera > 0 e < 0)
        if (t.pnl > 0) {
            winCount++;
            currentWinStreak++;
            currentLossStreak = 0;
            if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
        } else if (t.pnl < 0) {
            currentLossStreak++;
            currentWinStreak = 0;
            if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
        } else {
            // Operações no zero-a-zero não resetam necessariamente, mas vamos zerar ambas para ser rigoroso
            currentWinStreak = 0;
            currentLossStreak = 0;
        }
        
        // Apenas conta como trade se não for INABILITADO
        if (t.stop !== 'INABILITADO' && t.stop !== 'INABILITOU') {
            totalTrades++;
        }
    });

    // PnL classe css
    pnlMetricEl.className = "metric-value";
    pnlMetricEl.innerText = formatCurrency(totalPnl);
    if (totalPnl > 0) {
        pnlMetricEl.classList.add("positive");
        pnlMetricEl.innerText = "+" + pnlMetricEl.innerText;
        if (roiMetricEl) roiMetricEl.className = "roi-badge positive";
    } else if (totalPnl < 0) {
        pnlMetricEl.classList.add("negative");
        if (roiMetricEl) roiMetricEl.className = "roi-badge negative";
    } else {
        if (roiMetricEl) roiMetricEl.className = "roi-badge";
    }

    if (roiMetricEl) {
        const roi = (totalPnl / 50000) * 100;
        const sign = roi > 0 ? '+' : '';
        roiMetricEl.innerText = `${sign}${roi.toFixed(2)}%`;
    }

    ddMetricEl.innerText = formatCurrency(maxDrawdown);
    if (initialDdMetricEl) initialDdMetricEl.innerText = formatCurrency(Math.abs(maxInitialDrawdown));
    
    tradesMetricEl.innerText = totalTrades;
    if (winStreakEl) winStreakEl.innerText = maxWinStreak;
    if (lossStreakEl) lossStreakEl.innerText = maxLossStreak;
    
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
        tableBodyEl.innerHTML = `<tr><td colspan="9" class="text-center" style="text-align: center; padding: 30px; color: var(--text-secondary);">Nenhuma operação encontrada.</td></tr>`;
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
            ${isLocal ? `
            <td>
                <button class="action-btn delete-btn" style="background: transparent; color: var(--color-negative); padding: 4px; border: none; cursor: pointer;" onclick="deleteTrade(${t._originalIndex})" title="Excluir Operação">
                    <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                </button>
            </td>
            ` : ''}
        `;
        tableBodyEl.appendChild(tr);
    });

    tableShowingEl.innerText = `Mostrando ${sortedTrades.length} de ${filteredTrades.length} operações`;
    lucide.createIcons(); // Recria ícones para os botões recém adicionados
}

function formatDateBR(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

// Eventos de Abertura/Fechamento do Modal
openModalBtn.addEventListener('click', () => {
    // Definir data padrão como hoje no input de data
    document.getElementById('trade-date').value = new Date().toISOString().split('T')[0];
    tradeModal.classList.add('active');
    updateFormFields(); // atualiza visibilidade dos campos com base na estratégia padrão
});

const closeModal = () => {
    tradeModal.classList.remove('active');
    tradeForm.reset();
};

closeModalBtn.addEventListener('click', closeModal);
cancelFormBtn.addEventListener('click', closeModal);

// Fecha se clicar fora do container
tradeModal.addEventListener('click', (e) => {
    if (e.target === tradeModal) {
        closeModal();
    }
});

// Atualiza visibilidade dos campos com base na estratégia selecionada
tradeStrategySelect.addEventListener('change', updateFormFields);

function updateFormFields() {
    const strat = tradeStrategySelect.value;
    
    if (strat === 'ABERTURA INDICE') {
        groupP1.style.display = 'flex';
        labelP1.innerText = 'Parcial 1';
        groupP2.style.display = 'flex';
        groupAlvo.style.display = 'flex';
    } else if (strat === 'ABERTURA DOLAR' || strat === 'DI ABERTURA') {
        groupP1.style.display = 'flex';
        labelP1.innerText = 'Parcial 1 / 0x0';
        groupP2.style.display = 'none';
        groupAlvo.style.display = 'flex';
    } else if (strat === 'HEDGE DÓLAR') {
        groupP1.style.display = 'none';
        groupP2.style.display = 'none';
        groupAlvo.style.display = 'flex';
    }
}

// Envio do Formulário para adicionar o trade
tradeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const dateVal = document.getElementById('trade-date').value;
    const strategyVal = tradeStrategySelect.value;
    const directionVal = document.getElementById('trade-direction').value;
    const stopVal = document.getElementById('trade-stop').value;
    const pnlVal = parseFloat(document.getElementById('trade-pnl').value);

    // Preparar objeto de status
    const status = {};
    if (strategyVal === 'ABERTURA INDICE') {
        status.stop = stopVal;
        status.p1 = document.getElementById('trade-p1').value;
        status.p2 = document.getElementById('trade-p2').value;
        status.alvo = document.getElementById('trade-alvo').value;
    } else if (strategyVal === 'ABERTURA DOLAR' || strategyVal === 'DI ABERTURA') {
        status.stop = stopVal;
        status.zero_zero = document.getElementById('trade-p1').value;
        status.alvo = document.getElementById('trade-alvo').value;
    } else if (strategyVal === 'HEDGE DÓLAR') {
        status.stop = stopVal;
        status.alvo = document.getElementById('trade-alvo').value;
    }

    const payload = {
        date: dateVal,
        strategy: strategyVal,
        direction: directionVal,
        pnl: pnlVal,
        ...status
    };

    try {
        const response = await fetch('/api/add-trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if (result.status === 'success') {
            alert(result.message);
            closeModal();
            
            // Recarregar os dados do painel recém-salvos
            const getResponse = await fetch(`data/trades_cleaned.json?t=${Date.now()}`);
            rawTrades = await getResponse.json();
            rawTrades.forEach((t, i) => t._originalIndex = i);
            updateDashboard();
        } else {
            alert("Erro ao salvar: " + result.message);
        }
    } catch (err) {
        console.error("Erro na requisição:", err);
        alert("Erro de conexão com o servidor local.");
    }
});

// Sincronização automática com Netlify/GitHub
syncBtn.addEventListener('click', async () => {
    const icon = syncBtn.querySelector('svg') || syncBtn.querySelector('i');
    if (icon) icon.classList.add('rotating');
    syncBtn.disabled = true;
    
    try {
        const response = await fetch('/api/sync', { method: 'POST' });
        const result = await response.json();
        
        alert(result.message);
    } catch (err) {
        console.error("Erro ao sincronizar:", err);
        alert("Erro ao conectar com o servidor para sincronização.");
    } finally {
        if (icon) icon.classList.remove('rotating');
        syncBtn.disabled = false;
    }
});

// Exclusão de Trade
window.deleteTrade = async function(index) {
    if (!confirm("Deseja realmente excluir esta operação?")) return;
    
    try {
        const response = await fetch('/api/delete-trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index })
        });
        
        const result = await response.json();
        if (result.status === 'success') {
            alert(result.message);
            // Recarregar os dados
            const getResponse = await fetch(`data/trades_cleaned.json?t=${Date.now()}`);
            rawTrades = await getResponse.json();
            rawTrades.forEach((t, i) => t._originalIndex = i);
            updateDashboard();
        } else {
            alert("Erro ao excluir: " + result.message);
        }
    } catch (err) {
        console.error("Erro na requisição:", err);
        alert("Erro de conexão com o servidor local.");
    }
};

// ==========================================
// FUNÇÕES DE EXPORTAÇÃO MENSAL EM PDF
// ==========================================

function loadPdfMonths() {
    if (!pdfMonthSelect) return;
    
    // Extrai meses únicos das operações YYYY-MM
    const months = new Set();
    rawTrades.forEach(t => {
        if (t.date && t.date.length >= 7) {
            months.add(t.date.substring(0, 7));
        }
    });
    
    // Ordena de forma decrescente (mais recente primeiro)
    const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));
    
    pdfMonthSelect.innerHTML = '';
    sortedMonths.forEach(ym => {
        const option = document.createElement('option');
        option.value = ym;
        option.innerText = formatMonthYear(ym);
        pdfMonthSelect.appendChild(option);
    });
}

function formatMonthYear(ymString) {
    const [year, month] = ymString.split('-');
    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const monthIdx = parseInt(month, 10) - 1;
    return `${monthNames[monthIdx]} de ${year}`;
}

function setupPdfReportEvents() {
    if (!openPdfModalBtn || !pdfModal || !closePdfModalBtn || !cancelPdfBtn || !pdfForm) return;
    
    openPdfModalBtn.addEventListener('click', () => {
        loadPdfMonths(); // Recarrega sempre para garantir novos dados inseridos
        pdfModal.classList.add('active');
    });
    
    const closePdfModal = () => {
        pdfModal.classList.remove('active');
    };
    
    closePdfModalBtn.addEventListener('click', closePdfModal);
    cancelPdfBtn.addEventListener('click', closePdfModal);
    
    pdfModal.addEventListener('click', (e) => {
        if (e.target === pdfModal) {
            closePdfModal();
        }
    });
    
    pdfForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedMonth = pdfMonthSelect.value;
        if (!selectedMonth) return;
        
        // Desabilitar o botão enquanto gera o PDF
        const submitBtn = pdfForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        submitBtn.innerText = "Gerando PDF...";
        submitBtn.disabled = true;
        
        try {
            await generatePdfReport(selectedMonth);
            closePdfModal();
        } catch (err) {
            console.error("Erro ao gerar PDF:", err);
            alert("Ocorreu um erro ao gerar o PDF. Verifique o console.");
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });
}

async function generatePdfReport(selectedMonth) {
    // 1. Filtrar operações do mês excluindo DI ABERTURA
    // E aplicando o perfil de risco atual!
    let multiplier = 1.0;
    if (currentProfile === 'moderado') multiplier = 0.5;
    else if (currentProfile === 'conservador') multiplier = 0.3;
    
    const monthlyTrades = rawTrades.filter(t => {
        return t.date.startsWith(selectedMonth) && t.strategy !== 'DI ABERTURA';
    }).map(t => {
        return {
            ...t,
            pnl: t.pnl * multiplier
        };
    });
    
    if (monthlyTrades.length === 0) {
        alert("Nenhuma operação encontrada para o mês selecionado (excluindo DI).");
        return;
    }
    
    // Ordenar trades por data (crescente para calcular curva)
    const sortedTrades = [...monthlyTrades].sort((a, b) => a.date.localeCompare(b.date));
    
    // 2. Calcular Métricas do Mês
    let totalPnl = 0;
    let winCount = 0;
    let totalTrades = 0;
    let peakEquity = 0;
    let currentEquity = 0;
    let maxDrawdown = 0;
    
    const dailyData = {};
    
    sortedTrades.forEach(t => {
        totalPnl += t.pnl;
        currentEquity += t.pnl;
        
        // Acumular dados diários para o gráfico
        if (!dailyData[t.date]) {
            dailyData[t.date] = 0;
        }
        dailyData[t.date] += t.pnl;
        
        // Drawdown
        if (currentEquity > peakEquity) {
            peakEquity = currentEquity;
        }
        const dd = peakEquity - currentEquity;
        if (dd > maxDrawdown) {
            maxDrawdown = dd;
        }
        
        // Win Rate
        if (t.pnl > 0) {
            winCount++;
        }
        if (t.stop !== 'INABILITADO' && t.stop !== 'INABILITOU') {
            totalTrades++;
        }
    });
    
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
    const roi = (totalPnl / 50000) * 100;
    
    // Preparar dados do gráfico
    const dates = Object.keys(dailyData).sort();
    let cumEquity = 0;
    const equityValues = [0];
    dates.forEach(d => {
        cumEquity += dailyData[d];
        equityValues.push(cumEquity);
    });
    const chartDates = ["Início", ...dates];
    
    // 3. Renderizar gráfico temporário (LIGHT THEME para o PDF)
    const tempChartDiv = document.createElement('div');
    tempChartDiv.style.width = '640px';
    tempChartDiv.style.height = '280px';
    
    const offscreen = document.createElement('div');
    offscreen.style.position = 'absolute';
    offscreen.style.left = '-9999px';
    offscreen.appendChild(tempChartDiv);
    document.body.appendChild(offscreen);
    
    const tempChartOptions = {
        theme: { mode: 'light' },
        chart: {
            type: 'line',
            width: 640,
            height: 280,
            foreColor: '#475569',
            background: '#ffffff',
            toolbar: { show: false },
            animations: { enabled: false }
        },
        grid: {
            borderColor: '#e2e8f0',
            yaxis: { lines: { show: true } }
        },
        stroke: {
            curve: 'smooth',
            width: 3
        },
        colors: ['#2979FF'], // Blue accent
        series: [{
            name: 'Curva de Capital',
            data: equityValues
        }],
        xaxis: {
            categories: chartDates.map(d => {
                if (d === "Início") return d;
                const parts = d.split('-');
                return `${parts[2]}/${parts[1]}`;
            }),
            labels: {
                style: { fontSize: '9px', fontWeight: 500 }
            }
        },
        yaxis: {
            labels: {
                formatter: (val) => formatCurrency(val),
                style: { fontSize: '9px', fontWeight: 500 }
            }
        }
    };
    
    const tempChart = new ApexCharts(tempChartDiv, tempChartOptions);
    await tempChart.render();
    
    // Esperar um ciclo de renderização
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const { imgURI } = await tempChart.dataURI();
    
    // Destruir gráfico e remover div temporária
    tempChart.destroy();
    document.body.removeChild(offscreen);
    
    // 4. Montar a tabela de operações
    let tableRows = '';
    // Mostra do mais recente para o mais antigo na tabela
    const displayTrades = [...sortedTrades].reverse();
    
    displayTrades.forEach(t => {
        const formattedDate = formatDateBR(t.date);
        const dirClass = t.direction === 'COMPRA' ? 'pdf-badge compra' : 'pdf-badge venda';
        const dirText = t.direction === 'COMPRA' ? 'Compra' : 'Venda';
        
        const stopBadge = t.stop === 'OK' ? '<span class="pdf-badge ok">OK</span>' : (t.stop === 'INABILITADO' || t.stop === 'INABILITOU' ? '<span class="pdf-badge inab">INAB.</span>' : '<span class="pdf-badge no">-</span>');
        const p1Badge = t.p1 === 'OK' || t.zero_zero === 'OK' ? '<span class="pdf-badge ok">OK</span>' : '<span class="pdf-badge no">-</span>';
        const p2Badge = t.p2 === 'OK' ? '<span class="pdf-badge ok">OK</span>' : '<span class="pdf-badge no">-</span>';
        const alvoBadge = t.alvo === 'OK' ? '<span class="pdf-badge ok">OK</span>' : '<span class="pdf-badge no">-</span>';
        
        const pnlClass = t.pnl > 0 ? 'positive' : (t.pnl < 0 ? 'negative' : '');
        const prefix = t.pnl > 0 ? '+' : '';
        const formattedPnl = formatCurrency(t.pnl);
        
        tableRows += `
            <tr>
                <td>${formattedDate}</td>
                <td><strong>${t.strategy}</strong></td>
                <td><span class="${dirClass}">${dirText}</span></td>
                <td>${stopBadge}</td>
                <td>${p1Badge}</td>
                <td>${p2Badge}</td>
                <td>${alvoBadge}</td>
                <td class="${pnlClass}"><strong>${prefix}${formattedPnl}</strong></td>
            </tr>
        `;
    });
    
    const monthLabel = formatMonthYear(selectedMonth);
    const profileLabel = currentProfile.toUpperCase();
    const multiplierPct = currentProfile === 'arrojado' ? '100%' : (currentProfile === 'moderado' ? '50%' : '30%');
    
    // 5. Estrutura HTML do Relatório
    const reportContainer = document.createElement('div');
    reportContainer.className = 'pdf-report';
    reportContainer.innerHTML = `
        <!-- CABEÇALHO -->
        <div class="pdf-header">
            <div class="pdf-logo">
                <svg class="pdf-logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 28px; height: 28px; color: #2979FF;">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <div class="pdf-logo-text">
                    <h1 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; font-family: 'Inter', sans-serif;">JF MERCADO MACRO</h1>
                    <span style="font-size: 10px; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Performance Report</span>
                </div>
            </div>
            <div class="pdf-title-area">
                <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; font-family: 'Inter', sans-serif;">Relatório Mensal - ${monthLabel}</h2>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Perfil de Risco: <strong>${profileLabel} (${multiplierPct})</strong> | Capital Base: R$ 50.000,00</p>
            </div>
        </div>
        
        <!-- CARDS DE MÉTRICAS -->
        <div class="pdf-metrics-grid">
            <div class="pdf-metric-card">
                <h4>Resultado Total</h4>
                <p class="${totalPnl >= 0 ? 'positive' : 'negative'}">
                    ${totalPnl >= 0 ? '+' : ''}${formatCurrency(totalPnl)}
                </p>
            </div>
            <div class="pdf-metric-card">
                <h4>Retorno / ROI</h4>
                <p class="${totalPnl >= 0 ? 'positive' : 'negative'}">
                    ${totalPnl >= 0 ? '+' : ''}${roi.toFixed(2)}%
                </p>
            </div>
            <div class="pdf-metric-card">
                <h4>Drawdown Max</h4>
                <p class="negative">${formatCurrency(maxDrawdown)}</p>
            </div>
            <div class="pdf-metric-card">
                <h4>Taxa de Acerto</h4>
                <p>${winRate.toFixed(1)}%</p>
            </div>
            <div class="pdf-metric-card">
                <h4>Operações</h4>
                <p>${sortedTrades.length} trades</p>
            </div>
        </div>
        
        <!-- SEÇÃO DE GRÁFICO -->
        <div class="pdf-chart-section">
            <h3>Curva de Capital Acumulada no Mês</h3>
            <div class="pdf-chart-container">
                <img src="${imgURI}" alt="Equity Curve"/>
            </div>
        </div>
        
        <div class="html2pdf__page-break"></div>
        
        <!-- SEÇÃO DE OPERAÇÕES -->
        <div class="pdf-table-section">
            <h3>Detalhamento das Operações (Excluindo DI Abertura)</h3>
            <table class="pdf-table">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Estratégia</th>
                        <th>Direção</th>
                        <th>Stop</th>
                        <th>Parcial 1 / 0x0</th>
                        <th>Parcial 2</th>
                        <th>Alvo Final</th>
                        <th>Resultado (Pts/R$)</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
        
        <!-- AVISO LEGAL -->
        <div class="pdf-disclaimer">
            <strong>AVISO IMPORTANTE:</strong> Os resultados contidos neste documento são brutos e refletem unicamente o desempenho operacional das estratégias. Não estão deduzidos os custos operacionais de negociação (como corretagem institucional, taxas de registro, emolumentos da B3 e Imposto Sobre Serviços - ISS), tampouco impostos federais incidentes sobre ganho de capital em renda variável (Imposto de Renda retido na fonte de 1% para fins de dedução e o imposto de 20% a ser recolhido mensalmente via DARF pelo próprio investidor para operações de Day Trade).
        </div>
    `;
    
    // 6. Exportar usando html2pdf.js
    const filenameMonth = selectedMonth.replace('-', '_');
    const opt = {
        margin: [10, 10, 15, 10], // top, left, bottom, right
        filename: `JF_Relatorio_${filenameMonth}_${currentProfile}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2.5, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    
    await html2pdf().from(reportContainer).set(opt).save();
}

