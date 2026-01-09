#!/bin/bash

echo "🚀 Installing VirtualCFO Inventory Management Dependencies..."

# Backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install compression lodash
echo "✅ Backend dependencies installed"

# Frontend dependencies  
echo "📦 Installing frontend dependencies..."
cd ..
npm install
echo "✅ Frontend dependencies installed"

# Run database migrations
echo "🗄️ Running database migrations..."
echo "Please run the following SQL files in your Supabase dashboard:"
echo "1. supabase/migrations/20260108080000_add_audio_confirmations.sql"
echo "2. supabase/migrations/20260108090000_performance_optimizations.sql"

echo "🎉 Installation complete!"
echo ""
echo "Next steps:"
echo "1. Run database migrations in Supabase"
echo "2. Start backend: cd backend && npm run dev"
echo "3. Start frontend: npm run dev"
echo "4. Configure Redis URL in backend/.env (optional)"
echo ""
echo "🔧 New features available:"
echo "• Audio confirmations for inventory operations"
echo "• Real-time notifications via SSE"
echo "• Advanced analytics dashboard"
echo "• AI-powered reorder recommendations"
echo "• Performance optimizations with caching"