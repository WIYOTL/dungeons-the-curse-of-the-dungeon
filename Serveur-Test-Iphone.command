#!/bin/bash
# Serveur de test local — Dungeons: The Curse of the Dungeon
# Double-cliquez sur ce fichier (ou "bash Serveur-Test-Iphone.command" dans Terminal).
# Laissez la fenêtre ouverte pendant le test. Pour arrêter : Ctrl+C dans cette fenêtre.

cd "$(dirname "$0")"

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo ""
echo "=============================================="
echo "  Serveur Dungeons : http://${IP:-?}:8000"
echo "  Mac local       : http://localhost:8000"
echo "=============================================="
echo ""
echo "Sur l'iPhone (meme Wi-Fi) : Safari -> http://${IP:-?}:8000"
echo "(si l'IP ci-dessus est vide ou change, relevez la nouvelle URL affichee ici)"
echo ""
echo "Cache desactive (Cache-Control: no-cache) : Safari recharge toujours la derniere version."
echo "Si une ancienne version persiste : fermer l'onglet Safari puis rouvrir l'URL."
echo ""
echo "Ne fermez pas cette fenetre pendant le test."
echo ""

python3 - <<'PYEOF'
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

ThreadingHTTPServer(('0.0.0.0', 8000), NoCacheHandler).serve_forever()
PYEOF
