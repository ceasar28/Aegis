# Aegis - Cross-Chain Crypto Portfolio Rebalancer

Aegis is an AI-powered cross-chain portfolio rebalancing tool that automates token swaps based on market insights. It continuously analyzes market conditions and executes transactions to maintain optimal portfolio allocations.

## Features

- **Agentic Cross Swaps** – Automatically rebalances portfolios across chains.
- **AI-Powered Insights** – Uses Vercel AI to analyze market trends.
- **Threshold-Based Automation** – Set rebalancing thresholds and let Aegis handle the rest.
- **Real-Time Adjustments** – Ensures optimal allocations without manual intervention.
- **Seamless Execution** – Integrates with Telegram for trade execution and notifications.

## Tech Stack

| Component       | Tool/Service  |
|----------------|--------------|
| **AI**         | Vercel AI    |
| **Blockchain** | Wormhole (Mayan Exchange) |
| **Backend**    | NestJS, TypeScript |
| **Messaging**  | Telegram |

## How It Works

1. **Select Tokens** – Choose the assets you want to rebalance.
2. **Set Thresholds** – Define the conditions for automatic swaps.
3. **AI Analysis** – Aegis analyzes market trends and token insights.
4. **Automatic Execution** – Trades execute when thresholds are met.
5. **Stay Updated** – Get real-time notifications via Telegram.

## Getting Started

### Prerequisites
- Node.js & pnpm
- A Telegram bot token

### Installation

```bash
# Clone the repo
git clone https://github.com/ceasar28/Aegis.git
cd Aegis_agent

# Install dependencies
pnpm install
```

### Configuration
1. Create a `.env` file and add the necessary credentials from `.env.example`:
2. Start the bot:
   ```bash
   pnpm run start:dev
   ```

## Contributing
Pull requests are welcome! Feel free to open an issue to discuss improvements.

## License
MIT License

---
Made with ❤️ by TechFromRoot