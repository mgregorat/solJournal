# TradeLog - Solana Meme Coin Trade Journal

A comprehensive trading journal for tracking and analyzing your Solana meme coin trades. Built with Next.js, Solana Web3.js, and Supabase.

## Features

- 🔗 **Wallet Integration**: Connect with Phantom, Solflare, and other Solana wallets
- 📊 **Trade Logging**: Log buy/sell trades with detailed information
- 📈 **Dashboard Analytics**: View trading performance and statistics
- 📋 **Trade History**: Browse and filter your trading history
- 💾 **Data Persistence**: Store trades securely in Supabase
- 🎨 **Modern UI**: Beautiful dark theme with green accents

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Blockchain**: Solana Web3.js, Wallet Adapters (Jupiter)
- **Backend**: Supabase (PostgreSQL)
- **Deployment**: Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, or pnpm
- Solana wallet (Phantom, Solflare, etc.)
- Supabase account

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd tradelog
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Run the database schema:

```bash
# Copy the contents of database-schema.sql
# Paste and run in your Supabase SQL editor
```

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1. **Connect Wallet**: Click the "Connect Wallet" button and select your Solana wallet
2. **Log Trades**: Navigate to "Log Trade" tab to record new trades
3. **View Dashboard**: Check your trading statistics and recent activity
4. **Browse History**: View and filter your complete trading history

## Database Schema

The app uses three main tables:

- **trades**: Stores individual trade records
- **tokens**: Contains token metadata and information
- **user_preferences**: User-specific settings and preferences

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

Make sure to set these in your deployment platform:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SOLANA_RPC_URL`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support, please open an issue on GitHub or contact the development team.