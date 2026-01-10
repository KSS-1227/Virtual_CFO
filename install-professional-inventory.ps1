# Professional Inventory Management System Installation Script (Windows)
Write-Host "🚀 Installing Professional Inventory Management System..." -ForegroundColor Green

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install compression lodash

# Run database migration
Write-Host "📊 Running database migration..." -ForegroundColor Yellow
supabase db push

# Add environment variables
if (!(Select-String -Path ".env" -Pattern "PROFESSIONAL_INVENTORY_ENABLED" -Quiet)) {
    Add-Content -Path ".env" -Value ""
    Add-Content -Path ".env" -Value "# Professional Inventory Configuration"
    Add-Content -Path ".env" -Value "PROFESSIONAL_INVENTORY_ENABLED=true"
    Add-Content -Path ".env" -Value "AI_LEARNING_ENABLED=true"
    Add-Content -Path ".env" -Value "MULTIMODAL_PROCESSING_ENABLED=true"
}

# Add npm scripts
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!pkg.scripts) pkg.scripts = {};
pkg.scripts['dev:professional'] = 'set PROFESSIONAL_INVENTORY_ENABLED=true && npm run dev';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

Write-Host "✅ Professional Inventory Management installed!" -ForegroundColor Green
Write-Host "Run: npm run dev:professional" -ForegroundColor Cyan