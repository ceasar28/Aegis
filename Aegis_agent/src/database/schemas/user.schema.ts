import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type UserDocument = mongoose.HydratedDocument<User>;

@Schema()
export class User {
  @Prop({ unique: true })
  chatId: number;

  @Prop()
  userName: string;

  @Prop()
  evmWalletAddress: string;

  @Prop()
  solanaWalletAddress: string;

  @Prop()
  evmWalletDetails: string;

  @Prop()
  solanaWalletDetails: string;

  @Prop()
  linkCode: string;

  @Prop({ default: 0 })
  upperThreshold: string;

  @Prop({ default: 0 })
  lowerThreshold: string;

  @Prop({ default: 0 })
  usdcAllocation: string;

  @Prop({ default: 0 })
  modeAllocation: string;

  @Prop({ default: false })
  rebalanceEnabled: boolean;

  @Prop({ default: true })
  enableAgenticAutoSwap: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
