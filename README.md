# Portfólio: Dashboard Analítico - JF Mercado Macro

Dashboard analítico interativo para acompanhamento de métricas, drawdown e curvas de capital (Equity Curve) de estratégias quantitativas e discricionárias aplicadas ao mercado financeiro (B3 e Forex).

🔗 **[Acesse o Dashboard Online](https://jeanribeiro-dev.github.io/jf-mercado-macro/dashboard/)**

👉 [Clique aqui para acessar o painel interativo](https://jeanribeiro-dev.github.io/jf-mercado-macro/dashboard/)

👉 [Clique aqui para ver a Apresentação Executiva](https://jeanribeiro-dev.github.io/jf-mercado-macro/apresentacao/)

## 🧠 Visão Geral do Projeto

Este projeto é uma ferramenta completa de análise de dados (End-to-End) que cobre todo o pipeline de gerenciamento de risco e performance:

1. **ETL (Extract, Transform, Load):** Processamento de logs de operações (trades) advindos da plataforma de negociação (ex: MetaTrader 5 / Relatórios de Corretora) e transformação em base de dados estruturada JSON.
2. **Análise de Performance:** Cálculo minucioso de métricas-chave como Win Rate, Payoff, Maximum Drawdown (Rebaixamento) e Streaks.
3. **Dashboard Interativo:** Painel web dinâmico com gráficos atualizados em tempo real, perfis de risco simulados e relatórios exportáveis.

## 📈 Estratégias Analisadas

| Estratégia | Insight Principal / Objetivo |
| :--- | :--- |
| **Abertura Índice** | Captura de distorções de volatilidade na abertura do mercado futuro de Índice (WIN). |
| **Abertura Dólar** | Aproveitamento de gaps e fluxo institucional nos primeiros minutos do Dólar (WDO). |
| **Hedge Dólar / Índice** | Proteção de carteira através de correlações inversas entre ativos de risco e moedas fortes. |
| **DI Abertura** | Operações na curva de juros futuros buscando distorções na precificação da taxa Selic. |
| **Consolidado** | Visão macro de todo o portfólio, avaliando a correlação e o risco sistêmico conjunto. |

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
| :--- | :--- |
| **Back-end & ETL** | Python, Pandas, Jupyter Notebook |
| **Visualização (Front)** | ApexCharts (Gráficos), HTML5, CSS3, Vanilla JavaScript |
| **Design** | Layout Responsivo Profissional (Dark Mode, UI Moderna) |
| **Deploy & Hospedagem** | GitHub Pages |

## 📁 Estrutura do Projeto

```text
jf-mercado-macro/
├── data/
│   ├── trades_cleaned.json    # Base de dados limpa e processada (saída do ETL)
│   └── temp_trades.json       # Base temporária de operações
├── notebooks/
│   └── analise_dados.ipynb    # Jupyter Notebook com análises exploratórias
├── dashboard/
│   ├── index.html             # Página principal do painel interativo
│   ├── style.css              # Estilização CSS e variáveis visuais
│   └── app.js                 # Lógica dos gráficos (ApexCharts) e filtros
├── scripts/
│   ├── server.py              # Servidor local Python para teste e sincronização
│   └── backtester.py          # Script de validação de métricas de backtest
├── README.md                  # Documentação do projeto
└── LICENSE                    # Licença MIT
```
*(Nota: A estrutura de pastas acima será implementada progressivamente nos próximos commits).*

## ✨ Funcionalidades do Dashboard

* **Gráficos Dinâmicos e Interativos:** Curva de Capital (Equity) e Drawdown renderizados em alta performance.
* **Filtros Temporais Customizados:** Visualização segmentada por últimos 7 dias, 30 dias ou período personalizado.
* **Perfis de Risco (Simulação):** Escalonamento automático de alocação (Conservador, Moderado, Arrojado) recalculando o Risco/Retorno e a curva do portfólio na hora.
* **Relatório PDF Profissional:** Geração e exportação local do consolidado mensal para análise ou apresentação a investidores (Client-Side HTML2PDF).
* **Métricas Institucionais:** Cálculo de Win Rate, Payoff, Risco de Ruína e Max Drawdown baseados na trindade rigorosa de backtest.

## 📄 Fonte dos Dados

* **Dados Operacionais:** Exportação nativa de relatórios B3 / MetaTrader / Plataformas Profissionais.
* **Tratamento:** Algoritmos rigorosos sem *curve-fitting*, focados 100% em dados Out-of-Sample (OOS).

---

## 👤 Autor

**Jean Ribeiro — Analista de Dados / Trader**

*Projeto desenvolvido como portfólio avançado de Análise de Dados e Desenvolvimento Web aplicado ao Mercado Financeiro.*
