import pandas as pd
import json
import datetime
import math

excel_file = "RELATORIO Hedge Indice.xlsx"
json_file = "trades_cleaned.json"

with open(json_file, 'r', encoding='utf-8') as f:
    trades = json.load(f)

# Remove any existing HEDGE INDICE trades just to be totally safe
trades = [t for t in trades if t.get('strategy') != 'HEDGE ÍNDICE']

xl = pd.ExcelFile(excel_file)
if 'Hedge Indice' in xl.sheet_names:
    df = xl.parse('Hedge Indice')
    data = df.iloc[9:].copy()
    
    new_trades = []
    for _, row in data.iterrows():
        date_val = row[df.columns[1]]
        if pd.isna(date_val) or str(date_val).strip() == '':
            continue
            
        try:
            trade = {'strategy': 'HEDGE ÍNDICE'}
            mapping = {1: 'date', 2: 'direction', 3: 'stop', 4: 'p1', 5: 'alvo', 6: 'pnl'}
            
            for col_idx, json_key in mapping.items():
                val = row[df.columns[col_idx]]
                if pd.isna(val):
                    trade[json_key] = None
                else:
                    if json_key == 'date':
                        if isinstance(val, datetime.datetime):
                            trade[json_key] = val.strftime('%Y-%m-%d')
                        elif isinstance(val, str):
                            clean_str = val.replace('//', '/')
                            try:
                                parsed = datetime.datetime.strptime(clean_str, '%d/%m/%Y')
                                trade[json_key] = parsed.strftime('%Y-%m-%d')
                            except:
                                continue
                        else:
                            continue
                    else:
                        trade[json_key] = val
            
            # String cleaning to avoid encoding issues
            for k, v in trade.items():
                if isinstance(v, str) and k != 'strategy':
                    trade[k] = v.replace('NO', 'NÃO').replace('N\ufffdO', 'NÃO').strip()
            
            # PnL parsing
            if trade.get('pnl') is not None:
                try:
                    trade['pnl'] = float(trade['pnl'])
                    if math.isnan(trade['pnl']):
                        trade['pnl'] = 0.0
                except:
                    trade['pnl'] = 0.0
            else:
                trade['pnl'] = 0.0
            
            if trade.get('date') and len(trade['date']) == 10:
                new_trades.append(trade)
        except Exception as e:
            pass

    trades.extend(new_trades)
    print(f"Extracted {len(new_trades)} Hedge Indice trades.")

trades = sorted(trades, key=lambda x: x['date'])

with open(json_file, 'w', encoding='utf-8') as f:
    json.dump(trades, f, ensure_ascii=False, indent=2)

print(f"Success! Total trades: {len(trades)}")
