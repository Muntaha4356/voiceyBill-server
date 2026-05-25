import mongoose, { Schema } from "mongoose";
import { TransactionTypeEnum } from "./transaction.model";

export enum NotificationTypeEnum {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
}

export interface NotificationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  transactionId: mongoose.Types.ObjectId;
  type: keyof typeof TransactionTypeEnum;
  title: string;
  amount: number;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Transaction",
    },
    type: {
      type: String,
      enum: Object.values(NotificationTypeEnum),
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const NotificationModel = mongoose.model<NotificationDocument>(
  "Notification",
  notificationSchema,
);

export default NotificationModel;
