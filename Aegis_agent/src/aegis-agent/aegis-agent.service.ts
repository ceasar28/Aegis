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
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  approveChecked,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import bs58 from 'bs58';
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
  ChainName,
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

  async crossSwapToken(
    privateKey: { evm: string; solana: string },
    prompt: string,
  ) {
    try {
      const { fromToken, toToken, amount, fromChain, toChain, providerUrl } =
        this.processPrompt(prompt);

      const [fromTokenAddress, toTokenAddress] = await Promise.all([
        this.getTokenAddress(fromChain, fromToken),
        this.getTokenAddress(toChain, toToken),
      ]);

      if (!fromTokenAddress || !toTokenAddress) {
        console.error('Failed to fetch token addresses');
        return;
      }

      const payer = Keypair.fromSecretKey(bs58.decode(privateKey.solana)); // ✅ Correct conversion

      const provider = new ethers.JsonRpcProvider(providerUrl);
      const signer = new ethers.Wallet(privateKey.evm, provider);

      let destinationAddress: any;
      if (toChain === 'solana') {
        destinationAddress = payer.publicKey;
      } else {
        destinationAddress = signer.address;
      }

      if (fromChain === 'solana') {
        // **SOLANA FLOW**
        console.log('Processing swap on Solana...');

        const connection = new Connection(providerUrl);
        const fromTokenMint = new PublicKey(fromTokenAddress);

        // const tokenAccount = await connection.getParsedTokenAccountsByOwner(
        //   payer.publicKey,
        //   { mint: fromTokenMint }
        // );

        // // If no associated token account exists, create one
        // let userTokenAccount;
        // if (tokenAccount.value.length === 0) {
        //   console.log("No associated token account found. Creating one...");
        //   userTokenAccount = await getAssociatedTokenAddress(
        //     fromTokenMint,
        //     payer.publicKey
        //   );

        //   const transaction = new Transaction().add(
        //     createAssociatedTokenAccountInstruction(
        //       payer.publicKey, // Payer
        //       userTokenAccount, // New Token Account
        //       payer.publicKey, // Owner
        //       fromTokenMint // Token Mint
        //     )
        //   );

        //   await sendAndConfirmTransaction(connection, transaction, [payer]);
        //   console.log("Created associated token account:", userTokenAccount.toString());
        // } else {
        //   userTokenAccount = tokenAccount.value[0].pubkey;
        //   console.log("Using existing associated token account:", userTokenAccount.toString());
        // }

        console.log('here');
        const quotes = await fetchQuote({
          amount,
          fromToken: fromTokenAddress,
          toToken: toTokenAddress,
          fromChain,
          toChain,
          slippageBps: 300,
          gasDrop: 0,
          referrerBps: 5,
        });

        console.log('Fetched Quotes:', quotes);

        // const approvalTx = await approveChecked(
        //   connection,
        //   payer,
        //   fromTokenMint,
        //   payer.publicKey,
        //   new PublicKey(addresses.MAYAN_FORWARDER_CONTRACT),
        //   payer,
        //   amount,
        //   6 // Assuming USDC or similar token with 6 decimals
        // );

        // console.log("Approval Confirmed!", approvalTx);

        console.log('Initiating Swap...');
        const swapTrx = await swapFromSolana(
          quotes[0],
          payer.publicKey.toString(),
          destinationAddress,
          {
            evm: '0xB4b781F17d3E40976B653f1EA4DeD57bD0189654',
            solana: 'Dfo4P23Au7U5ZdZV8myrh3j7gY4HKai7qoVop33EaKwd',
          },
          {} as any,
        );

        console.log('Swap Transaction:', swapTrx);
      } else {
        // **EVM FLOW**
        console.log('Processing swap on EVM...');

        const quotes = await fetchQuote({
          amount,
          fromToken: fromTokenAddress,
          toToken: toTokenAddress,
          fromChain,
          toChain,
          slippageBps: 300,
          gasDrop: 0,
          referrerBps: 5,
        });

        console.log('Fetched Quotes:', quotes);

        // Approve Token Transfer
        const tokenContract = new ethers.Contract(
          fromTokenAddress,
          ERC20_ABI,
          signer,
        );
        const approvalTx = await tokenContract.approve(
          addresses.MAYAN_FORWARDER_CONTRACT,
          amount,
        );

        await approvalTx.wait();
        console.log('Approval Confirmed!');

        console.log('Initiating Swap...');
        const swapTrx = await swapFromEvm(
          quotes[0],
          signer.address,
          destinationAddress,
          {
            evm: '0xB4b781F17d3E40976B653f1EA4DeD57bD0189654',
            solana: 'Dfo4P23Au7U5ZdZV8myrh3j7gY4HKai7qoVop33EaKwd',
          },
          signer,
          null,
          null,
          null,
        );

        console.log('Swap Transaction:', swapTrx);
      }
    } catch (error) {
      console.error('Error in crossSwapToken:', error);
    }
  }

  processPrompt(prompt: string) {
    const regex =
      /(swap|bridge)\s*(\d+)\s*([a-zA-Z0-9]+)\s*on\s*([a-zA-Z0-9]+)\s*to\s*([a-zA-Z0-9]+)\s*on\s*([a-zA-Z0-9]+)/i;
    const match = prompt.match(regex);

    if (!match) {
      throw new Error(
        "Invalid prompt format. Use: 'Swap 10usdc on base to eth on arbitrum' or 'Bridge 10usdc on base to eth on arbitrum'",
      );
    }

    const amount = parseFloat(match[2]);
    const fromToken = match[3].trim();
    const fromChain = match[4].trim().toLowerCase();
    const toToken = match[5].trim();
    const toChain = match[6].trim().toLowerCase();

    const validChains = [
      'solana',
      'ethereum',
      'bsc',
      'polygon',
      'avalanche',
      'arbitrum',
      'optimism',
      'base',
      'aptos',
      'sui',
    ];

    if (!validChains.includes(fromChain)) {
      throw new Error(
        `Invalid fromChain: '${fromChain}'. Must be one of: ${validChains.join(', ')}`,
      );
    }

    if (!validChains.includes(toChain)) {
      throw new Error(
        `Invalid toChain: '${toChain}'. Must be one of: ${validChains.join(', ')}`,
      );
    }

    // Mapping chain names to RPC URLs
    const chainToProvider: Record<ChainName, string> = {
      solana: 'https://api.mainnet-beta.solana.com',
      ethereum:
        'https://eth-mainnet.g.alchemy.com/v2/6vymiRot3yVb5FSi-GQVBKYD3wQmPq5k',
      bsc: 'https://bsc-dataseed.bnbchain.org',
      polygon: 'https://polygon-rpc.com',
      avalanche: 'https://api.avax.network/ext/bc/C/rpc',
      arbitrum: 'https://arb1.arbitrum.io/rpc',
      optimism: 'https://mainnet.optimism.io',
      base: 'https://mainnet.base.org',
      aptos: 'https://fullnode.mainnet.aptoslabs.com',
      sui: 'https://fullnode.mainnet.sui.io',
    };
    const providerUrl = chainToProvider[fromChain as ChainName];

    return {
      fromToken,
      toToken,
      amount,
      fromChain: fromChain as ChainName,
      toChain: toChain as ChainName,
      providerUrl,
    };
  }

  async getTokenAddress(chain: string, tokenSymbol: string) {
    try {
      const url = `https://price-api.mayan.finance/v3/tokens?chain=${chain}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data[chain]) {
        console.error(`No data found for chain: ${chain}`);
        return null;
      }

      // Find the token by symbol
      const token = data[chain].find(
        (t: any) => t.symbol.toLowerCase() === tokenSymbol.toLowerCase(),
      );

      if (!token) {
        console.error(`Token ${tokenSymbol} not found on chain ${chain}`);
        return null;
      }

      // Use wrapped address if it's a native token
      return token.contract === '0x0000000000000000000000000000000000000000'
        ? token.wrappedAddress
        : token.contract;
    } catch (error) {
      console.error(
        `Error fetching token address for ${tokenSymbol} on ${chain}:`,
        error,
      );
      return null;
    }
  }

  async crossSwapTokenMain(pK: string) {
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
