#!/bin/bash
set -e

echo "=== Running Foundry Tests ==="
forge test -vv

echo "=== Running Slither Analysis ==="
slither . --exclude-dependencies --detect reentrancy-eth,reentrancy-no-eth,unused-return,locked-ether

echo "=== Security Check Passed ==="
