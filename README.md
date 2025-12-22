# VirtualCFO 💼

> AI-powered financial intelligence platform for Indian small businesses

[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green.svg)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.17-blue.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🚀 Overview

VirtualCFO transforms how India's 65M+ small businesses manage their finances. From WhatsApp messages to CFO-level insights in 60 seconds - we're democratizing financial intelligence for businesses that can't afford a dedicated CFO.

### The Problem We're Solving
- **90% of small businesses** lack financial expertise
- **₹2.4L average annual loss** due to preventable financial mistakes
- **40+ hours monthly** wasted on manual bookkeeping
- **Complex tools** built for enterprises, not local shops

### Our Solution
- **AI-powered financial analysis** with real-time insights
- **WhatsApp integration** for maximum accessibility
- **GST-compliant reporting** with automated document processing
- **Business health monitoring** with actionable recommendations

## 🛠️ Tech Stack

### Frontend
```
React 18.3.1 + TypeScript 5.8.3
├── Vite (Lightning-fast dev server)
├── shadcn/ui (Professional component library)
├── Tailwind CSS (Utility-first styling)
├── React Query (Server state management)
├── React Router (Client-side routing)
├── Recharts (Data visualization)
└── Zustand (Global state management)
```

### Backend & Infrastructure
```
Supabase (Backend-as-a-Service)
├── PostgreSQL (Primary database)
├── Edge Functions (Serverless API)
├── Real-time subscriptions
├── Row Level Security (RLS)
├── Authentication & Authorization
└── File storage
```

### Key Integrations
- **OpenAI GPT-4** - AI-powered insights and chat
- **Tesseract.js** - OCR for receipt processing
- **Gmail SMTP** - Email automation
- **WhatsApp Cloud API** - Notification system
- **Chart.js/Recharts** - Interactive analytics

## 🏃‍♂️ Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- OpenAI API key (optional, for AI features)

### Installation

```bash
# Clone the repository
git clone https://github.com/KSS-1227/Virtual_CFO.git
cd Virtual_CFO

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

### Environment Setup

Create a `.env` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI (Optional - for AI features)
VITE_OPENAI_API_KEY=your_openai_api_key

# Email Configuration (Production)
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

## 📱 Features

### Core Functionality
- **📊 Smart Dashboard** - Real-time business health monitoring
- **💰 Daily Earnings Tracker** - Simple income/expense logging
- **🤖 AI CFO Assistant** - 24/7 financial guidance via chat
- **📄 Document Processing** - OCR-powered receipt scanning
- **📈 Analytics & Insights** - Automated SWOT analysis
- **📧 Smart Notifications** - WhatsApp & email reminders
- **📋 GST Reports** - Compliant P&L statements

### Advanced Features
- **🎯 Predictive Analytics** - Cash flow forecasting
- **🏆 Gamification** - Achievement system for consistent tracking
- **📱 Progressive Web App** - Offline capability
- **🌐 Multi-language Support** - Hindi & English
- **🔒 Bank-grade Security** - End-to-end encryption

## 🏗️ Project Structure

```
VirtualCFO/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── advanced/       # Advanced dashboard features
│   │   └── *.tsx           # Feature components
│   ├── pages/              # Route components
│   ├── lib/                # Utilities and helpers
│   ├── hooks/              # Custom React hooks
│   └── integrations/       # External service integrations
├── supabase/
│   ├── functions/          # Edge Functions (API)
│   ├── migrations/         # Database schema
│   └── config.toml         # Supabase configuration
├── backend/                # Node.js API (alternative)
└── admin/                  # Admin dashboard
```

## 🚀 Deployment

### Frontend (Vercel - Recommended)

```bash
# Build for production
npm run build

# Deploy to Vercel
npx vercel --prod
```

### Backend (Supabase Edge Functions)

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Deploy functions
supabase functions deploy

# Set environment secrets
supabase secrets set OPENAI_API_KEY=your_key
supabase secrets set SMTP_USERNAME=your_email
```

### Database Setup

```bash
# Run migrations
supabase db push

# Seed initial data (optional)
psql -h your-db-host -d postgres -f seed-initial-benchmarks.sql
```

## 📊 API Documentation

### Core Endpoints

```typescript
// Add daily earnings
POST /functions/v1/earnings-add
{
  "income": 5000,
  "inventory_cost": 3000,
  "date": "2024-01-15"
}

// Get business summary
GET /functions/v1/earnings-summary

// AI chat interaction
POST /functions/v1/chat
{
  "message": "How can I improve my profit margin?",
  "context": "restaurant_business"
}
```

Full API documentation: [VIRTUALCFO_BACKEND_API.md](VIRTUALCFO_BACKEND_API.md)

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Test API endpoints
npm run test:api
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines
- Follow TypeScript best practices
- Use conventional commit messages
- Add tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Lead Developer**: KSS-1227
- **Email**: sherigarakarthik17@gmail.com
- **GitHub**: [@KSS-1227](https://github.com/KSS-1227)

## 📞 Support
- **Issues**: [GitHub Issues](https://github.com/KSS-1227/Virtual_CFO/issues)
- **Email**: sherigarakarthik17@gmail.com
---

<div align="center">
  <p><strong>Built with ❤️ for India's small business community</strong></p>
  <p>Empowering 65M+ businesses with AI-powered financial intelligence</p>
</div>

