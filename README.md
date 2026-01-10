# VirtualCFO - AI-Powered Financial Assistant

## 🚀 Project Overview

VirtualCFO is an intelligent financial management platform designed for Indian SMBs, featuring multi-modal AI capabilities including receipt processing, voice commands in Hindi/English, and business intelligence analysis.

## 📁 Project Structure

```
Virtual_CFO/
├── frontend/          # React + TypeScript frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── lib/           # Utilities
│   │   └── hooks/         # Custom hooks
│   ├── public/            # Static assets
│   └── package.json       # Frontend dependencies
├── backend/           # Node.js + Express backend
│   ├── controllers/       # Route controllers
│   ├── routes/           # API routes
│   ├── middleware/       # Express middleware
│   ├── services/         # Business logic
│   ├── config/           # Configuration
│   └── package.json      # Backend dependencies
├── .gitignore
├── README.md
└── package.json      # Root monorepo config
```

## ✨ Key Features

### 🤖 Multi-Modal AI Integration
- **GPT-4 Vision**: Instant receipt and document analysis
- **Whisper AI**: Hindi/English voice command processing
- **Text-to-Speech**: Voice responses in multiple languages
- **Business Intelligence**: Photo analysis for business insights

### 📊 Financial Management
- Real-time earnings tracking
- Automated expense categorization
- Monthly financial summaries
- Market analysis and predictions
- Product recommendation system

### 🎯 User Experience
- Intuitive dashboard with modern UI
- Mobile-responsive design
- Real-time notifications
- Batch document processing
- Duplicate detection system

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Shadcn/ui** components
- **Vite** for build tooling
- **Supabase** for authentication

### Backend
- **Node.js** with Express
- **Supabase** for database
- **OpenAI APIs** (GPT-4, Whisper, TTS)
- **Redis** for caching (optional)
- **JWT** authentication

### AI & ML
- **GPT-4 Vision** for image analysis
- **Whisper** for speech-to-text
- **GPT-4o-mini** for text processing
- **TTS** for voice responses

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- OpenAI API key

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Virtual_CFO
```

2. **Install all dependencies**
```bash
npm run install:all
```

3. **Environment Setup**
```bash
# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env
```

4. **Configure environment variables**

**Root .env:**
```env
# Add any global environment variables here
```

**Backend .env:**
```env
PORT=5000
NODE_ENV=development
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_jwt_secret
```

**Frontend .env:**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:5000
```

5. **Start the application**
```bash
# Start both frontend and backend
npm run dev

# Or start individually
npm run dev:frontend  # Frontend only
npm run dev:backend   # Backend only
```

## 📱 Usage

### Multi-Modal Features

1. **Receipt Processing**
   - Take photos with camera or upload files
   - AI extracts amount, date, vendor, category
   - Auto-saves to earnings database

2. **Voice Commands**
   - Record voice in Hindi or English
   - Say: "Maine aaj 2500 rupaye kharcha kiya"
   - AI processes and executes commands

3. **Business Analysis**
   - Upload photos of your business/inventory
   - Get AI-powered insights and recommendations
   - Receive actionable business advice

## 🔧 Development Scripts

### Root Level
```bash
npm run dev              # Start both frontend and backend
npm run build            # Build both applications
npm run install:all      # Install all dependencies
npm run clean           # Clean all node_modules and dist folders
```

### Frontend
```bash
cd frontend
npm run dev             # Start development server
npm run build           # Build for production
npm run preview         # Preview production build
npm run test            # Run tests
```

### Backend
```bash
cd backend
npm run dev             # Start development server
npm run start           # Start production server
npm run test            # Run tests
```

## 🔒 Security

- JWT-based authentication
- Rate limiting on all endpoints
- Input validation and sanitization
- Secure file upload handling
- Environment variable protection

## 📊 Performance

- **Processing Speed**: <10s for receipt analysis
- **Voice Processing**: <5s for command execution
- **Uptime**: 99.9% target availability
- **Scalability**: Supports 10K+ concurrent users

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Contact: support@virtualcfo.ai

---

**Built with ❤️ for Indian SMBs**