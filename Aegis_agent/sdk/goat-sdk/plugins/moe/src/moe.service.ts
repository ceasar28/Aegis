/* eslint-disable @typescript-eslint/no-unused-vars */
import { Tool } from '@goat-sdk/core';
import { EVMWalletClient } from '@goat-sdk/wallet-evm';
import { parseAbi } from 'viem';
import { ERC20_ABI } from './abi/erc20';

import {
  ExactInputSingleParams,
  GetSwapRouterAddressParams,
} from './parameters';

const MOE_ROUTER = `0xeaee7ee68874218c3558b40063c42b82d3e7232a`;
const WRAPPED_MNT_ADDRESS = '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8';
const MNT_ADDRESS = '0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000';

export class MoeService {
  @Tool({
    name: 'moe_get_swap_router_address',
    description: 'Get the address of the swap router',
  })
  async getSwapRouterAddress(parameters: GetSwapRouterAddressParams) {
    return MOE_ROUTER;
  }

  @Tool({
    name: 'moe_swap_exact_input_single_hop',
    description:
      "Swap an exact amount of input tokens for an output token in a single hop. Have the token amounts in their base units. Don't need to approve the swap router for the output token. User will have sufficient balance of the input token. The swap router address is already provided in the function. Returns a transaction hash on success. Once you get a transaction hash, the swap is complete - do not call this function again.",
  })
  async swapExactInputSingleHop(
    walletClient: EVMWalletClient,
    parameters: ExactInputSingleParams,
  ) {
    try {
      let tokenAddressIn = parameters.tokenInAddress;
      let tokenAddressOut = parameters.tokenOutAddress;

      if (tokenAddressIn.toLowerCase() === MNT_ADDRESS.toLowerCase()) {
        console.log('Wrapping MNT to wMNT...');

        const wrapTx = await walletClient.sendTransaction({
          to: WRAPPED_MNT_ADDRESS,
          value: BigInt(parameters.amountIn), // Amount of MNT to wrap
        });

        console.log(`✅ Wrapped MNT, Tx: ${wrapTx.hash}`);

        tokenAddressIn = WRAPPED_MNT_ADDRESS;
      } else if (tokenAddressOut.toLowerCase() === MNT_ADDRESS.toLowerCase()) {
        tokenAddressOut = WRAPPED_MNT_ADDRESS;
      }
      console.log(' amount to spend   :', parameters.amountIn);
      const approvalHash = await walletClient.sendTransaction({
        to: tokenAddressIn as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [MOE_ROUTER, Number(parameters.amountIn)],
      });
      console.log('approval hash  :', approvalHash.hash);
      if (approvalHash.hash) {
        const timestamp = Math.floor(Date.now() / 1000) + 60 * 20;
        const path = [
          tokenAddressIn.toLowerCase(),
          tokenAddressOut.toLowerCase(),
        ];

        const hash = await walletClient.sendTransaction({
          to: MOE_ROUTER,
          abi: parseAbi([
            'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)',
          ]),
          functionName: 'swapExactTokensForTokens',
          args: [
            Number(parameters.amountIn),
            Number(parameters.amountOutMinimum),
            path,
            walletClient.getAddress(),
            timestamp,
          ],
        });

        console.log(hash);
        const tokenBalance = await walletClient.read({
          address: WRAPPED_MNT_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [walletClient.getAddress()],
        });

        console.log('🔹 ERC-20 Token Balance:', tokenBalance.value.toString());
        if (Number(tokenBalance.value) > 0) {
          console.log('Unwrapping wMNT to MNT...');

          const unwrapTx = await walletClient.sendTransaction({
            to: WRAPPED_MNT_ADDRESS,
            abi: parseAbi(['function withdraw(uint256 amount) public']),
            functionName: 'withdraw',
            args: [Number(tokenBalance.value)], // Amount of wMNT to unwrap
          });

          console.log(`✅ Unwrapped wMNT to MNT, Tx: ${unwrapTx.hash}`);
        }

        return hash.hash;
      }
    } catch (error) {
      throw Error(`Failed to swap exact input single hop: ${error}`);
    }
  }
}
