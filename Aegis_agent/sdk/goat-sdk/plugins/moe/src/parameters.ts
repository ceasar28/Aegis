import { createToolParameters } from '@goat-sdk/core';
import { z } from 'zod';

export class GetSwapRouterAddressParams extends createToolParameters(
  z.object({}),
) {}

export class ExactInputSingleParams extends createToolParameters(
  z.object({
    tokenInAddress: z.string().describe('The address of the token to swap in'),
    tokenOutAddress: z
      .string()
      .describe('The address of the token to swap out'),
    fee: z.number().describe('Fee for the swap'),
    deadline: z
      .number()
      .optional()
      .default(60 * 60 * 24)
      .describe('The deadline for the swap in seconds from now'),
    recipient: z.string().describe('Address to receive the output tokens'),
    amountIn: z
      .string()
      .describe('The amount of tokens to swap in in base units'),
    amountOutMinimum: z
      .string()
      .default('0')
      .describe('The minimum amount of tokens to receive in base units'),
    sqrtPriceLimitX96: z
      .string()
      .default('0')
      .describe('The limit price for the swap'),
  }),
) {}
