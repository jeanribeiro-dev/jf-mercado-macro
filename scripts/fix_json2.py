import json

json_file = "trades_cleaned.json"

with open(json_file, 'r', encoding='utf-8') as f:
    trades = json.load(f)

for trade in trades:
    # Fix strategy
    if trade.get('strategy') and ('NDICE' in trade['strategy'] or '\ufffd' in trade['strategy']):
        trade['strategy'] = 'HEDGE \u00cdNDICE'
        
    # Fix NO
    for k, v in trade.items():
        if isinstance(v, str) and '\ufffd' in v:
            trade[k] = v.replace('\ufffd', '\u00c3')

with open(json_file, 'w', encoding='utf-8') as f:
    json.dump(trades, f, ensure_ascii=False, indent=2)

print("Fixed JSON.")
