import pandas as pd
import json
import datetime
import math

excel_file = "RELATORIO DE PERFORMACE.xlsx"
json_file = "trades_cleaned.json"

sheets_to_extract = {
    'ABERTURA INDICE': {
        'strategy_name': 'ABERTURA INDICE',
        'start_row': 3,
        'cols': {1: 'date', 2: 'direction', 3: 'stop', 4: 'p1', 5: 'p2', 6: 'alvo', 7: 'pnl'}
    },
    'DOLAR ABERTURA': {
        'strategy_name': 'ABERTURA DOLAR',
        'start_row': 3,
        'cols': {1: 'date', 2: 'direction', 3: 'stop', 4: 'zero_zero', 5: 'alvo', 6: 'pnl'}
    },
    'DOLAR RED': {
        'strategy_name': 'DOLAR RED',
        'start_row': 1,
        'cols': {1: 'date', 2: 'direction', 3: 'stop', 4: 'alvo', 5: 'pnl'}
    },
    'DI ABERTURA': {
        'strategy_name': 'DI ABERTURA',
        'start_row': 3, # Fixed from 1
        'cols': {1: 'date', 2: 'direction', 3: 'stop', 5: 'alvo', 6: 'pnl'} # Fixed cols
    },
    'RED INDICE': {
        'strategy_name': 'HEDGE ÍNDICE',
        'start_row': 9,
        'cols': {1: 'date', 2: 'direction', 3: 'stop', 4: 'p1', 5: 'alvo', 6: 'pnl'}
    }
}

all_trades = []
xl = pd.ExcelFile(excel_file)

for sheet, config in sheets_to_extract.items():
    if sheet not in xl.sheet_names:
        continue
    
    df = xl.parse(sheet)
    data = df.iloc[config['start_row']:].copy()
    
    for _, row in data.iterrows():
        date_val = row[df.columns[1]]
        if pd.isna(date_val) or str(date_val).strip() == '':
            continue
            
        try:
            trade = {'strategy': config['strategy_name']}
            
            for col_idx, json_key in config['cols'].items():
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
            
            # Only add if date is exactly 10 chars (YYYY-MM-DD)
            if trade.get('date') and len(trade['date']) == 10:
                all_trades.append(trade)
        except Exception as e:
            pass

# Output to JSON
all_trades = sorted(all_trades, key=lambda x: x['date'])

with open(json_file, 'w', encoding='utf-8') as f:
    json.dump(all_trades, f, ensure_ascii=False, indent=2)

print(f"Extraction complete! Total trades: {len(all_trades)}")
