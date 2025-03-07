import { Injectable } from '@nestjs/common';
import * as multichainWallet from 'multichain-crypto-wallet';
import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createHmac,
  createDecipheriv,
} from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

dotenv.config();

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

  createSolanaWallet = (): Record<string, any> => {
    const wallet = multichainWallet.createWallet({
      network: 'solana',
    });
    return wallet;
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
    const wallet = multichainWallet.getAddressFromPrivateKey({
      privateKey,
      network: 'solana',
    });

    return wallet;
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
    const salt = randomBytes(32); // random salt
    const iv = randomBytes(16); // random IV

    // Derive encryption key using Scrypt (Ethereum keystore standard)
    const key = scryptSync(password, salt, 32, { N: 131072, r: 8, p: 1 });

    // Encrypt private key using AES-128-CTR
    const cipher = createCipheriv('aes-128-ctr', key.slice(0, 16), iv);
    const encryptedPrivateKey = Buffer.concat([
      cipher.update(privateKey),
      cipher.final(),
    ]);

    // Generate MAC (message authentication code)
    const mac = createHmac('sha256', key.slice(16))
      .update(encryptedPrivateKey)
      .digest();

    // Create Ethereum-style keystore JSON
    const keystoreJson = {
      address: Buffer.from(privateKey).toString('hex').slice(0, 40), // Fake address (Solana doesn't use Ethereum format)
      id: uuidv4(),
      version: 3,
      Crypto: {
        cipher: 'aes-128-ctr',
        cipherparams: {
          iv: iv.toString('hex'),
        },
        ciphertext: encryptedPrivateKey.toString('hex'),
        kdf: 'scrypt',
        kdfparams: {
          salt: salt.toString('hex'),
          n: 131072,
          dklen: 32,
          p: 1,
          r: 8,
        },
        mac: mac.toString('hex'),
      },
    };

    return { json: JSON.stringify(keystoreJson) };
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
  ): Promise<Record<string, string>> => {
    const keystore = JSON.parse(encryptedWallet);
    const { salt, iv } = keystore.Crypto.kdfparams;
    const ciphertext = keystore.Crypto.ciphertext;
    const mac = keystore.Crypto.mac;

    // Derive encryption key using Scrypt (Ethereum keystore standard)
    const key = scryptSync(password, Buffer.from(salt, 'hex'), 32, {
      N: 131072,
      r: 8,
      p: 1,
    });

    // Verify MAC (HMAC of encrypted data) to ensure data integrity
    const computedMac = createHmac('sha256', key.slice(16))
      .update(Buffer.from(ciphertext, 'hex'))
      .digest('hex');

    if (computedMac !== mac) {
      throw new Error('Invalid password or corrupted keystore');
    }

    // Decrypt private key using AES-128-CTR
    const decipher = createDecipheriv(
      'aes-128-ctr',
      key.slice(0, 16),
      Buffer.from(iv, 'hex'),
    );
    const decryptedPrivateKey = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'hex')),
      decipher.final(),
    ]);

    return {
      privateKey: '0x' + decryptedPrivateKey.toString('hex'), // Convert to Ethereum format
      address: '0x' + keystore.address, // Return the original address
    };
  };

  getEthBalance = async (address: string): Promise<Record<string, number>> => {
    const balance = await multichainWallet.getBalance({
      address,
      network: 'ethereum',
      rpcUrl: `${RPC_URL}`,
    });
    return balance;
  };

  getSolBalance = async (address: string): Promise<Record<string, number>> => {
    const balance = await multichainWallet.getBalance({
      address,
      network: 'solana',
      rpcUrl: `${RPC_URL}`,
    });
    return balance;
  };

  getERC20Balance = async (
    address: string,
    tokenAddress: string,
  ): Promise<Record<string, number>> => {
    const balance = await multichainWallet.getBalance({
      address,
      network: 'ethereum',
      rpcUrl: `${RPC_URL}`,
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
      rpcUrl: `${RPC_URL}`,
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
