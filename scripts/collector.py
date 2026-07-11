import asyncio
import websockets
import json
import pandas as pd
import os
import urllib.request
from datetime import datetime

# Configurações de Ativos
SYMBOLS = ["btcusdt", "ethusdt", "solusdt"]

# Montar URL de WebSockets de Trades combinados para os 3 ativos na Binance
streams_part = "/".join([f"{s}@aggTrade" for s in SYMBOLS])
WS_URL = f"wss://fstream.binance.com/market/stream?streams={streams_part}"

DATA_DIR = "orderflow_data"
BATCH_SIZE_TRADES = 500
BATCH_SIZE_OI = 50

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Inicializar buffers separados por ativo
trade_batches = {s: [] for s in SYMBOLS}
oi_batches = {s: [] for s in SYMBOLS}

def get_open_interest_sync(symbol):
    # Formatar o par para o padrão da BingX: BTC-USDT, ETH-USDT, SOL-USDT
    formatted_symbol = f"{symbol[:-4].upper()}-{symbol[-4:].upper()}"
    url = f"https://open-api.bingx.com/openApi/swap/v2/quote/openInterest?symbol={formatted_symbol}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=3) as response:
            res_data = json.loads(response.read().decode())
            if res_data.get('code') == 0:
                data = res_data['data']
                return {
                    "timestamp": int(data['time']),
                    "open_interest": float(data['openInterest'])
                }
            else:
                print(f"[!] Erro no retorno da BingX para {symbol.upper()}: {res_data.get('msg')}")
                return None
    except Exception as e:
        print(f"[!] Erro ao requisitar OI na BingX para {symbol.upper()}: {e}")
        return None

async def poll_open_interest(symbol):
    print(f"[*] Iniciando poller de Open Interest (BingX) para {symbol.upper()}...")
    while True:
        try:
            oi_data = await asyncio.to_thread(get_open_interest_sync, symbol)
            if oi_data:
                oi_batches[symbol].append(oi_data)
                
                if len(oi_batches[symbol]) >= BATCH_SIZE_OI:
                    save_oi(symbol, oi_batches[symbol])
                    oi_batches[symbol].clear()
            
            await asyncio.sleep(3)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[!] Erro no loop de OI de {symbol.upper()}: {e}")
            await asyncio.sleep(5)

async def collect_trades():
    while True:
        try:
            print(f"[*] Conectando ao WebSocket de Trades da Binance para {', '.join([s.upper() for s in SYMBOLS])}...")
            async with websockets.connect(WS_URL) as ws:
                print("[*] Conectado com sucesso. Coletando Trades...")
                while True:
                    message = await ws.recv()
                    payload = json.loads(message)
                    
                    stream = payload.get('stream', '')
                    data = payload.get('data', {})
                    
                    # Identificar qual ativo gerou o trade
                    for symbol in SYMBOLS:
                        if f"{symbol}@aggTrade" in stream:
                            trade = {
                                "timestamp": data['T'],
                                "price": float(data['p']),
                                "volume": float(data['q']),
                                "is_sell": data['m']
                            }
                            trade_batches[symbol].append(trade)
                            
                            if len(trade_batches[symbol]) >= BATCH_SIZE_TRADES:
                                save_trades(symbol, trade_batches[symbol])
                                trade_batches[symbol].clear()
                            break
        except Exception as e:
            print(f"[!] Desconexão detectada no WebSocket de Trades: {e}. Reconectando em 5 segundos...")
            await asyncio.sleep(5)

def save_trades(symbol, batch):
    df = pd.DataFrame(batch)
    df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
    
    current_time = datetime.now().strftime("%Y%m%d_%H")
    file_path = os.path.join(DATA_DIR, f"{symbol}_trades_{current_time}.parquet")
    
    if os.path.exists(file_path):
        existing_df = pd.read_parquet(file_path)
        combined_df = pd.concat([existing_df, df], ignore_index=True)
        combined_df.to_parquet(file_path, engine='pyarrow', compression='snappy')
    else:
        df.to_parquet(file_path, engine='pyarrow', compression='snappy')
        
    print(f"[*] [{symbol.upper()}] Salvo lote de {len(batch)} trades em {file_path}")

def save_oi(symbol, batch):
    df = pd.DataFrame(batch)
    df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
    
    current_time = datetime.now().strftime("%Y%m%d_%H")
    file_path = os.path.join(DATA_DIR, f"{symbol}_oi_{current_time}.parquet")
    
    if os.path.exists(file_path):
        existing_df = pd.read_parquet(file_path)
        combined_df = pd.concat([existing_df, df], ignore_index=True)
        combined_df.to_parquet(file_path, engine='pyarrow', compression='snappy')
    else:
        df.to_parquet(file_path, engine='pyarrow', compression='snappy')
        
    print(f"[*] [{symbol.upper()}] Salvo lote de {len(batch)} registros de Open Interest em {file_path}")

async def main():
    # Rodar o coletor de trades unificado e 3 pollers de OI separados
    tasks = [collect_trades()]
    for s in SYMBOLS:
        tasks.append(poll_open_interest(s))
        
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    while True:
        try:
            asyncio.run(main())
        except KeyboardInterrupt:
            print("\n[*] Coleta interrompida pelo usuário.")
            break
        except Exception as e:
            print(f"[!] Erro fatal no main loop, reiniciando em 5 segundos... {e}")
            import time
            time.sleep(5)
