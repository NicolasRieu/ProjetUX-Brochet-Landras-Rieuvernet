#!/usr/bin/env python3
"""
Serveur HTTP simple pour servir les fichiers du projet
Lance ce script et ouvre http://localhost:8000/front/bubble_chart/visuNico.html
"""

import http.server
import socketserver
import os

PORT = 8082

# Change to the directory containing this script
os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serveur demarree sur le port {PORT}")
    print(f"Ouvrez votre navigateur a l'adresse:")
    print(f"  http://localhost:{PORT}/front/bubble_chart/visuNico.html")
    print(f"\nAppuyez sur Ctrl+C pour arreter le serveur")
    httpd.serve_forever()
