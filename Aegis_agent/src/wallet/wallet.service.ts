import { Injectable } from '@nestjs/common';
import * as multichainWallet from 'multichain-crypto-wallet';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function generateKey(password: string): Buffer {
  return createHash('sha256').update(password).digest();
}

const RPC_URL =
  process.env.ENVIRONMENT === 'TESTNET'
    ? process.env.RPC_URL_TESTNET
    : process.env.RPC_URL;

const USDC_ADDRESS =
  process.env.ENVIRONMENT === 'TESTNET'
    ? process.env.USDC_ADDRESS_TESTNET
    : process.env.USDC_ADDRESS;

const DAI_ADDRESS =
  process.env.ENVIRONMENT === 'TESTNET'
    ? process.env.DAI_ADDRESS_TESTNET
    : process.env.DAI_ADDRESS;

@Injectable()
export class WalletService {
  // create wallet
  createEvmWallet = (): Record<string, any> => {
    const wallet = multichainWallet.createWallet({
      network: 'ethereum',
    });

    return wallet;
  };

  // createSolanaWallet = (): Record<string, any> => {
  //   const wallet = multichainWallet.createWallet({
  //     network: 'solana',
  //   });
  //   return wallet;
  // };

  createSolanaWallet = (): Record<string, any> => {
    const keypair = Keypair.generate();
    const privateKey = keypair.secretKey;
    const publicKey = keypair.publicKey;

    return {
      address: publicKey.toBase58(),
      privateKey: bs58.encode(privateKey),
    };
  };

  getEvmWalletFromMnemonic = (mnemonic: string): Record<string, any> => {
    const wallet = multichainWallet.generateWalletFromMnemonic({
      mnemonic,
      network: 'ethereum',
    });

    return wallet;
  };

  getSolanaWalletFromMnemonic = (mnemonic: string): Record<string, any> => {
    const wallet = multichainWallet.generateWalletFromMnemonic({
      mnemonic,
      network: 'solana',
    });
    return wallet;
  };

  getEvmAddressFromPrivateKey = (
    privateKey: string,
  ): Record<string, string> => {
    const wallet = multichainWallet.getAddressFromPrivateKey({
      privateKey,
      network: 'ethereum',
    });

    return wallet;
  };

  getSolanaAddressFromPrivateKey = (
    privateKey: string,
  ): Record<string, string> => {
    const privateKeyBytes = bs58.decode(privateKey);
    const wallet = Keypair.fromSecretKey(privateKeyBytes);
    return {
      address: wallet.publicKey.toBase58(),
      privateKey: bs58.encode(wallet.secretKey),
    };
  };

  encryptEvmWallet = async (
    password: string,
    privateKey: string,
  ): Promise<Record<string, string>> => {
    const encrypted = await multichainWallet.getEncryptedJsonFromPrivateKey({
      network: 'ethereum',
      privateKey,
      password,
    });
    return encrypted;
  };

  encryptSolanaWallet = async (
    password: string,
    privateKey: string,
  ): Promise<Record<string, string>> => {
    const key = generateKey(password);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const encryptedWallet = iv.toString('hex') + ':' + encrypted;
    return { json: encryptedWallet };
  };

  decryptEvmWallet = async (
    password: string,
    encryptedWallet: string,
  ): Promise<Record<string, string>> => {
    const decrypted = await multichainWallet.getWalletFromEncryptedJson({
      network: 'ethereum',
      json: encryptedWallet,
      password,
    });
    return decrypted;
  };

  decryptSolanaWallet = async (
    password: string,
    encryptedWallet: string,
  ): Promise<Record<string, any>> => {
    const key = generateKey(password);
    const [ivHex, encrypted] = encryptedWallet.split(':');
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return {
      privateKey: decrypted,
      address: this.getSolanaAddressFromPrivateKey(decrypted).address,
    };
    // return {
    //   privateKey: '0x' + decryptedPrivateKey.toString('hex'), // Convert to Ethereum format
    //   address: '0x' + keystore.address, // Return the original address
    // };
  };

  getNativeTokenBalance = async (
    address: string,
    rpc: string,
  ): Promise<Record<string, number>> => {
    const balance = await multichainWallet.getBalance({
      address,
      network: 'ethereum',
      rpcUrl: rpc,
    });
    return balance;
  };

  getSolBalance = async (address: string): Promise<Record<string, number>> => {
    const balance = await multichainWallet.getBalance({
      address,
      network: 'solana',
      rpcUrl: `${process.env.SOLANA_RPC}`,
    });
    return balance;
  };

  getERC20Balance = async (
    address: string,
    tokenAddress: string,
    rpc: string,
  ): Promise<Record<string, number>> => {
    const balance = await multichainWallet.getBalance({
      address,
      network: 'ethereum',
      rpcUrl: rpc,
      tokenAddress: tokenAddress,
    });
    return balance;
  };

  getSPLTokenBalance = async (
    address: string,
    tokenAddress: string,
  ): Promise<Record<string, number>> => {
    const balance = await multichainWallet.getBalance({
      address,
      network: 'solana',
      rpcUrl: `${process.env.SOLANA_RPC}`,
      tokenAddress: tokenAddress,
    });
    return balance;
  };

  transferEth = async (
    privateKey: string,
    recipientAddress: string,
    amount: number,
    description?: string,
  ): Promise<Record<any, unknown>> => {
    const transer = await multichainWallet.transfer({
      recipientAddress,
      amount,
      network: 'ethereum',
      rpcUrl: `${RPC_URL}`,
      privateKey,
      // gasPrice: '20', // TODO: increase this for faster transaction
      data: description || '',
    });

    return transer;
  };

  transferUSDC = async (
    privateKey: string,
    recipientAddress: string,
    amount: number,
    description?: string,
  ): Promise<Record<any, unknown>> => {
    const transer = await multichainWallet.transfer({
      recipientAddress,
      amount,
      network: 'ethereum',
      rpcUrl: `${RPC_URL}`,
      privateKey,
      // gasPrice: '20', // TODO: increase this for faster transaction
      tokenAddress: USDC_ADDRESS,
      data: description || '',
    });

    return transer;
  };

  transferDAI = async (
    privateKey: string,
    recipientAddress: string,
    amount: number,
    description?: string,
  ): Promise<Record<any, unknown>> => {
    const transer = await multichainWallet.transfer({
      recipientAddress,
      amount,
      network: 'ethereum',
      rpcUrl: `${RPC_URL}`,
      privateKey,
      // gasPrice: '20', // TODO: increase this for faster transaction
      tokenAddress: DAI_ADDRESS,
      data: description || '',
    });

    return transer;
  };

  getEvmTransactionReceipt = async (
    hash: string,
  ): Promise<Record<any, unknown>> => {
    const receipt = await multichainWallet.getTransaction({
      hash,
      network: 'ethereum',
      rpcUrl: `${RPC_URL}`,
    });

    return receipt;
  };

  getSolanaTransactionReceipt = async (
    hash: string,
  ): Promise<Record<any, unknown>> => {
    const receipt = await multichainWallet.getTransaction({
      hash,
      network: 'solana',
      rpcUrl: `${RPC_URL}`,
    });

    return receipt;
  };
}
