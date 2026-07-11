import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Clean duplicate button
dup_btn = """                <button class="nav-btn active strat-btn" data-strategy="HEDGE ÍNDICE">
                    <i data-lucide="bar-chart-2"></i>
                    <span>Hedge Índice</span>
                </button>
                <button class="nav-btn active strat-btn" data-strategy="HEDGE ÍNDICE">
                    <i data-lucide="bar-chart-2"></i>
                    <span>Hedge Índice</span>
                </button>"""

single_btn = """                <button class="nav-btn active strat-btn" data-strategy="HEDGE ÍNDICE">
                    <i data-lucide="bar-chart-2"></i>
                    <span>Hedge Índice</span>
                </button>"""

content = content.replace(dup_btn, single_btn)

# Clean duplicate option
dup_opt = """                            <option value="HEDGE ÍNDICE">Hedge Índice</option>
                            <option value="HEDGE ÍNDICE">Hedge Índice</option>"""

single_opt = """                            <option value="HEDGE ÍNDICE">Hedge Índice</option>"""

content = content.replace(dup_opt, single_opt)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
