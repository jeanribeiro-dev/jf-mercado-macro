import json

with open('trades_cleaned.json', 'r', encoding='utf-8') as f:
    trades = json.load(f)

for t in trades:
    if t.get('strategy') == 'DOLAR RED':
        t['strategy'] = 'HEDGE DÓLAR'

with open('trades_cleaned.json', 'w', encoding='utf-8') as f:
    json.dump(trades, f, ensure_ascii=False, indent=2)

print("Renamed strategy in JSON.")
