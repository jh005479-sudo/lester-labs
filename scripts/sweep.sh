#!/usr/bin/env bash
#
# Lester Labs — Fee Sweeper
# Usage: bash scripts/sweep.sh [--dry-run]
# Cron: 0 10 * * *  cd ~/Projects/lester-labs && bash scripts/sweep.sh >> logs/sweep.log 2>&1

set -e

RPC="https://liteforge.rpc.caldera.xyz/http"
PRIVKEY="8bdaf07bdbd2157bf6c2054e54e78a4a6a0b9f6c70d6087e6952d7d6a5120f43"
TREASURY="0xDD221FBbCb0f6092AfE51183d964AA89A968eE13"
WZKLTC="0xd141A5DDE1a3A373B7e9bb603362A58793AB9D97"
GAS_LIMIT=100000
GAS_BUFFER=21000

DRY_RUN=false
[[ "$1" == "--dry-run" ]] && DRY_RUN=true

echo "=== Sweep $(date -u '+%Y-%m-%d %H:%M:%S UTC') ==="
echo "Treasury: $TREASURY"
[[ $DRY_RUN == true ]] && echo "Mode: DRY RUN" || echo "Mode: LIVE"
echo ""

sweep_native() {
  local from="$1"
  local name="$2"
  local bal=$(cast balance "$from" --rpc-url "$RPC" 2>/dev/null || echo "0")
  local bal_wei=$(printf "%.0f" "$bal" 2>/dev/null || echo "0")

  if (( bal_wei <= GAS_BUFFER )); then
    echo "  $name  0 zkLTC  (skip)"
    return
  fi

  local to_sweep=$((bal_wei - GAS_BUFFER))
  local fmtd=$(cast --to-dec "$to_sweep" 2>/dev/null || echo "$to_sweep")
  echo "  $name  $((bal_wei / 1000000000000000000)).$(printf "%06d" $((bal_wei % 1000000000000000000 / 1000000000000))) zkLTC  → treasury"

  if [[ $DRY_RUN == true ]]; then
    echo "    [DRY] would sweep $(echo "scale=6; $to_sweep/1e18" | bc) zkLTC"
  else
    local tx_hash=$(cast send "$from" --rpc-url "$RPC" --private-key "$PRIVKEY" --value "$to_sweep" --gas-limit "$GAS_LIMIT" 2>&1 | grep -o '0x[a-fA-F0-9]\{64\}' | head -1)
    echo "    Swept → ${tx_hash:0:18}... ✓"
  fi
}

unwrap_wzkltc() {
  local bal_hex=$(cast call "$WZKLTC" "balanceOf(address)(uint256)" "$TREASURY" --rpc-url "$RPC" 2>/dev/null || echo "0x0")
  local bal=$(echo "$bal_hex" | awk '{print $1}')
  [[ "$bal" == "0" || -z "$bal" ]] && echo "  No wzkLTC to unwrap." && return

  local bal_wei=$(printf "%.0f" "$(echo "$bal" | cut -d'x' -f2)" 2>/dev/null || echo "0")
  (( bal_wei <= 0 )) && echo "  No wzkLTC to unwrap." && return

  local fmtd=$(echo "scale=6; $bal_wei/1e18" | bc 2>/dev/null || echo "~$bal_wei wei")
  echo "  Treasury wzkLTC: $fmtd — unwrapping..."

  if [[ $DRY_RUN == true ]]; then
    echo "    [DRY] would call withdraw($bal)"
  else
    local tx_hash=$(cast send "$WZKLTC" "withdraw(uint256)" "$bal" --rpc-url "$RPC" --private-key "$PRIVKEY" --gas-limit "$GAS_LIMIT" 2>&1 | grep -o '0x[a-fA-F0-9]\{64\}' | head -1)
    echo "    Unwrapped → ${tx_hash:0:18}... ✓"
  fi
}

# Utility contracts to sweep (fee receivers)
echo "[1] Sweeping native zkLTC from utility contracts"
sweep_native "0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB" "ILOFactory"
sweep_native "0x93acc61fcdc2e3407A0c03450Adfd8aE78964948" "TokenFactory"
sweep_native "0x6EE07118D39e9330Ef0658FFA797EeDD2CB823Cf" "VestingFactory"
sweep_native "0x80d88C7F529D256e5e6A2CB0e0C30D82bC8827A9" "LiquidityLocker"
sweep_native "0x017A126A44Aaae9273F7963D4E295F0Ee2793AD8" "UniV2Factory"
sweep_native "0xD56a623890b083d876D47c3b1c5343b7f983FA62" "UniV2Router"

echo ""
echo "[2] Auto-unwrap treasury wzkLTC"
unwrap_wzkltc

echo ""
echo "[3] Final treasury balance"
final=$(cast balance "$TREASURY" --rpc-url "$RPC" 2>/dev/null || echo "0")
final_wei=$(printf "%.0f" "$final" 2>/dev/null || echo "0")
echo "  Native: $(echo "scale=6; $final_wei/1e18" | bc 2>/dev/null || echo "$final_wei wei") zkLTC"

echo ""
echo "✓ Sweep complete"