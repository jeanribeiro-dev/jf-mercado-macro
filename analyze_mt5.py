import MetaTrader5 as mt5
import pandas as pd
from datetime import datetime

def init_mt5():
    path = r'C:\Program Files\MetaTrader 5a\terminal64.exe'
    if not mt5.initialize(path=path):
        print("initialize() failed, error code =", mt5.last_error())
        quit()

def get_data(symbol, start, end):
    rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_M1, start, end)
    if rates is None or len(rates) == 0:
        return None
    df = pd.DataFrame(rates)
    # Convert to UTC then to BRT so it matches the 09:00 naive times
    df['time'] = pd.to_datetime(df['time'], unit='s')
    df['time'] = df['time'].dt.tz_localize('UTC').dt.tz_convert('America/Sao_Paulo').dt.tz_localize(None)
    df.set_index('time', inplace=True)
    return df

def simulate_trade(df, entry_time, direction, stop_loss, take_profit, be_trigger=None, is_index=False):
    trade_df = df[df.index >= entry_time]
    if trade_df.empty: return "NO_DATA"
    
    entry_price = trade_df.iloc[0]['open']
    be_active = False
    
    for idx, row in trade_df.iterrows():
        high = row['high']
        low = row['low']
        
        if direction == 'COMPRA':
            if low <= entry_price - stop_loss:
                if be_active: return "ZERO_ZERO"
                return "STOP"
            if high >= entry_price + take_profit:
                return "TAKE"
            if be_trigger and high >= entry_price + be_trigger:
                be_active = True
                
        elif direction == 'VENDA':
            if high >= entry_price + stop_loss:
                if be_active: return "ZERO_ZERO"
                return "STOP"
            if low <= entry_price - take_profit:
                return "TAKE"
            if be_trigger and low <= entry_price - be_trigger:
                be_active = True
    
    return "TIME_OUT"

def main():
    init_mt5()
    
    days = [12, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26]
    results = []
    
    for d in days:
        start_time = datetime(2026, 6, d, 9, 0)
        end_time = datetime(2026, 6, d, 18, 0)
        
        df_wdo = get_data("WDO$", start_time, end_time)
        df_win = get_data("WIN$", start_time, end_time)
        
        if df_wdo is None or df_win is None:
            print(f"Skipping Day {d} - no data")
            continue
        
        abertura_wdo = df_wdo.iloc[0]['open']
        abertura_win = df_win.iloc[0]['open']
        
        ab_wdo_compra = simulate_trade(df_wdo, start_time, 'COMPRA', 10, 22, 10)
        ab_wdo_venda = simulate_trade(df_wdo, start_time, 'VENDA', 10, 22, 10)
        
        ab_win_compra = simulate_trade(df_win, start_time, 'COMPRA', 500, 2100, 300, True)
        ab_win_venda = simulate_trade(df_win, start_time, 'VENDA', 500, 2100, 300, True)
        
        hedge_wdo_time = datetime(2026, 6, d, 9, 15)
        if hedge_wdo_time in df_wdo.index:
            hedge_wdo_price = df_wdo.loc[hedge_wdo_time, 'open']
            hd_dir = 'VENDA' if hedge_wdo_price > abertura_wdo else 'COMPRA'
            hd_result = simulate_trade(df_wdo, hedge_wdo_time, hd_dir, 10, 10.5)
        else:
            hd_dir = 'N/A'
            hd_result = 'N/A'
            
        hedge_win_time = datetime(2026, 6, d, 9, 20)
        if hedge_win_time in df_win.index:
            hedge_win_price = df_win.loc[hedge_win_time, 'open']
            hi_dir = 'COMPRA' if hedge_win_price > abertura_win else 'VENDA'
            hi_result = simulate_trade(df_win, hedge_win_time, hi_dir, 500, 750, 490, True)
        else:
            hi_dir = 'N/A'
            hi_result = 'N/A'
            
        results.append({
            "Dia": d,
            "AbWdo_C": ab_wdo_compra,
            "AbWdo_V": ab_wdo_venda,
            "AbWin_C": ab_win_compra,
            "AbWin_V": ab_win_venda,
            "HD_Dir": hd_dir,
            "HD_Res": hd_result,
            "HI_Dir": hi_dir,
            "HI_Res": hi_result
        })
        
    df_res = pd.DataFrame(results)
    print(df_res.to_string())
    mt5.shutdown()

if __name__ == '__main__':
    main()
