import { Injectable } from '@nestjs/common';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { http } from 'viem';
import { createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mantle } from 'viem/chains';
import { getOnChainTools } from '@goat-sdk/adapter-vercel-ai';
import { moe } from '../../sdk/goat-sdk/plugins/moe/src';
import {
  USDC,
  USDT,
  erc20,
  MODE,
  WMNT,
  MNT,
  MOE,
} from '../../sdk/goat-sdk/plugins/erc20/src';
import { sendETH } from '@goat-sdk/wallet-evm';
import { viem } from '@goat-sdk/wallet-viem';
import {
  fetchQuote,
  swapFromEvm,
  swapFromSolana,
  Quote,
  addresses,
  fetchAllCoins,
  fetchAllTokenList,
} from '@mayanfinance/swap-sdk';
import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import { ERC20_ABI } from '@sdk/goat-sdk/plugins/erc20/src/abi';
dotenv.config();

@Injectable()
export class AegisAgentService {
  constructor() {}

  async agentChat(prompt: string) {
    try {
      const llmPrompt = `You are an AI agent specializing in the wormhole multichain. Provide a clear, concise, and accurate response to the following message: ${prompt}`;

      const result = await generateText({
        model: openai('gpt-4o-mini'),
        maxSteps: 10,
        prompt: llmPrompt,
        onStepFinish: (event) => {
          console.log(event.toolResults);
        },
      });

      return { response: result.text };
    } catch (error) {
      console.log(error);
    }
  }

  async swapToken(pK: any, prompt: string) {
    console.log(prompt);
    try {
      const privateKey = pK.startsWith('0x') ? pK : `0x${pK}`;
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      const walletClient = createWalletClient({
        account,
        transport: http(process.env.RPC_URL),
        chain: mantle,
      });

      const tools = await getOnChainTools({
        wallet: viem(walletClient),
        plugins: [
          moe(),
          sendETH(),
          erc20({ tokens: [USDC, USDT, MODE, WMNT, MNT, MOE] }),
          // agni(),
        ],
      });

      const result = await generateText({
        model: openai('gpt-4o-mini'),
        tools: tools,
        maxSteps: 10,
        prompt: prompt,
        onStepFinish: (event) => {
          console.log(event.toolResults);
        },
      });
      console.log(result.text);
      return result.text;
    } catch (error) {
      console.log(error);
    }
  }

  async crossSwapToken(pK: string) {
    const allTokens = await fetchAllTokenList(['native', 'erc20', 'spl']);

    return allTokens;
    // const provider = createPublicClient({
    //   chain: base,
    //   transport: http('https://rpc.network'),
    // });
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');

    // const signer = createWalletClient({
    //   chain: mainnet,
    //   transport: http('https://rpc.network'),
    //   account: account,
    // });
    const signer = new ethers.Wallet(pK, provider);

    try {
      const quotes = await fetchQuote({
        amount: 10,
        fromToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        toToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        fromChain: 'base',
        toChain: 'solana',
        slippageBps: 300, // means 3%
        gasDrop: 0, // optional
        referrer: 'YOUR SOLANA WALLET ADDRESS', // optional
        referrerBps: 5, // optional
      });
      console.log(quotes);
      // const permit = null;
      // const swapTrx = await swapFromEvm(
      //   quotes[0],
      //   '7eBmtW8CG1zJ6mEYbTpbLRtjD1BLHdQdU5Jc8Uip42eE',
      //   {
      //     evm: '0x2ad4BEF43B6a64bbFeBCd376262382b54D6CbD76',
      //     solana: '7eBmtW8CG1zJ6mEYbTpbLRtjD1BLHdQdU5Jc8Uip42eE',
      //   },
      //   provider,
      //   signer,
      //   permit,
      // );
      // const amount = ethers.parseUnits('10', 18);
      // const tokenContract = new ethers.Contract(
      //   '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      //   ERC20_ABI,
      //   signer,
      // );

      // const approvalTx = await tokenContract.approve(
      //   addresses.MAYAN_FORWARDER_CONTRACT,
      //   amount,
      // );
      // await approvalTx.wait();
      // console.log('approval sent:', approvalTx.hash);

      // const swapTrx = await swapFromEvm(
      //   quotes[0],
      //   '0x2ad4BEF43B6a64bbFeBCd376262382b54D6CbD76', // EVM address initiating the swap
      //   '6x3rd7Wxhg6eKbtFyf7pJMuCA69LSR9DXYSs3Kq4eaUE', // Solana destination address
      //   null, // No referrer addresses
      //   signer, // EVM Signer
      //   null, // No permit
      //   null, // No overrides
      //   null, // No additional payload
      // );
      // console.log(swapTrx);
      return quotes;
    } catch (error) {
      console.log(error);
    }
  }

  async analyzeToken(contract: string) {
    try {
      const geckoUrl = `https://api.geckoterminal.com/api/v2/networks/mantle/tokens/${contract}`;
      const urls = [`${geckoUrl}`];

      // Fetch all data concurrently
      const [tokenData] = await Promise.all(
        urls.map((url) =>
          fetch(url, { method: 'GET' }).then((response) => response.json()),
        ),
      );

      // Respond with the collected data
      const tokenAnalyticData = {
        address: tokenData.data.attributes.address,
        name: tokenData.data.attributes.name,
        symbol: tokenData.data.attributes.symbol,
        decimal: tokenData.data.attributes.decimal,
        total_supply: tokenData.data.attributes.total_supply,
        price_usd: tokenData.data.attributes.price_usd,
        fully_Diluted_Valuation:
          tokenData.data.attributes.fdv_usd ||
          parseFloat(tokenData.data.attributes.price_usd) *
            parseFloat(tokenData.data.attributes.price_usd),
        market_cap_usd: tokenData.data.attributes.market_cap_usd,
        volume_usd: tokenData.data.attributes.volume_usd.h24,
      };

      const prompt = `You are an AI agent specializing in Token sentiment analysis. Your task is to analyze a token based on the provided on-chain data and generate detailed  market sentiment analysis in this format:
      Name of token, symbol, price, Number of holders, FDV, and 24hr volume  Please present the response in a structured  markdown format,for a crypto trader.

Here is the token data:
- Token Name: ${tokenAnalyticData.name}  
- Symbol: ${tokenAnalyticData.symbol}  
- Contract Address: ${tokenAnalyticData.address}  
- Decimals: ${tokenAnalyticData.decimal}  
- Total Supply: ${tokenAnalyticData.total_supply}  
- Current Price (USD): $${tokenAnalyticData.price_usd}  
- Fully Diluted Valuation (FDV): $${tokenAnalyticData.fully_Diluted_Valuation}  
${tokenAnalyticData.market_cap_usd ? `- **Market Cap (USD)**: $${tokenAnalyticData.market_cap_usd}` : ''}  
- 24h Trading Volume (USD): $${tokenAnalyticData.volume_usd || 'Data Missing'}  
`;

      const result = await generateText({
        model: openai('gpt-4o-mini'),
        maxSteps: 10,
        prompt: prompt,
        onStepFinish: (event) => {
          console.log(event.toolResults);
        },
      });

      return { insight: result.text };
    } catch (error) {
      console.log(error);
    }
  }
}
