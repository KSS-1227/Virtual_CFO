---
description: Repository Information Overview
alwaysApply: true
---

# Virtual CFO Repository Information

## Summary
A comprehensive Virtual CFO application designed for small businesses in India. The project features a modern React frontend with Shadcn UI, a Node.js/Express backend for AI-powered insights, and Supabase for database management, authentication, and edge functions.

## Repository Structure
The repository is organized as a multi-project monorepo:
- **Root**: Main frontend application (React + Vite).
- **backend/**: Node.js Express server for AI processing and core business logic.
- **admin/**: Administrative dashboard for managing products and services.
- **supabase/**: Supabase configuration, migrations, and edge functions.
- **demo-files/**: Sample data for testing and demonstrations.

## Projects

### Main Frontend (Root)
The primary user interface for business owners to track earnings, chat with AI, and manage their profile.

#### Language & Runtime
**Language**: TypeScript  
**Version**: Node.js 18+  
**Build System**: Vite 7  
**Package Manager**: npm

#### Dependencies
**Main Dependencies**:
- `@supabase/supabase-js`: Database & Auth client
- `@tanstack/react-query`: Data fetching & caching
- `recharts`, `chart.js`: Financial data visualization
- `lucide-react`: UI iconography
- `shadcn/ui`: Component library

#### Build & Installation
```bash
# Install dependencies
npm install

# Start development server (Port 5173)
npm run dev
```

### Backend (Express)
Handles complex AI reasoning, Graph RAG, and serves as an integration layer for OpenAI and Supabase.

#### Language & Runtime
**Language**: JavaScript (Node.js)  
**Version**: Node.js 18+  
**Build System**: Express.js  
**Package Manager**: npm

#### Dependencies
**Main Dependencies**:
- `openai`: AI model integration
- `express`: REST API framework
- `cors`, `helmet`: Security and cross-origin handling
- `jsonwebtoken`: Token-based security
- `multer`: File upload handling

#### Build & Installation
```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Start development server (Port 5000)
npm run dev
```

### Admin Dashboard (Admin)
A separate portal for administrative tasks like product management.

#### Language & Runtime
**Language**: TypeScript  
**Version**: Node.js 18+  
**Build System**: Vite  
**Package Manager**: npm

#### Build & Installation
```bash
# Navigate to admin
cd admin

# Install dependencies
npm install

# Start development server (Port 3001)
npm run dev
```

## Main Files & Resources
- `src/lib/api.ts`: Centralized API service for frontend-backend communication.
- `backend/index.js`: Main entry point for the Express backend.
- `backend/routes/`: API endpoint definitions (auth, profile, documents, chat, ai, business-ideas).
- `supabase/functions/`: Edge functions for serverless operations (earnings-add, earnings-summary).
- `.env.example`: Template for required environment variables (Supabase, OpenAI, SMTP).

## Usage & Operations
The application requires both the frontend and backend to be running simultaneously for full functionality:
1. Start the backend on port **5000**.
2. Start the frontend on port **5173**.
3. Ensure `.env` files are configured in both the root and `backend/` directories.

## Validation
- **Linting**: `npm run lint` in root.
- **Backend Health**: `GET http://localhost:5000/health`
- **Manual Verification**: Use `connection-test.js` to verify connectivity.
