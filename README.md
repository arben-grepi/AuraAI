# AI Chat Application

A modern, full-stack AI chat application built with Next.js 15, featuring real-time conversations, user authentication, and organization management.

## Features

-  **AI Chat Interface** - Real-time conversations with OpenAI GPT models
-  **Authentication** - Secure user authentication with Better Auth
-  **Organization Management** - Multi-tenant organization support
-  **Responsive Design** - Mobile-first, accessible UI with Tailwind CSS
-  **Modern UI** - Beautiful components built with Radix UI and Shadcn
-  **Email Integration** - Email verification and password reset
-  **Performance** - Optimized with Next.js App Router and Turbopack
-  **Monitoring** - Error tracking with Sentry
-  **Comprehensive Testing** - Unit, integration, and E2E tests

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI, Shadcn UI
- **Authentication**: Better Auth
- **Database**: PostgreSQL with Prisma ORM
- **AI Integration**: OpenAI GPT models via AI SDK
- **Email**: Resend
- **Monitoring**: Sentry
- **Testing**: Jest, React Testing Library, Playwright

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- OpenAI API key

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd ai-chat
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

Fill in the required environment variables:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/ai_chat"
DIRECT_URL="postgresql://username:password@localhost:5432/ai_chat"
BETTER_AUTH_SECRET="your-secret-key"
BETTER_AUTH_URL="http://localhost:3000"
OPENAI_API_KEY="your-openai-api-key"
RESEND_API_KEY="your-resend-api-key"
NEXT_PUBLIC_SENTRY_DSN="your-sentry-dsn"
SENTRY_DSN="your-sentry-dsn"
```

4. Set up the database:

```bash
npx prisma migrate dev
npx prisma generate
```

5. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Testing

This project includes comprehensive testing with Jest, React Testing Library, and Playwright.

### Running Tests

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run end-to-end tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

### Test Coverage

- **Unit Tests**: Components, hooks, utilities, server actions
- **Integration Tests**: API routes, database operations
- **E2E Tests**: User workflows, authentication flows

See [`__tests__/README.md`](__tests__/README.md) for detailed testing documentation.

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── (admin)/           # Admin pages
│   ├── api/               # API routes
│   └── chat/              # Chat interface
├── components/            # React components
│   ├── ui/                # Reusable UI components
│   ├── ai/                # AI-specific components
│   └── auth/              # Authentication components
├── lib/                   # Utility functions and configurations
├── hooks/                 # Custom React hooks
├── __tests__/             # Test files
├── e2e/                   # End-to-end tests
└── prisma/                # Database schema and migrations
```

## Development

### Code Style

- TypeScript for type safety
- ESLint for code linting
- Prettier for code formatting
- Functional components with hooks
- Server-side rendering where possible

### Key Commands

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Database
npx prisma studio        # Open Prisma Studio
npx prisma migrate dev   # Run database migrations
npx prisma generate      # Generate Prisma client

# Testing
npm test                 # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage
npm run test:e2e         # Run E2E tests
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically on push

### Other Platforms

The application can be deployed to any platform that supports Next.js:

- Railway
- Render
- DigitalOcean App Platform
- AWS Amplify

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License.
