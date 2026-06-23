import json

with open('trades_cleaned.json', 'r', encoding='utf-8') as f:
    trades = json.load(f)

for t in trades:
    if t.get('pnl') is None:
        t['pnl'] = 0.0

with open('trades_cleaned.json', 'w', encoding='utf-8') as f:
    json.dump(trades, f, ensure_ascii=False, indent=2)

print("Fixed null PnLs!")
