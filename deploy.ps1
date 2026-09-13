# Contract Deployment Script for BSC Testnet (PowerShell)
# Make sure you have DEPLOYER_PRIVATE_KEY set in your environment
#
# Always chdir to repo root so ignition/modules/... resolves (works even if you launch this from backend/ or app/)

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

Write-Host "🚀 Deploying ModredIP contract to BSC Testnet (chain 97)..." -ForegroundColor Cyan
Write-Host "   (working directory: $RepoRoot)" -ForegroundColor DarkGray
Write-Host ""

# Check if DEPLOYER_PRIVATE_KEY is set
if (-not $env:DEPLOYER_PRIVATE_KEY) {
    Write-Host "❌ Error: DEPLOYER_PRIVATE_KEY not set" -ForegroundColor Red
    Write-Host "Please set it in your environment or .env file:"
    Write-Host "  `$env:DEPLOYER_PRIVATE_KEY = 'your_private_key_here'"
    exit 1
}

Write-Host "✅ Deployer private key found" -ForegroundColor Green
Write-Host ""

# Deploy the contract
Write-Host "📦 Deploying contract..." -ForegroundColor Yellow
npx hardhat ignition deploy ./ignition/modules/ModredIP.ts --network bscTestnet

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "1. Copy the deployed contract address from the output above"
Write-Host "2. Update app/src/deployed_addresses.json with the new address:"
Write-Host "   `"ModredIPModule#ModredIP`": `"NEW_ADDRESS_HERE`""
Write-Host "3. Restart your backend and frontend"
Write-Host ""
