#!/bin/bash

# Professional Inventory Management System Installation Script
echo "🚀 Installing Professional Inventory Management System..."

# Install dependencies
npm install compression lodash

# Run database migration
echo "📊 Running database migration..."
supabase db push

# Add environment variables
if ! grep -q "PROFESSIONAL_INVENTORY_ENABLED" .env; then
    echo "" >> .env
    echo "# Professional Inventory Configuration" >> .env
    echo "PROFESSIONAL_INVENTORY_ENABLED=true" >> .env
    echo "AI_LEARNING_ENABLED=true" >> .env
    echo "MULTIMODAL_PROCESSING_ENABLED=true" >> .env
fi

# Add npm scripts
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!pkg.scripts) pkg.scripts = {};
pkg.scripts['dev:professional'] = 'PROFESSIONAL_INVENTORY_ENABLED=true npm run dev';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

echo "✅ Professional Inventory Management installed!"
echo "Run: npm run dev:professional"