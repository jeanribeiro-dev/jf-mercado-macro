import pandas as pd
import glob
import os

DATA_DIR = "orderflow_data"

def load_data(symbol):
    files = glob.glob(os.path.join(DATA_DIR, f"{symbol}_trades_*.parquet"))
    if not files:
        print(f"Nenhum arquivo de trades encontrado para {symbol.upper()}.")
        return None
    
    dfs = [pd.read_parquet(f) for f in files]
    df = pd.concat(dfs, ignore_index=True)
    df.sort_values('datetime', inplace=True)
    df.set_index('datetime', inplace=True)
    return df

def load_oi_data(symbol):
    files = glob.glob(os.path.join(DATA_DIR, f"{symbol}_oi_*.parquet"))
    if not files:
        print(f"Nenhum arquivo de Open Interest encontrado para {symbol.upper()}.")
        return None
    
    dfs = [pd.read_parquet(f) for f in files]
    df = pd.concat(dfs, ignore_index=True)
    df.sort_values('datetime', inplace=True)
    df.set_index('datetime', inplace=True)
    return df

def aggregate_footprint(df, timeframe='1min', tick_size=10.0):
    print(f"Agregando dados em {timeframe} com tick size {tick_size}...")
    
    ohlc = df['price'].resample(timeframe).ohlc()
    df['price_level'] = (df['price'] // tick_size) * tick_size
    
    import numpy as np
    df['buy_vol'] = np.where(~df['is_sell'], df['volume'], 0.0)
    df['sell_vol'] = np.where(df['is_sell'], df['volume'], 0.0)
    df['delta'] = df['buy_vol'] - df['sell_vol']
    
    vol_agg = df.resample(timeframe).agg({
        'volume': 'sum',
        'buy_vol': 'sum',
        'sell_vol': 'sum',
        'delta': 'sum'
    })
    
    vol_agg['cvd'] = vol_agg['delta'].cumsum()
    
    footprint = df.groupby([pd.Grouper(freq=timeframe), 'price_level']).agg({
        'buy_vol': 'sum',
        'sell_vol': 'sum'
    })
    
    final_df = ohlc.join(vol_agg)
    return final_df, footprint

if __name__ == "__main__":
    symbols = ["btcusdt", "ethusdt", "solusdt"]
    
    for symbol in symbols:
        print(f"\n================ PROCESSANDO {symbol.upper()} ================")
        df = load_data(symbol)
        df_oi = load_oi_data(symbol)
        
        if df is not None and not df.empty:
            print(f"Total de trades crus lidos: {len(df)}")
            final_ohlc, footprint_clusters = aggregate_footprint(df, timeframe='5min')
            
            if df_oi is not None and not df_oi.empty:
                print(f"Total de registros de Open Interest lidos: {len(df_oi)}")
                oi_resampled = df_oi['open_interest'].resample('5min').last().ffill()
                final_ohlc = final_ohlc.join(oi_resampled, how='left')
                
            print(f"\n=== Exemplo de OHLC + Deltas + OI ({symbol.upper()}) ===")
            print(final_ohlc.tail(3))
            
            ohlc_out = os.path.join(DATA_DIR, f"{symbol}_processed_ohlc.parquet")
            fp_out = os.path.join(DATA_DIR, f"{symbol}_processed_footprint.parquet")
            
            final_ohlc.to_parquet(ohlc_out)
            footprint_clusters.to_parquet(fp_out)
            print(f"[OK] Dados de {symbol.upper()} processados e salvos!")
        else:
            print(f"Sem dados suficientes para processar {symbol.upper()}.")
