#!/bin/bash
# Sweep all Lester Labs protocol fees to treasury
# Runs at 10:00 UTC daily via cron
cd /Users/jack/Projects/lester-labs/contracts
npx hardhat run scripts/sweepFees.ts --network litvm 2>&1
