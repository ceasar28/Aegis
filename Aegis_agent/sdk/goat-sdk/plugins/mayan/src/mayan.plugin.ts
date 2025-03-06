import { type Chain, PluginBase } from '@goat-sdk/core';
import type { EVMWalletClient } from '@goat-sdk/wallet-evm';
import { mantle } from 'viem/chains';
import { MoeService } from './mayan.service';

const SUPPORTED_CHAINS = [mantle];

export class MoePlugin extends PluginBase<EVMWalletClient> {
  constructor() {
    super('agni', [new MoeService()]);
  }

  supportsChain = (chain: Chain) =>
    chain.type === 'evm' && SUPPORTED_CHAINS.some((c) => c.id === chain.id);
}

export const moe = () => new MoePlugin();
