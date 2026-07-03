import pandas as pd
import numpy as np
import os

DATA_DIR = "orderflow_data"
FEES_RATE = 0.0004  # 0.04% por execução
INITIAL_CAPITAL = 10000.0  # Capital inicial em USD
RISK_PCT = 0.01  # Risco fixo de 1% por operação

def load_data(symbol):
    ohlc_file = os.path.join(DATA_DIR, f"{symbol}_processed_ohlc.parquet")
    fp_file = os.path.join(DATA_DIR, f"{symbol}_processed_footprint.parquet")
    
    if not os.path.exists(ohlc_file) or not os.path.exists(fp_file):
        print(f"[!] Arquivos processados não encontrados para {symbol.upper()}. Rode o processor.py primeiro.")
        return None, None
        
    df_ohlc = pd.read_parquet(ohlc_file)
    df_fp = pd.read_parquet(fp_file)
    return df_ohlc, df_fp
def calculate_adx(df, period=14):
    df_temp = df.copy()
    df_temp['prev_high'] = df_temp['high'].shift(1)
    df_temp['prev_low'] = df_temp['low'].shift(1)
    df_temp['prev_close'] = df_temp['close'].shift(1)
    
    # TR
    df_temp['tr1'] = df_temp['high'] - df_temp['low']
    df_temp['tr2'] = (df_temp['high'] - df_temp['prev_close']).abs()
    df_temp['tr3'] = (df_temp['low'] - df_temp['prev_close']).abs()
    df_temp['tr'] = df_temp[['tr1', 'tr2', 'tr3']].max(axis=1)
    
    # DM
    df_temp['plus_dm'] = np.where((df_temp['high'] - df_temp['prev_high'] > df_temp['prev_low'] - df_temp['low']) & (df_temp['high'] - df_temp['prev_high'] > 0), df_temp['high'] - df_temp['prev_high'], 0.0)
    df_temp['minus_dm'] = np.where((df_temp['prev_low'] - df_temp['low'] > df_temp['high'] - df_temp['prev_high']) & (df_temp['prev_low'] - df_temp['low'] > 0), df_temp['prev_low'] - df_temp['low'], 0.0)
    
    # Wilder's Smoothing
    alpha = 1 / period
    df_temp['str'] = df_temp['tr'].ewm(alpha=alpha, adjust=False).mean()
    df_temp['splus'] = df_temp['plus_dm'].ewm(alpha=alpha, adjust=False).mean()
    df_temp['sminus'] = df_temp['minus_dm'].ewm(alpha=alpha, adjust=False).mean()
    
    # DI
    df_temp['plus_di'] = 100 * (df_temp['splus'] / df_temp['str'])
    df_temp['minus_di'] = 100 * (df_temp['sminus'] / df_temp['str'])
    
    # DX & ADX
    df_temp['dx'] = 100 * (df_temp['plus_di'] - df_temp['minus_di']).abs() / (df_temp['plus_di'] + df_temp['minus_di'])
    df_temp['adx'] = df_temp['dx'].ewm(alpha=alpha, adjust=False).mean()
    
    return df_temp['adx']

def check_footprint_imbalance(timestamp, direction, df_fp, ohlc_row, ratio=1.5):
    try:
        fp_slice = df_fp.loc[timestamp]
    except KeyError:
        return False
        
    high = ohlc_row['high']
    low = ohlc_row['low']
    rng = high - low
    if rng == 0: return False
    
    if direction == 'LONG':
        lower_bound = low + (rng * 0.4)
        fp_zone = fp_slice[fp_slice.index <= lower_bound]
        if fp_zone.empty: return False
        sum_buy = fp_zone['buy_vol'].sum()
        sum_sell = fp_zone['sell_vol'].sum()
        return sum_buy >= (sum_sell * ratio) and sum_buy > 0
        
    elif direction == 'SHORT':
        upper_bound = high - (rng * 0.4)
        fp_zone = fp_slice[fp_slice.index >= upper_bound]
        if fp_zone.empty: return False
        sum_buy = fp_zone['buy_vol'].sum()
        sum_sell = fp_zone['sell_vol'].sum()
        return sum_sell >= (sum_buy * ratio) and sum_sell > 0
        
    return False

