import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { HttpService } from '@nestjs/axios';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../database/schemas/user.schema';
import {
  allFeaturesMarkup,
  displayPrivateKeyMarkup,
  exportWalletWarningMarkup,
  resetWalletWarningMarkup,
  showBalanceMarkup,
  showPortfolioMarkup,
  walletDetailsMarkup,
  walletFeaturesMarkup,
  welcomeMessageMarkup,
} from './markups';
import { WalletService } from 'src/wallet/wallet.service';
import { Session, SessionDocument } from 'src/database/schemas/session.schema';
import { AegisAgentService } from 'src/aegis-agent/aegis-agent.service';
import { Cron } from '@nestjs/schedule';
import { fetchAllTokenList } from '@mayanfinance/swap-sdk';

const token = process.env.TELEGRAM_TOKEN;

@Injectable()
export class AegisBotService {
  private readonly aegisAgentbot: TelegramBot;
  private logger = new Logger(AegisBotService.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly aegisAgentService: AegisAgentService,
    private readonly httpService: HttpService,
    @InjectModel(User.name) private readonly UserModel: Model<User>,
    @InjectModel(Session.name) private readonly SessionModel: Model<Session>,
  ) {
    this.aegisAgentbot = new TelegramBot(token, { polling: true });
    this.aegisAgentbot.on('message', this.handleRecievedMessages);
    this.aegisAgentbot.on('callback_query', this.handleButtonCommands);
  }

