import http.server
import socketserver
import json
import os
import subprocess

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Serve from current directory
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        # Set CORS headers
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-type', 'application/json')
        self.end_headers()

        if self.path == '/api/add-trade':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                new_trade = json.loads(post_data.decode('utf-8'))
                
                # Check target file path
                json_path = os.path.join(DIRECTORY, 'trades_cleaned.json')
                
                trades = []
                if os.path.exists(json_path):
                    with open(json_path, 'r', encoding='utf-8') as f:
                        trades = json.load(f)
                
                trades.append(new_trade)
                
                # Sort trades by date
                trades = sorted(trades, key=lambda x: (x["date"], x["strategy"]))
                
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(trades, f, ensure_ascii=False, indent=2)
                
                response_data = {"status": "success", "message": "Operação registrada com sucesso!"}
            except Exception as e:
                response_data = {"status": "error", "message": str(e)}
                
            self.wfile.write(json.dumps(response_data).encode('utf-8'))

        elif self.path == '/api/delete-trade':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                index_to_delete = req_data.get('index')
                
                json_path = os.path.join(DIRECTORY, 'trades_cleaned.json')
                
                if index_to_delete is not None and os.path.exists(json_path):
                    with open(json_path, 'r', encoding='utf-8') as f:
                        trades = json.load(f)
                    
                    if 0 <= index_to_delete < len(trades):
                        del trades[index_to_delete]
                        
                        with open(json_path, 'w', encoding='utf-8') as f:
                            json.dump(trades, f, ensure_ascii=False, indent=2)
                        
                        response_data = {"status": "success", "message": "Operação excluída com sucesso!"}
                    else:
                        response_data = {"status": "error", "message": "Índice de operação inválido."}
                else:
                    response_data = {"status": "error", "message": "Dados inválidos ou arquivo não encontrado."}
            except Exception as e:
                response_data = {"status": "error", "message": str(e)}
                
            self.wfile.write(json.dumps(response_data).encode('utf-8'))

        elif self.path == '/api/sync':
            try:
                env = os.environ.copy()
                env["GIT_TERMINAL_PROMPT"] = "0"
                env["GCM_INTERACTIVE"] = "never"
                
                # Check if there are changes to commit
                status_res = subprocess.run(["git", "status", "--porcelain"], cwd=DIRECTORY, capture_output=True, text=True, shell=True, env=env)
                if status_res.stdout.strip():
                    # Execute Git commit only if changes exist
                    subprocess.run(["git", "add", "."], cwd=DIRECTORY, check=True, shell=True, env=env)
                    subprocess.run(["git", "commit", "-m", "Update trades via local dashboard"], cwd=DIRECTORY, check=True, shell=True, env=env)
                
                # Push always to ensure remote is up to date
                subprocess.run(["git", "push"], cwd=DIRECTORY, check=True, shell=True, env=env)
                
                response_data = {"status": "success", "message": "Dashboard sincronizado com o Netlify com sucesso!"}
            except Exception as e:
                print(f"Erro na sincronização: {str(e)}")
                response_data = {"status": "error", "message": f"Erro na sincronização: {str(e)}"}
                
            self.wfile.write(json.dumps(response_data).encode('utf-8'))

    def do_OPTIONS(self):
        # Handle preflight CORS request
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    print(f"Servidor JF Mercado Macro rodando localmente em http://localhost:{PORT}")
    print("Para encerrar o servidor, feche esta janela.")
    
    # Allow address reuse and use multithreaded server to prevent hanging
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), CustomHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor encerrado.")