def simulate_trades(df, df_fp, payoff=1.5, enable_be=True, use_fp_filter=True, fp_ratio=2.0, use_oi_filter=True, use_trend_filter=True):
    trades = []
    
    # Mapear indicadores M5
    df['price_change'] = df['close'].pct_change()
    df['cvd_change'] = df['cvd'].diff()
    
    # Calcular EMA 50 e ADX 14 no M15 e mapear de volta para M5
    import numpy as np
    df_m15_ohlc = df[['open', 'high', 'low', 'close']].resample('15min').agg({
        'open': 'first',
        'high': 'max',
        'low': 'min',
        'close': 'last'
    }).ffill()
    
    ema_m15 = df_m15_ohlc['close'].ewm(span=50, adjust=False).mean()
    adx_m15 = calculate_adx(df_m15_ohlc, period=14)
    
    df['ema_m15'] = ema_m15.reindex(df.index, method='ffill')
    df['adx_m15'] = adx_m15.reindex(df.index, method='ffill')
    
    df['buy_signal'] = (df['price_change'] < 0) & (df['cvd_change'] > 0)
    df['sell_signal'] = (df['price_change'] > 0) & (df['cvd_change'] < 0)
    
    df_reset = df.reset_index()
    n = len(df_reset)
    
    capital = INITIAL_CAPITAL
    
    i = 1
    while i < n - 1:
        row = df_reset.iloc[i]
        prev_row = df_reset.iloc[i-1]
        
        is_long = row['buy_signal']
        is_short = row['sell_signal']
        
        if not (is_long or is_short):
            i += 1
            continue
            
        direction = 'LONG' if is_long else 'SHORT'
        entry_time = row['datetime']
        entry_price = row['close']
        
        # 1. FILTRO DE REGIME DE TENDÊNCIA (ADX + EMA M15)
        if use_trend_filter:
            adx_val = row['adx_m15']
            ema_val = row['ema_m15']
            if pd.notna(adx_val) and pd.notna(ema_val):
                # Se o ADX indica tendência forte (>= 25), filtramos contra-tendência
                if adx_val >= 25:
                    if direction == 'LONG' and entry_price < ema_val:
                        i += 1
                        continue
                    if direction == 'SHORT' and entry_price > ema_val:
                        i += 1
                        continue
                
        # 2. FILTRO DE FOOTPRINT
        if use_fp_filter:
            has_imbalance = check_footprint_imbalance(entry_time, direction, df_fp, row, ratio=fp_ratio)
            if not has_imbalance:
                i += 1
                continue
                
        # 3. FILTRO DE OPEN INTEREST (OI crescendo durante a divergência)
        if use_oi_filter:
            # Checar se o OI da vela atual é maior que a do minuto anterior (indica novos contratos)
            oi_growing = row['open_interest'] > prev_row['open_interest']
            # Evitar travar se vier nulo/vazio
            if pd.notna(row['open_interest']) and pd.notna(prev_row['open_interest']) and not oi_growing:
                i += 1
                continue
                
        # --- EXECUÇÃO COM GESTÃO DE RISCO (POSITION SIZING) ---
        # Definir distância do stop dinâmico proporcional ao preço (mínimo de 0.80% do preço do ativo)
        min_stop_distance = entry_price * 0.008
        
        if direction == 'LONG':
            stop_distance = entry_price - row['low']
            stop_distance = max(stop_distance, min_stop_distance)
            stop_loss = entry_price - stop_distance
            take_profit = entry_price + (stop_distance * payoff)
        else:
            stop_distance = row['high'] - entry_price
            stop_distance = max(stop_distance, min_stop_distance)
            stop_loss = entry_price + stop_distance
            take_profit = entry_price - (stop_distance * payoff)
            
        # Calcular tamanho do lote para arriscar exatamente 1% do Capital
        risk_amount = capital * RISK_PCT
        contracts = risk_amount / stop_distance
        
        be_active = False
        trade_result = None
        exit_price = None
        exit_time = None
        
        j = i + 1
        while j < n:
            future_row = df_reset.iloc[j]
            f_high = future_row['high']
            f_low = future_row['low']
            
            if direction == 'LONG':
                if f_low <= stop_loss:
                    exit_price = stop_loss
                    trade_result = 'STOP'
                    exit_time = future_row['datetime']
                    break
                if f_high >= take_profit:
                    exit_price = take_profit
                    trade_result = 'TAKE'
                    exit_time = future_row['datetime']
                    break
                if be_active and f_low <= entry_price:
                    exit_price = entry_price
                    trade_result = 'BE'
                    exit_time = future_row['datetime']
                    break
                if enable_be and not be_active and f_high >= (entry_price + stop_distance):
                    be_active = True
                    
            elif direction == 'SHORT':
                if f_high >= stop_loss:
                    exit_price = stop_loss
                    trade_result = 'STOP'
                    exit_time = future_row['datetime']
                    break
                if f_low <= take_profit:
                    exit_price = take_profit
                    trade_result = 'TAKE'
                    exit_time = future_row['datetime']
                    break
                if be_active and f_high >= entry_price:
                    exit_price = entry_price
                    trade_result = 'BE'
                    exit_time = future_row['datetime']
                    break
                if enable_be and not be_active and f_low <= (entry_price - stop_distance):
                    be_active = True
            
            j += 1
            
        if trade_result is None:
            exit_price = df_reset.iloc[-1]['close']
            exit_time = df_reset.iloc[-1]['datetime']
            trade_result = 'FORCE_CLOSE'
            
        # Calcular PnL Financeiro ($) e Taxas Reais
        # Lucro/Prejuízo bruto em USD
        if direction == 'LONG':
            gross_pnl_usd = (exit_price - entry_price) * contracts
        else:
            gross_pnl_usd = (entry_price - exit_price) * contracts
            
        # Taxas reais da BingX baseadas nos valores nominais de entrada e saída
        entry_value = entry_price * contracts
        exit_value = exit_price * contracts
        fees_usd = (entry_value + exit_value) * FEES_RATE
        
        # PnL líquido em USD
        net_pnl_usd = gross_pnl_usd - fees_usd
        
        # Atualizar capital
        capital += net_pnl_usd
        
        trades.append({
            "entry_time": entry_time,
            "exit_time": exit_time,
            "direction": direction,
            "entry_price": entry_price,
            "exit_price": exit_price,
            "result": trade_result,
            "pnl_usd": net_pnl_usd,
            "capital": capital,
            "pnl_pct": (net_pnl_usd / (capital - net_pnl_usd)) * 100
        })
        
        i = j
        
    return pd.DataFrame(trades)