  handleRecievedMessages = async (msg: any) => {
    this.logger.debug(msg);
    try {
      await this.aegisAgentbot.sendChatAction(msg.chat.id, 'typing');

      const [user, session] = await Promise.all([
        this.UserModel.findOne({ chatId: msg.chat.id }),
        this.SessionModel.findOne({ chatId: msg.chat.id }),
      ]);

      const regex2 = /^0x[a-fA-F0-9]{40}$/;
      const regex = /^Swap (?:also )?(\d+\.?\d*) (\w+) (?:to|for) (\w+)$/i;

      const swapRegex = /\b(swap)\b/i;
      const match = msg.text.trim().match(regex);
      const match2 = msg.text.trim().match(regex2);
      if ((swapRegex.test(msg.text.trim()) || match || match2) && !session) {
        console.log(msg.text.trim());
        return this.handleAgentprompts(user, msg.text.trim());
      }

      // Handle text inputs if not a command
      if (
        msg.text !== '/start' &&
        msg.text !== '/menu' &&
        msg.text !== '/balance' &&
        session
      ) {
        return this.handleUserTextInputs(msg, session!);
      } else if (
        msg.text !== '/start' &&
        msg.text !== '/menu' &&
        msg.text !== '/balance' &&
        !session
      ) {
        return this.handleAgentprompts(user, msg.text.trim());
      }
      const command = msg.text!;
      console.log('Command :', command);

      if (command === '/start') {
        console.log('User   ', user);
        const username = msg.from.username;
        if (!user) {
          let uniquecode: string;
          let codeExist: any;
          //loop through to make sure the code does not alread exist
          do {
            uniquecode = await this.generateUniqueAlphanumeric();
            codeExist = await this.UserModel.findOne({
              linkCode: uniquecode,
            });
          } while (codeExist);
          await this.UserModel.create({
            chatId: msg.chat.id,
            userName: username,
            linkCode: uniquecode,
          });
        }

        const welcome = await welcomeMessageMarkup(username);
        if (welcome) {
          const replyMarkup = { inline_keyboard: welcome.keyboard };
          await this.aegisAgentbot.sendMessage(msg.chat.id, welcome.message, {
            reply_markup: replyMarkup,
            parse_mode: 'HTML',
          });
        }
        return;
      }

      // Handle /menu command
      if (command === '/menu') {
        const allFeatures = await allFeaturesMarkup(user);
        if (allFeatures) {
          const replyMarkup = { inline_keyboard: allFeatures.keyboard };
          await this.aegisAgentbot.sendMessage(
            msg.chat.id,
            allFeatures.message,
            {
              parse_mode: 'HTML',
              reply_markup: replyMarkup,
            },
          );
        }
      }
      if (command === '/balance') {
        await this.showBalance(msg.chat.id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  //handler for users inputs
  handleUserTextInputs = async (
    msg: TelegramBot.Message,
    session?: SessionDocument,
    // user?: UserDocument,
  ) => {
    await this.aegisAgentbot.sendChatAction(msg.chat.id, 'typing');
    try {
      const regex2 = /^0x[a-fA-F0-9]{40}$/;
      const regex = /^Swap (?:also )?(\d+\.?\d*) (\w+) (?:to|for) (\w+)$/i;
      const swapRegex = /\b(swap)\b/i;
      const match = msg.text.trim().match(regex);
      const match2 = msg.text.trim().match(regex2);
      console.log(msg.text.trim());

      if (swapRegex.test(msg.text.trim())) {
        const user = await this.UserModel.findOne({ chatId: msg.chat.id });
        await this.aegisAgentbot.sendChatAction(user.chatId, 'typing');
        const encryptedEvmWallet = await this.walletService.decryptEvmWallet(
          `${process.env.DEFAULT_WALLET_PIN}`,
          user.evmWalletDetails,
        );
        const encryptedSolanaWallet =
          await this.walletService.decryptSolanaWallet(
            `${process.env.DEFAULT_WALLET_PIN}`,
            user.solanaWalletDetails,
          );

        if (encryptedEvmWallet.privateKey || encryptedSolanaWallet.privateKey) {
          const response = await this.aegisAgentService.crossSwapToken(
            {
              evm: encryptedEvmWallet.privateKey,
              solana: encryptedSolanaWallet.privateKey,
            },
            msg.text.trim(),
          );
          console.log('response :', response);
          if (response) {
            await this.aegisAgentbot.sendMessage(
              user.chatId,
              `Transaction Successful\n${response}`,
            );
          } else {
            await this.aegisAgentbot.sendMessage(
              user.chatId,
              'Error performing transaction, try again',
            );
          }
        }
      }
      if (match) {
        const user = await this.UserModel.findOne({ chatId: msg.chat.id });
        await this.aegisAgentbot.sendChatAction(user.chatId, 'typing');
        const encryptedWallet = await this.walletService.decryptEvmWallet(
          `${process.env.DEFAULT_WALLET_PIN}`,
          user.evmWalletDetails,
        );
        console.log(encryptedWallet);
        if (encryptedWallet.privateKey) {
          const response = await this.aegisAgentService.swapToken(
            encryptedWallet.privateKey,
            msg.text.trim(),
          );
          if (response) {
            const regex = /0x[a-fA-F0-9]{64}/g;
            const matches = response.match(regex);
            return await this.aegisAgentbot.sendMessage(
              user.chatId,
              `${response}.\n${matches[0] ? `View on mantlescan [${matches[0]}](https://mantlescan.xyz/tx/${matches[0]})` : ''}`,
              {
                parse_mode: 'Markdown',
              },
            );
          }
        }
      }
      if (session.tokenInsight && match2) {
        console.log('here');
        const tokenInsight = await this.aegisAgentService.analyzeToken(
          msg.text.trim(),
        );
        if (tokenInsight.insight) {
          await this.aegisAgentbot.sendMessage(
            msg.chat.id,
            `${tokenInsight.insight}`,
            { parse_mode: 'Markdown' },
          );
          await this.SessionModel.deleteMany({ chatId: msg.chat.id });
          return;
        }
      }

      if (session.allocationSetting) {
        const Allocation = await this.validateAllocations(
          msg.text!.trim(),
          msg.chat.id,
        );

        console.log(Allocation);
        if (Allocation) {
          await this.UserModel.updateOne(
            { chatId: msg.chat.id },
            { $set: { targetAllocations: Allocation } },
            { upsert: true },
          );
        }

        // Convert to string (comma-separated)
        const allocationString = Object.entries(Allocation)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        await this.SessionModel.deleteMany({ chatId: msg.chat.id });
        await this.aegisAgentbot.sendMessage(
          msg.chat.id,
          `Allocation succesfully set\n-${allocationString}`,
        );
      }

      if (session.thresholdSetting) {
        const threshold = await this.validateThresholds(
          msg.text!.trim(),
          msg.chat.id,
        );
        if (threshold.upperThreshold && threshold.lowerThreshold) {
          await this.UserModel.updateOne(
            { chatId: msg.chat.id },
            {
              upperThreshold: threshold.upperThreshold,
              lowerThreshold: threshold.lowerThreshold,
            },
          );
        }
        await this.SessionModel.deleteMany({ chatId: msg.chat.id });
        await this.aegisAgentbot.sendMessage(
          msg.chat.id,
          `Threshold succesfully set\n- Upper :${threshold.upperThreshold}%\n- Lower : ${threshold.lowerThreshold} %`,
        );
      }

      if (session) {
        // update users answerId
        await this.SessionModel.updateOne(
          { _id: session._id },
          { $push: { userInputId: msg.message_id } },
        );
      }

      // parse incoming message and handle commands
      try {
        //handle import wallet private key
        if (
          session &&
          session.importWallet &&
          session.importWalletPromptInput
        ) {
          await this.aegisAgentbot.sendChatAction(msg.chat.id, 'typing');
          const IsValid = await this.isPrivateKey(
            msg.text!.trim(),
            msg.chat.id,
          );
          if (IsValid.isValid) {
            const privateKey = msg.text!.trim();
            console.log(privateKey);
            if (IsValid.walletType === 'evm') {
              const importedWallet =
                this.walletService.getEvmAddressFromPrivateKey(`${privateKey}`);
              console.log(importedWallet);

              // encrypt wallet details with  default
              const encryptedWalletDetails =
                await this.walletService.encryptEvmWallet(
                  process.env.DEFAULT_WALLET_PIN!,
                  privateKey,
                );

              const updatedUser = await this.UserModel.findOneAndUpdate(
                { chatId: msg.chat.id },
                {
                  evmWalletDetails: encryptedWalletDetails.json,
                  evmWalletAddress: importedWallet.address,
                },
                { new: true }, // This ensures the updated document is returned
              );

              const promises: any[] = [];
              const latestSession = await this.SessionModel.findOne({
                chatId: msg.chat.id,
              });
              // loop through  import privateKey prompt to delete them
              for (
                let i = 0;
                i < latestSession!.importWalletPromptInputId.length;
                i++
              ) {
                promises.push(
                  await this.aegisAgentbot.deleteMessage(
                    msg.chat.id,
                    latestSession!.importWalletPromptInputId[i],
                  ),
                );
              }
              // loop through to delete all userReply
              for (let i = 0; i < latestSession!.userInputId.length; i++) {
                promises.push(
                  await this.aegisAgentbot.deleteMessage(
                    msg.chat.id,
                    latestSession!.userInputId[i],
                  ),
                );
              }

              await this.sendWalletDetails(msg.chat.id, updatedUser);
            } else if (IsValid.walletType === 'solana') {
              const importedWallet =
                this.walletService.getSolanaAddressFromPrivateKey(
                  `${privateKey}`,
                );
              console.log(importedWallet);

              // encrypt wallet details with  default
              const encryptedWalletDetails =
                await this.walletService.encryptSolanaWallet(
                  process.env.DEFAULT_WALLET_PIN!,
                  privateKey,
                );

              const updatedUser = await this.UserModel.findOneAndUpdate(
                { chatId: msg.chat.id },
                {
                  solanaWalletDetails: encryptedWalletDetails.json,
                  solanaWalletAddress: importedWallet.address,
                },
                { new: true }, // This ensures the updated document is returned
              );

              const promises: any[] = [];
              const latestSession = await this.SessionModel.findOne({
                chatId: msg.chat.id,
              });
              // loop through  import privateKey prompt to delete them
              for (
                let i = 0;
                i < latestSession!.importWalletPromptInputId.length;
                i++
              ) {
                promises.push(
                  await this.aegisAgentbot.deleteMessage(
                    msg.chat.id,
                    latestSession!.importWalletPromptInputId[i],
                  ),
                );
              }
              // loop through to delete all userReply
              for (let i = 0; i < latestSession!.userInputId.length; i++) {
                promises.push(
                  await this.aegisAgentbot.deleteMessage(
                    msg.chat.id,
                    latestSession!.userInputId[i],
                  ),
                );
              }

              await this.sendWalletDetails(msg.chat.id, updatedUser);
            }
          }
          return;
        }
      } catch (error) {
        console.error(error);

        return await this.aegisAgentbot.sendMessage(
          msg.chat.id,
          `Processing command failed, please try again`,
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  //handler for users inputs
  handleAgentprompts = async (user: UserDocument, msg: string) => {
    console.log('here');
    console.log(msg);
    await this.aegisAgentbot.sendChatAction(user.chatId, 'typing');
    try {
      const regex2 = /^0x[a-fA-F0-9]{64}$/;
      const regex = /^Swap (?:also )?(\d+\.?\d*) (\w+) (?:to|for) (\w+)$/i;
      const swapRegex = /\b(swap)\b/i;
      const match = msg.trim().match(regex);
      const match2 = msg.trim().match(regex2);
      if (swapRegex.test(msg.trim())) {
        await this.aegisAgentbot.sendChatAction(user.chatId, 'typing');
        const encryptedEvmWallet = await this.walletService.decryptEvmWallet(
          `${process.env.DEFAULT_WALLET_PIN}`,
          user.evmWalletDetails,
        );
        const encryptedSolanaWallet =
          await this.walletService.decryptSolanaWallet(
            `${process.env.DEFAULT_WALLET_PIN}`,
            user.solanaWalletDetails,
          );

        if (encryptedEvmWallet.privateKey || encryptedSolanaWallet.privateKey) {
          const response = await this.aegisAgentService.crossSwapToken(
            {
              evm: encryptedEvmWallet.privateKey,
              solana: encryptedSolanaWallet.privateKey,
            },
            msg,
          );
          console.log('response :', response);
          if (response) {
            await this.aegisAgentbot.sendMessage(
              user.chatId,
              `Transaction Successful\n${response}`,
            );
          } else {
            await this.aegisAgentbot.sendMessage(
              user.chatId,
              'Error performing transaction, try again',
            );
          }
        }
      } else if (match) {
        await this.aegisAgentbot.sendChatAction(user.chatId, 'typing');
        const encryptedWallet = await this.walletService.decryptEvmWallet(
          `${process.env.DEFAULT_WALLET_PIN}`,
          user.evmWalletDetails,
        );
        console.log(encryptedWallet);
        if (encryptedWallet.privateKey) {
          const response = await this.aegisAgentService.swapToken(
            encryptedWallet.privateKey,
            msg,
          );
          if (response) {
            const regex = /0x[a-fA-F0-9]{64}/g;
            const matches = response.match(regex);
            return await this.aegisAgentbot.sendMessage(
              user.chatId,
              `${response}.\n${matches[0] ? `View on mantlescan [${matches[0]}](https://mantlescan.xyz/tx/${matches[0]})` : ''}`,
              {
                parse_mode: 'Markdown',
              },
            );
          }
        }
      } else if (match2) {
        const tokenInsight = await this.aegisAgentService.analyzeToken(
          msg.trim(),
        );
        if (tokenInsight.insight) {
          await this.aegisAgentbot.sendMessage(
            user.chatId,
            `${tokenInsight.insight}`,
            { parse_mode: 'Markdown' },
          );
          await this.SessionModel.deleteMany({ chatId: user.chatId });
          return;
        }
      } else if (!match2 && !match) {
        const response = await this.aegisAgentService.agentChat(msg);
        if (response.response) {
          return await this.aegisAgentbot.sendMessage(
            user.chatId,
            response.response,
            {
              parse_mode: 'Markdown',
            },
          );
        }
        return;
      }
    } catch (error) {
      console.log(error);
    }
  };

  promptAgentToRebalance = async (user: UserDocument, msg: string) => {
    console.log('rebalancing');
    console.log(msg);
    await this.aegisAgentbot.sendChatAction(user.chatId, 'typing');
    try {
      const encryptedEvmWallet = await this.walletService.decryptEvmWallet(
        `${process.env.DEFAULT_WALLET_PIN}`,
        user.evmWalletDetails,
      );

      const encryptedSolanaWallet = await this.walletService.decryptEvmWallet(
        `${process.env.DEFAULT_WALLET_PIN}`,
        user.solanaWalletDetails,
      );

      if (encryptedEvmWallet.privateKey || encryptedSolanaWallet.privateKey) {
        // const response = await this.aegisAgentService.swapToken(
        //   encryptedWallet.privateKey,
        //   msg,
        // );

        const response = await this.aegisAgentService.crossSwapToken(
          {
            evm: encryptedEvmWallet.privateKey,
            solana: encryptedSolanaWallet.privateKey,
          },
          msg,
        );
        if (response) {
          // const regex = /0x[a-fA-F0-9]{64}/g;
          // const matches = response.match(regex);
          return await this.aegisAgentbot.sendMessage(
            user.chatId,
            `🔔Rebalance Alert🔔\n\n${msg} was successful}`,
            {
              parse_mode: 'Markdown',
            },
          );
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  handleButtonCommands = async (query: any) => {
    this.logger.debug(query);
    let command: string;

    function isJSON(str) {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        console.log(e);
        return false;
      }
    }

    if (isJSON(query.data)) {
      command = JSON.parse(query.data).command;
    } else {
      command = query.data;
    }

    const chatId = query.message.chat.id;

    try {
      await this.aegisAgentbot.sendChatAction(chatId, 'typing');
      const user = await this.UserModel.findOne({ chatId: chatId });
      let session: SessionDocument;
      switch (command) {
        case '/menu':
          await this.sendAllFeature(user);
          return;

        case '/walletFeatures':
          await this.sendAllWalletFeature(chatId);
          return;

        case '/enableRebalance':
          if (user && !user.rebalanceEnabled) {
            await this.UserModel.updateOne(
              { chatId },
              { rebalanceEnabled: true },
            );
            return this.aegisAgentbot.sendMessage(
              chatId,
              ` Rebalancing Enabled`,
            );
          } else if (user && user.rebalanceEnabled) {
            await this.UserModel.updateOne(
              { chatId },
              { rebalanceEnabled: false },
            );
            return this.aegisAgentbot.sendMessage(
              chatId,
              ` Rebalancing Disabled`,
            );
          }
          return;

        case '/disableAgenticSwap':
          if (user && user.enableAgenticAutoSwap) {
            await this.UserModel.updateOne(
              { chatId },
              { enableAgenticAutoSwap: false },
            );
            return this.aegisAgentbot.sendMessage(
              chatId,
              `Agentic auto swap mode disabled`,
            );
          } else if (user && !user.enableAgenticAutoSwap) {
            await this.UserModel.updateOne(
              { chatId },
              { enableAgenticAutoSwap: true },
            );
            return this.aegisAgentbot.sendMessage(
              chatId,
              `Agentic auto swap mode enabled`,
            );
          }
          return;

        case '/createWallet':
          // check if user already have a wallet
          if (user!.evmWalletAddress || user!.solanaWalletAddress) {
            return this.sendWalletDetails(chatId, user);
          }
          const newEvmWallet = await this.walletService.createEvmWallet();
          const newSolanaWallet = await this.walletService.createSolanaWallet();
          const [encryptedEvmWalletDetails, encryptedSolanaWalletDetails] =
            await Promise.all([
              this.walletService.encryptEvmWallet(
                process.env.DEFAULT_WALLET_PIN!,
                newEvmWallet.privateKey,
              ),
              this.walletService.encryptSolanaWallet(
                process.env.DEFAULT_WALLET_PIN!,
                newSolanaWallet.privateKey,
              ),
            ]);

          // Save user wallet details
          const updatedUser = await this.UserModel.findOneAndUpdate(
            { chatId: chatId },
            {
              evmWalletDetails: encryptedEvmWalletDetails.json,
              evmWalletAddress: newEvmWallet.address,
              solanaWalletDetails: encryptedSolanaWalletDetails.json,
              solanaWalletAddress: newSolanaWallet.address,
            },
            { new: true }, // This ensures the updated document is returned
          );
          // Send wallet details to the user
          return await this.sendWalletDetails(chatId, updatedUser);

        case '/linkWallet':
          // check if user already have a wallet
          if (user!.evmWalletAddress && user!.solanaWalletAddress) {
            await this.aegisAgentbot.sendMessage(
              query.message.chat.id,
              `‼️ You already have an EVM and Solana wallet\n\nto link a new, make sure to export and secure you old wallets and then click on the reset wallet button`,
            );
            return this.sendWalletDetails(chatId, user);
          }
          // delete any existing session if any
          await this.SessionModel.deleteMany({ chatId: chatId });
          // create a new session
          session = await this.SessionModel.create({
            chatId: chatId,
            importWallet: true,
          });
          if (session) {
            await this.promptWalletPrivateKEY(chatId);
            return;
          }
          return await this.aegisAgentbot.sendMessage(
            query.message.chat.id,
            `Processing command failed, please try again`,
          );

        case '/fundWallet':
          if (user?.evmWalletAddress || user?.solanaWalletAddress) {
            let message = 'Your Address:\n';

            if (user?.evmWalletAddress) {
              message += `<b><code>${user.evmWalletAddress}</code></b> (EVM Wallet)\n\n`;
            }

            if (user?.solanaWalletAddress) {
              message += `<b><code>${user.solanaWalletAddress}</code></b> (Solana Wallet)\n\n`;
            }

            message += 'Send tokens to your address above.';

            return await this.aegisAgentbot.sendMessage(chatId, message, {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: 'Close ❌',
                      callback_data: JSON.stringify({
                        command: '/close',
                        language: 'english',
                      }),
                    },
                  ],
                ],
              },
            });
          }
          return await this.aegisAgentbot.sendMessage(
            chatId,
            'You dont have any wallet Address to fund',
          );

        case '/checkBalance':
          return this.showBalance(chatId);

        case '/portfolioOverview':
          return this.showUserPortfolio(user);

        case '/exportWallet':
          if (!user!.evmWalletDetails && !user!.solanaWalletAddress) {
            return this.aegisAgentbot.sendMessage(
              chatId,
              `You Don't have a wallet`,
            );
          }
          return this.showExportWalletWarning(chatId);

        case '/confirmExportWallet':
          // delete any existing session if any
          await this.SessionModel.deleteMany({ chatId: chatId });
          // create a new session
          session = await this.SessionModel.create({
            chatId: chatId,
            exportWallet: true,
          });
          if (
            session &&
            (user!.evmWalletDetails || user!.solanaWalletDetails)
          ) {
            let decryptedEvmWallet;
            let decryptedSolanaWallet;
            if (user!.evmWalletDetails) {
              decryptedEvmWallet = await this.walletService.decryptEvmWallet(
                process.env.DEFAULT_WALLET_PIN!,
                user!.evmWalletDetails,
              );
            }
            if (user!.solanaWalletDetails) {
              decryptedSolanaWallet =
                await this.walletService.decryptSolanaWallet(
                  process.env.DEFAULT_WALLET_PIN!,
                  user!.solanaWalletDetails,
                );
            }

            if (
              decryptedEvmWallet.privateKey ||
              decryptedSolanaWallet.privateKey
            ) {
              const latestSession = await this.SessionModel.findOne({
                chatId: chatId,
              });
              const deleteMessagesPromises = [
                ...latestSession!.userInputId.map((id) =>
                  this.aegisAgentbot.deleteMessage(chatId, id),
                ),
              ];

              // Execute all deletions concurrently
              await Promise.all(deleteMessagesPromises);

              // Display the decrypted private key to the user
              await this.displayWalletPrivateKey(
                chatId,
                decryptedEvmWallet.privateKey || '',
                decryptedSolanaWallet.privateKey || '',
              );

              return;
            }

            // Delete the session after operations
            await this.SessionModel.deleteMany({ chatId: chatId });
          }
          return await this.aegisAgentbot.sendMessage(
            query.message.chat.id,
            `Processing command failed, please try again`,
          );

        case '/resetWallet':
          return this.showResetWalletWarning(chatId);

        case '/confirmReset':
          // delete any existing session if any
          await this.SessionModel.deleteMany({ chatId: chatId });
          // create a new session
          session = await this.SessionModel.create({
            chatId: chatId,
            resetWallet: true,
          });
          if (session) {
            try {
              await this.aegisAgentbot.sendChatAction(chatId, 'typing');
              if (!user) {
                return await this.aegisAgentbot.sendMessage(
                  chatId,
                  'User not found. Please try again.',
                );
              }

              await this.UserModel.updateOne(
                { chatId: chatId },
                {
                  $unset: {
                    walletAddress: '',
                    walletDetails: '',
                    privateKey: '',
                  },
                },
              );

              await this.aegisAgentbot.sendMessage(
                chatId,
                'Wallet deleted successfully, you can now create or import a new wallet',
              );
              await this.SessionModel.deleteMany();
              return;
            } catch (error) {
              console.log(error);
            }
          }
          return await this.aegisAgentbot.sendMessage(
            query.message.chat.id,
            `Processing command failed, please try again`,
          );

        case '/tokenInsight':
          await this.SessionModel.deleteMany({ chatId: chatId });
          session = await this.SessionModel.create({
            chatId: chatId,
            tokenInsight: true,
          });
          if (session) {
            await this.promptTokenAddress(chatId);
            return;
          }
          return await this.aegisAgentbot.sendMessage(
            query.message.chat.id,
            `Processing command failed, please try again`,
          );

        case '/setTargetAllocation':
          await this.aegisAgentbot.sendChatAction(chatId, 'typing');
          return await this.setTargetAllocation(chatId);

        case '/setThreshold':
          await this.aegisAgentbot.sendChatAction(chatId, 'typing');
          return await this.setThreshold(chatId);

        //   close opened markup and delete session
        case '/closeDelete':
          await this.aegisAgentbot.sendChatAction(
            query.message.chat.id,
            'typing',
          );
          await this.SessionModel.deleteMany({
            chatId: chatId,
          });
          return await this.aegisAgentbot.deleteMessage(
            query.message.chat.id,
            query.message.message_id,
          );

        case '/close':
          await this.aegisAgentbot.sendChatAction(
            query.message.chat.id,
            'typing',
          );
          return await this.aegisAgentbot.deleteMessage(
            query.message.chat.id,
            query.message.message_id,
          );

        default:
          return await this.aegisAgentbot.sendMessage(
            query.message.chat.id,
            `Processing command failed, please try again`,
          );
      }
    } catch (error) {
      console.log(error);
    }
  };

  sendAllFeature = async (user: UserDocument) => {
    try {
      await this.aegisAgentbot.sendChatAction(user.chatId, 'typing');
      const allFeatures = await allFeaturesMarkup(user);
      if (allFeatures) {
        const replyMarkup = {
          inline_keyboard: allFeatures.keyboard,
        };
        await this.aegisAgentbot.sendMessage(user.chatId, allFeatures.message, {
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        });
      }
    } catch (error) {
      console.log(error);
    }
  };

  sendAllWalletFeature = async (chatId: any) => {
    try {
      await this.aegisAgentbot.sendChatAction(chatId, 'typing');
      const allWalletFeatures = await walletFeaturesMarkup();
      if (allWalletFeatures) {
        const replyMarkup = {
          inline_keyboard: allWalletFeatures.keyboard,
        };
        await this.aegisAgentbot.sendMessage(
          chatId,
          allWalletFeatures.message,
          {
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          },
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  sendWalletDetails = async (
    ChatId: TelegramBot.ChatId,
    user: UserDocument,
  ) => {
    await this.aegisAgentbot.sendChatAction(ChatId, 'typing');
    try {
      const walletDetails = await walletDetailsMarkup(
        user.evmWalletAddress,
        user.solanaWalletAddress,
      );
      if (walletDetailsMarkup!) {
        const replyMarkup = {
          inline_keyboard: walletDetails.keyboard,
        };

        return await this.aegisAgentbot.sendMessage(
          ChatId,
          walletDetails.message,
          {
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          },
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  promptWalletPrivateKEY = async (chatId: TelegramBot.ChatId) => {
    try {
      await this.aegisAgentbot.sendChatAction(chatId, 'typing');
      const privateKeyPromptId = await this.aegisAgentbot.sendMessage(
        chatId,
        `Please enter wallet's private key`,
        {
          reply_markup: {
            force_reply: true,
          },
        },
      );
      if (privateKeyPromptId) {
        await this.SessionModel.updateOne(
          { chatId: chatId },
          {
            importWalletPromptInput: true,
            $push: { importWalletPromptInputId: privateKeyPromptId.message_id },
          },
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  showBalance = async (chatId: TelegramBot.ChatId, showMarkUp = true) => {
    try {
      await this.aegisAgentbot.sendChatAction(chatId, 'typing');
      const user = await this.UserModel.findOne({ chatId: chatId });
      if (!user?.evmWalletAddress || !user?.solanaWalletAddress) {
        return this.aegisAgentbot.sendMessage(
          chatId,
          `You don't have any wallet connected`,
        );
      }

      const allTokens = await fetchAllTokenList(['native', 'erc20', 'spl']);
      const tokenArrays = {};

      // Helper function to process tokens for a network
      const processTokens = async (
        network: string,
        tokens: any[],
        rpc?: string,
      ) => {
        try {
          return (
            await Promise.all(
              tokens.map(async (token) => {
                try {
                  if (
                    token.mint ===
                      'So11111111111111111111111111111111111111112' ||
                    token.contract ===
                      '0x0000000000000000000000000000000000000000'
                  ) {
                    const { balance } =
                      network === 'solana'
                        ? await this.walletService.getSolBalance(
                            user!.solanaWalletAddress,
                          )
                        : await this.walletService.getNativeTokenBalance(
                            user!.evmWalletAddress,
                            rpc!,
                          );

                    return {
                      name: token.symbol,
                      balance,
                      network,
                      address: token.mint || token.contract,
                    };
                  } else {
                    const { balance } =
                      network === 'solana'
                        ? await this.walletService.getSPLTokenBalance(
                            user!.solanaWalletAddress,
                            token.mint,
                          )
                        : await this.walletService.getERC20Balance(
                            user!.evmWalletAddress,
                            token.contract,
                            rpc!,
                          );

                    if (balance > 0) {
                      return {
                        name: token.symbol,
                        balance,
                        network,
                        address: token.mint || token.contract,
                      };
                    }
                  }
                } catch (tokenError) {
                  console.log(
                    `Error fetching token ${token.symbol} on ${network}:`,
                    tokenError,
                  );
                  return null; // Skip this token
                }
              }),
            )
          ).filter(Boolean);
        } catch (networkError) {
          console.log(`Error processing ${network} tokens:`, networkError);
          return []; // Return empty array for this network
        }
      };

      // Process each network independently
      tokenArrays['solana'] = await processTokens(
        'solana',
        allTokens['solana'],
      );
      tokenArrays['ethereum'] = await processTokens(
        'ethereum',
        allTokens['ethereum'],
        process.env.ETHEREUM_RPC,
      );
      tokenArrays['base'] = await processTokens(
        'base',
        allTokens['base'],
        process.env.BASE_RPC,
      );
      tokenArrays['arbitrum'] = await processTokens(
        'arbitrum',
        allTokens['arbitrum'],
        process.env.ARBITRUM_RPC,
      );
      tokenArrays['optimism'] = await processTokens(
        'optimism',
        allTokens['optimism'],
        process.env.OPTIMISM_RPC,
      );
      tokenArrays['avalanche'] = await processTokens(
        'avalanche',
        allTokens['avalanche'],
        process.env.AVALANCHE_RPC,
      );
      tokenArrays['polygon'] = await processTokens(
        'polygon',
        allTokens['polygon'],
        process.env.POLYGON_RPC,
      );

      const allTokenBalance = [
        ...tokenArrays['ethereum'],
        ...tokenArrays['solana'],
        ...tokenArrays['base'],
        ...tokenArrays['arbitrum'],
        ...tokenArrays['optimism'],
        ...tokenArrays['avalanche'],
        ...tokenArrays['polygon'],
      ];

      if (showMarkUp) {
        const showBalance = await showBalanceMarkup(allTokenBalance);
        if (showBalance) {
          const replyMarkup = { inline_keyboard: showBalance.keyboard };

          return await this.aegisAgentbot.sendMessage(
            chatId,
            showBalance.message,
            {
              parse_mode: 'HTML',
              reply_markup: replyMarkup,
            },
          );
        }
      } else {
        return allTokenBalance;
      }
    } catch (error) {
      console.log('General error in showBalance:', error);
    }
  };

  showExportWalletWarning = async (chatId: TelegramBot.ChatId) => {
    try {
      await this.aegisAgentbot.sendChatAction(chatId, 'typing');
      const showExportWarning = await exportWalletWarningMarkup();
      if (showExportWarning) {
        const replyMarkup = { inline_keyboard: showExportWarning.keyboard };

        return await this.aegisAgentbot.sendMessage(
          chatId,
          showExportWarning.message,
          {
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          },
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  showUserPortfolio = async (user: UserDocument) => {
    try {
      await this.aegisAgentbot.sendChatAction(user.chatId, 'typing');
      const userPortfolio = await this.getPortfolio(user.linkCode);
      console.log(userPortfolio);
      const showPortfolio = await showPortfolioMarkup(userPortfolio);
      if (showPortfolio) {
        const replyMarkup = { inline_keyboard: showPortfolio.keyboard };

        return await this.aegisAgentbot.sendMessage(
          user.chatId,
          showPortfolio.message,
          {
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          },
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  // utitlity functions
  isPrivateKey = async (
    input: string,
    chatId: number,
  ): Promise<{ isValid: boolean; walletType: string | null }> => {
    const latestSession = await this.SessionModel.findOne({ chatId: chatId });
    const trimmedInput = input.trim();

    // Regex for Ethereum (EVM) private key (64 hex chars starting with 0x)
    const evmPrivateKeyRegex = /^0x[a-fA-F0-9]{64}$/;

    // Regex for Solana private key (Base58 encoded, usually 44 chars)
    const solanaPrivateKeyRegex = /^[A-Za-z1-9]{32,44}$/;

    // Check if the input matches either EVM or Solana private key regex
    if (evmPrivateKeyRegex.test(trimmedInput)) {
      return { isValid: true, walletType: 'evm' };
    } else if (solanaPrivateKeyRegex.test(trimmedInput)) {
      return { isValid: true, walletType: 'solana' };
    } else if (latestSession) {
      if (latestSession!.importWallet) {
        this.aegisAgentbot.sendMessage(chatId, 'Invalid Private KEY');
      }

      const promises: any[] = [];
      // Loop through import privateKey prompt to delete them
      for (let i = 0; i < latestSession.importWalletPromptInputId.length; i++) {
        try {
          promises.push(
            await this.aegisAgentbot.deleteMessage(
              chatId,
              latestSession!.importWalletPromptInputId[i],
            ),
          );
        } catch (error) {
          console.log(error);
        }
      }

      // Loop through to delete all userReply messages
      for (let i = 0; i < latestSession.userInputId.length; i++) {
        try {
          promises.push(
            await this.aegisAgentbot.deleteMessage(
              chatId,
              latestSession.userInputId[i],
            ),
          );
        } catch (error) {
          console.log(error);
        }
      }

      return { isValid: false, walletType: null };
    }

    return { isValid: false, walletType: null };
  };

  displayWalletPrivateKey = async (
    chatId: TelegramBot.ChatId,
    privateKeyEVM: string,
    privateKeySolana: string,
  ) => {
    try {
      await this.aegisAgentbot.sendChatAction(chatId, 'typing');
      const displayPrivateKey = await displayPrivateKeyMarkup(
        privateKeyEVM,
        privateKeySolana,
      );
      if (displayPrivateKey) {
        const replyMarkup = { inline_keyboard: displayPrivateKey.keyboard };

        const sendPrivateKey = await this.aegisAgentbot.sendMessage(
          chatId,
          displayPrivateKey.message,
          {
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          },
        );
        if (sendPrivateKey) {
          // Delay the message deletion by 1 minute
          setTimeout(async () => {
            try {
              // Delete the message after 1 minute
              await this.aegisAgentbot.deleteMessage(
                chatId,
                sendPrivateKey.message_id,
              );
            } catch (error) {
              console.error('Error deleting message:', error);
            }
          }, 60000);
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  showResetWalletWarning = async (chatId: TelegramBot.ChatId) => {
    try {
      await this.aegisAgentbot.sendChatAction(chatId, 'typing');
      const showResetWarning = await resetWalletWarningMarkup();
      if (showResetWarning) {
        const replyMarkup = { inline_keyboard: showResetWarning.keyboard };

        return await this.aegisAgentbot.sendMessage(
          chatId,
          showResetWarning.message,
          {
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          },
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  //utils function
  generateUniqueAlphanumeric = async (): Promise<string> => {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    while (result.length < 8) {
      const randomChar = characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
      if (!result.includes(randomChar)) {
        result += randomChar;
      }
    }
    return result;
  };

  promptTokenAddress = async (chatId: TelegramBot.ChatId) => {
    try {
      await this.aegisAgentbot.sendChatAction(chatId, 'typing');
      const tokenPromptId = await this.aegisAgentbot.sendMessage(
        chatId,
        `Please enter the token address`,
        {
          reply_markup: {
            force_reply: true,
          },
        },
      );
      return tokenPromptId;
    } catch (error) {
      console.log(error);
    }
  };

  setTargetAllocation = async (chatId: TelegramBot.ChatId) => {
    try {
      await this.SessionModel.updateOne(
        { chatId },
        { thresholdSetting: false, allocationSetting: true },
        { upsert: true },
      );
      const promptId = await this.aegisAgentbot.sendMessage(
        chatId,
        `Input your Target  allocation %: e.g: USDC:40,TRUMP:30,BOBO:20`,
        {
          reply_markup: {
            force_reply: true,
          },
        },
      );

      return promptId;
    } catch (error) {
      console.log(error);
    }
  };

  setThreshold = async (chatId: TelegramBot.ChatId) => {
    try {
      await this.SessionModel.updateOne(
        { chatId },
        { thresholdSetting: true, allocationSetting: false },
        { upsert: true },
      );
      const promptId = await this.aegisAgentbot.sendMessage(
        chatId,
        'Input the upper and lower threshold trigger % eg: 5% 5%',
        {
          reply_markup: {
            force_reply: true,
          },
        },
      );

      return promptId;
    } catch (error) {
      console.log(error);
    }
  };

  getPortfolio = async (linkCode: string) => {
    console.log(linkCode);
    try {
      const user = await this.UserModel.findOne({ linkCode });
      if (!user?.evmWalletAddress || !user?.solanaWalletAddress) {
        return {
          message: ` you don't have a wallet connected on aegix agent bot`,
        };
      }
      type AllTokenBalanceType = {
        name: string;
        balance: number;
        network: string;
        address: string;
      }[];
      const allTokenBalance = await this.showBalance(user.chatId, false);
      console.log(allTokenBalance);
      const geckoUrl = `https://api.geckoterminal.com/api/v2/networks`;
      const urls = (allTokenBalance as AllTokenBalanceType).map(
        (token) => `${geckoUrl}/${token.network}/tokens/${token.address}`,
      );

      // Fetch data and update allTokenBalance
      const responses = await Promise.all(
        urls.map((url) =>
          fetch(url, { method: 'GET' }).then((response) => response.json()),
        ),
      );

      // Update allTokenBalance with the new fields
      const updatedTokenBalance = (allTokenBalance as AllTokenBalanceType).map(
        (token, index) => {
          const response = responses[index];
          return {
            ...token,
            price: Number(response.data?.attributes.price_usd || 0),
            value:
              Number(token.balance || 0) *
              Number(response.data?.attributes.price_usd || 0),
          };
        },
      );

      return updatedTokenBalance;
    } catch (error) {
      console.log(error);
    }
  };
  private rebalancePortfolio = async (user: UserDocument) => {
    interface Token {
      name: string;
      balance: number;
      network: string;
      address: string;
      price: number;
      value: number;
    }

    // Helper function to calculate total value
    function calculateTotalValue(tokens: Token[]) {
      return tokens.reduce((sum, token) => sum + Number(token.value || 0), 0);
    }

    // Helper function to find a stablecoin (excluding the current token)
    function findStablecoin(
      tokens: Token[],
      network: string,
      excludeTokenName: string,
    ): Token | undefined {
      return tokens.find(
        (t) =>
          (t.name === 'USDC' || t.name === 'USDT') &&
          t.network === network &&
          t.name !== excludeTokenName,
      );
    }

    try {
      const { upperThreshold, lowerThreshold } = user;
      // Convert Map to object
      const targetAllocations = Object.fromEntries(user.targetAllocations);

      // Early validation
      if (Object.keys(targetAllocations).length === 0) {
        console.log('No target allocations set, skipping rebalancing');
        return;
      }

      const userPortfolio = (await this.getPortfolio(user.linkCode)) as Token[];
      const totalPortfolioValue = calculateTotalValue(userPortfolio);

      if (totalPortfolioValue === 0) {
        console.log('Portfolio value is zero, no rebalancing needed');
        return;
      }

      // Calculate current percentages
      const currentAllocations = userPortfolio.reduce(
        (acc, token) => {
          acc[token.name] = (Number(token.value) / totalPortfolioValue) * 100;
          return acc;
        },
        {} as { [key: string]: number },
      );

      // Process each token
      for (const token of userPortfolio) {
        const targetPercentage = targetAllocations[token.name] || 0;
        const currentPercentage = currentAllocations[token.name] || 0;

        console.log(
          `Checking ${token.name}: Current ${currentPercentage.toFixed(2)}% ` +
            `vs Target ${targetPercentage}%`,
        );

        // Skip if no target allocation
        if (targetPercentage === 0) {
          console.log(`No target allocation for ${token.name}, skipping`);
          continue;
        }

        if (currentPercentage > targetPercentage + upperThreshold) {
          const excessPercentage = currentPercentage - targetPercentage;
          const valueToSell = (excessPercentage / 100) * totalPortfolioValue;
          const amountToSell = valueToSell / Number(token.price);

          // Find stablecoin, excluding the current token
          const stablecoin =
            findStablecoin(userPortfolio, token.network, token.name) ||
            findStablecoin(
              userPortfolio,
              userPortfolio[0]?.network,
              token.name,
            );

          if (!stablecoin) {
            console.log(`No suitable stablecoin found to sell ${token.name}`);
            continue;
          }

          if (stablecoin.value < valueToSell * 0.1) {
            // Check if enough stablecoin
            console.log(`Insufficient ${stablecoin.name} balance for swap`);
            continue;
          }

          const swapType =
            stablecoin.network === token.network ? 'same-chain' : 'cross-chain';

          console.log(
            `${swapType} sell: ${amountToSell.toFixed(4)} ${token.name} ` +
              `($${valueToSell.toFixed(2)}) to ${stablecoin.name}`,
          );

          await this.promptAgentToRebalance(
            user,
            `Swap ${amountToSell.toFixed(4)} ${token.name.toLowerCase()} on ${token.network} ` +
              `to ${stablecoin.name.toLowerCase()} on ${stablecoin.network}`,
          );
        } else if (currentPercentage < targetPercentage - lowerThreshold) {
          const shortagePercentage = targetPercentage - currentPercentage;
          const valueToBuy = (shortagePercentage / 100) * totalPortfolioValue;

          const stablecoin =
            findStablecoin(userPortfolio, token.network, token.name) ||
            findStablecoin(
              userPortfolio,
              userPortfolio[0]?.network,
              token.name,
            );

          if (!stablecoin) {
            console.log(`No suitable stablecoin found to buy ${token.name}`);
            continue;
          }

          if (stablecoin.value < valueToBuy) {
            // Check if enough stablecoin
            console.log(`Insufficient ${stablecoin.name} balance for swap`);
            continue;
          }

          const swapType =
            stablecoin.network === token.network ? 'same-chain' : 'cross-chain';

          console.log(
            `${swapType} buy: $${valueToBuy.toFixed(2)} worth of ${token.name} ` +
              `using ${stablecoin.name}`,
          );

          await this.promptAgentToRebalance(
            user,
            `Swap ${valueToBuy.toFixed(2)} ${stablecoin.name.toLowerCase()} on ${stablecoin.network} ` +
              `to ${token.name.toLowerCase()} on ${token.network}`,
          );
        } else {
          console.log(`${token.name} within acceptable range`);
        }
      }
    } catch (error) {
      console.error('Error during portfolio rebalancing:', error);
    }
  };

  validateAllocations = async (input: string, chatId: number) => {
    const matches = input.match(/\b[A-Za-z]+:\d+\b/g);

    // 🚩 Error Handling: Invalid Format
    if (!matches || matches.length === 0) {
      await this.aegisAgentbot.sendMessage(
        chatId,
        'Invalid input format. Example of valid input: "USDC:40,TRUMP:30,BOBO:20"',
      );
      return; // Exit early if invalid
    }

    // ✅ Conversion: Extract allocations into an object
    const allocations: Record<string, number> = {};
    matches.forEach((pair) => {
      const [key, value] = pair.split(':');
      allocations[key] = parseInt(value, 10);
    });

    // 🚩 Validation: Sum must not exceed 100
    const total = Object.values(allocations).reduce((sum, num) => sum + num, 0);
    if (total > 100) {
      await this.aegisAgentbot.sendMessage(
        chatId,
        `Allocations must not exceed 100. Current sum: ${total}`,
      );
      return; // Exit early if invalid
    }

    console.log(allocations);
    return allocations;
  };

  validateThresholds = async (input: string, chatId: number) => {
    const matches = input.match(/(\d{1,3})\s*%/g);

    if (!matches || matches.length !== 2) {
      await this.aegisAgentbot.sendMessage(
        chatId,
        'Invalid input format. Example of valid input: 5% 5%',
      );
      return;
    }

    const thresholds = matches.map((value) => parseInt(value.replace('%', '')));

    const invalidValues = thresholds.filter((t) => t < 0 || t > 100);
    if (invalidValues.length > 0) {
      await this.aegisAgentbot.sendMessage(
        chatId,
        `Threshold values must be between 0% and 100%. Invalid values: ${invalidValues.join(', ')}%`,
      );
      return; // Exit early if invalid
    }

    console.log(thresholds);
    return { upperThreshold: thresholds[0], lowerThreshold: thresholds[1] };
  };

  @Cron('*/2 * * * *')
  async handleRebalancing() {
    console.log('running cron');
    try {
      const users = await this.UserModel.find();

      for (const user of users) {
        if (user.rebalanceEnabled) {
          // Check if rebalancing is turned on
          await this.rebalancePortfolio(user);
        }
      }
    } catch (error) {
      console.error('Error fetching users or rebalancing:', error);
    }
  }
}
