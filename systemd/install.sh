#!/usr/bin/env bash
# Installe les unités systemd user de consolidation Claude Arcade.
# N'ACTIVE RIEN : la consolidation dépense des tokens sur l'abonnement Claude.
# L'activation est une décision explicite (voir instructions en fin de script).
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

mkdir -p "$DEST"
cp "$SRC/claude-arcade-consolidate.service" "$DEST/"
cp "$SRC/claude-arcade-consolidate.timer" "$DEST/"
systemctl --user daemon-reload

echo "✓ Unités copiées dans $DEST et rechargées."
echo
echo "Pour tester UN run maintenant (un lot = quota sessions) :"
echo "    systemctl --user start claude-arcade-consolidate.service"
echo "    journalctl --user -u claude-arcade-consolidate -f"
echo
echo "Pour activer le quotidien zéro-perte (rattrapage au réveil) :"
echo "    systemctl --user enable --now claude-arcade-consolidate.timer"
echo
echo "Pour que les timers tournent PC fermé session close (persistance user) :"
echo "    sudo loginctl enable-linger $USER"
echo
echo "État / prochains déclenchements :"
echo "    systemctl --user list-timers claude-arcade-consolidate.timer"