def report_metrics(df_trades, payoff_name):
    if df_trades.empty:
        print(f"\nNenhum trade realizado no cenário {payoff_name}")
        return
        
    total_trades = len(df_trades)
    wins = len(df_trades[df_trades['result'] == 'TAKE'])
    losses = len(df_trades[df_trades['result'] == 'STOP'])
    bes = len(df_trades[df_trades['result'] == 'BE'])
    
    win_rate = (wins / total_trades) * 100
    
    # Payoff financeiro real (Lucro médio / Prejuízo médio em USD)
    avg_gain = df_trades[df_trades['pnl_usd'] > 0]['pnl_usd'].mean()
    avg_loss = abs(df_trades[df_trades['pnl_usd'] < 0]['pnl_usd'].mean())
    real_payoff = avg_gain / avg_loss if avg_loss > 0 else 0
    
    # Drawdown Máximo Financeiro (%)
    cum_equity = df_trades['capital']
    peak = cum_equity.cummax()
    drawdown = (cum_equity - peak) / peak * 100
    max_dd = drawdown.min()
    
    net_return_usd = df_trades['pnl_usd'].sum()
    net_return_pct = (net_return_usd / INITIAL_CAPITAL) * 100
    
    print(f"\n================ SCENARIO {payoff_name} ================")
    print(f"Total de Trades: {total_trades}")
    print(f"Resultados: {wins} Gain | {losses} Loss | {bes} Zero-Zero (BE)")
    print(f"TRINDADE OBRIGATÓRIA:")
    print(f"-> Win Rate: {win_rate:.2f}% | Payoff Médio: {real_payoff:.2f} | Max Drawdown: {max_dd:.2f}%")
    print(f"Capital Final: ${df_trades.iloc[-1]['capital']:.2f} (Retorno Líquido: {net_return_pct:.2f}%)")

def main():
    symbols = ["btcusdt", "ethusdt", "solusdt"]
    
    for symbol in symbols:
        print(f"\n================ BACKTEST FINANCEIRO {symbol.upper()} ================")
        df_ohlc, df_fp = load_data(symbol)
        if df_ohlc is None or df_fp is None:
            continue
            
        print(f"--- TESTE 1: PAYOFF 1.5:1 + FILTRO FOOTPRINT (2.0x) + FILTRO TENDÊNCIA REGIME + POSITION SIZING 1% ---")
        df_trades_15 = simulate_trades(df_ohlc, df_fp, payoff=1.5, enable_be=True, 
                                       use_fp_filter=True, fp_ratio=2.0, 
                                       use_oi_filter=False, use_trend_filter=True)
        report_metrics(df_trades_15, f"{symbol.upper()} - Payoff 1.5:1 + Sizing 1%")
        
        print(f"\n--- TESTE 2: PAYOFF 2.0:1 + FILTRO FOOTPRINT (2.0x) + FILTRO TENDÊNCIA REGIME + POSITION SIZING 1% ---")
        df_trades_20 = simulate_trades(df_ohlc, df_fp, payoff=2.0, enable_be=True, 
                                       use_fp_filter=True, fp_ratio=2.0, 
                                       use_oi_filter=False, use_trend_filter=True)
        report_metrics(df_trades_20, f"{symbol.upper()} - Payoff 2.0:1 + Sizing 1%")

if __name__ == "__main__":
    main()
