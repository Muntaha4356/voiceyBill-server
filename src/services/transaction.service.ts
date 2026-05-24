import TransactionModel, {
  TransactionTypeEnum,
} from "../models/transaction.model";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import { calculateNextOccurrence } from "../utils/helper";
import {
  CreateTransactionType,
  UpdateTransactionType,
} from "../validators/transaction.validator";
import { openai, openAIModel } from "../config/openai.config";
import { receiptPrompt } from "../utils/prompt";

export const createTransactionService = async (
  body: CreateTransactionType,
  userId: string,
) => {
  let nextRecurringDate: Date | undefined;
  const currentDate = new Date();

  if (body.isRecurring && body.recurringInterval) {
    const calulatedDate = calculateNextOccurrence(
      body.date,
      body.recurringInterval,
    );

    nextRecurringDate =
      calulatedDate < currentDate
        ? calculateNextOccurrence(currentDate, body.recurringInterval)
        : calulatedDate;
  }

  const transaction = await TransactionModel.create({
    ...body,
    userId,
    category: body.category,
    amount: Number(body.amount),
    isRecurring: body.isRecurring || false,
    recurringInterval: body.recurringInterval || null,
    nextRecurringDate,
    lastProcessed: null,
  });

  return transaction;
};

export const getAllTransactionService = async (
  userId: string,
  filters: {
    keyword?: string;
    type?: keyof typeof TransactionTypeEnum;
    recurringStatus?: "RECURRING" | "NON_RECURRING";
  },
  pagination: {
    pageSize: number;
    pageNumber: number;
  },
) => {
  const { keyword, type, recurringStatus } = filters;

  const filterConditions: Record<string, any> = {
    userId,
  };

  if (keyword) {
    filterConditions.$or = [
      { title: { $regex: keyword, $options: "i" } },
      { category: { $regex: keyword, $options: "i" } },
    ];
  }

  if (type) {
    filterConditions.type = type;
  }

  if (recurringStatus) {
    if (recurringStatus === "RECURRING") {
      filterConditions.isRecurring = true;
    } else if (recurringStatus === "NON_RECURRING") {
      filterConditions.isRecurring = false;
    }
  }

  const { pageSize, pageNumber } = pagination;
  const skip = (pageNumber - 1) * pageSize;

  const [transactions, totalCount] = await Promise.all([
    TransactionModel.find(filterConditions)
      .skip(skip)
      .limit(pageSize)
      .sort({ createdAt: -1 }),
    TransactionModel.countDocuments(filterConditions),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    transactions,
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages,
      skip,
    },
  };
};

export const getTransactionByIdService = async (
  userId: string,
  transactionId: string,
) => {
  const transaction = await TransactionModel.findOne({
    _id: transactionId,
    userId,
  });
  if (!transaction) throw new NotFoundException("Transaction not found");

  return transaction;
};

export const duplicateTransactionService = async (
  userId: string,
  transactionId: string,
) => {
  const transaction = await TransactionModel.findOne({
    _id: transactionId,
    userId,
  });
  if (!transaction) throw new NotFoundException("Transaction not found");

  const duplicated = await TransactionModel.create({
    ...transaction.toObject(),
    _id: undefined,
    title: `Duplicate - ${transaction.title}`,
    description: transaction.description
      ? `${transaction.description} (Duplicate)`
      : "Duplicated transaction",
    isRecurring: false,
    recurringInterval: undefined,
    nextRecurringDate: undefined,
    createdAt: undefined,
    updatedAt: undefined,
  });

  return duplicated;
};

export const updateTransactionService = async (
  userId: string,
  transactionId: string,
  body: UpdateTransactionType,
) => {
  const existingTransaction = await TransactionModel.findOne({
    _id: transactionId,
    userId,
  });
  if (!existingTransaction)
    throw new NotFoundException("Transaction not found");

  const now = new Date();
  const isRecurring = body.isRecurring ?? existingTransaction.isRecurring;

  const date =
    body.date !== undefined ? new Date(body.date) : existingTransaction.date;

  let recurringInterval:
    | "DAILY"
    | "WEEKLY"
    | "MONTHLY"
    | "YEARLY"
    | null
    | undefined =
    body.recurringInterval ?? existingTransaction.recurringInterval;
  let nextRecurringDate: Date | undefined | null = null;

  if (isRecurring === false) {
    recurringInterval = null;
    nextRecurringDate = null;
  } else if (isRecurring && recurringInterval) {
    const calulatedDate = calculateNextOccurrence(date, recurringInterval);

    nextRecurringDate =
      calulatedDate < now
        ? calculateNextOccurrence(now, recurringInterval)
        : calulatedDate;
  }

  existingTransaction.set({
    ...(body.title && { title: body.title }),
    ...(body.description && { description: body.description }),
    ...(body.category && { category: body.category }),
    ...(body.type && { type: body.type }),
    ...(body.paymentMethod && { paymentMethod: body.paymentMethod }),
    ...(body.amount !== undefined && { amount: Number(body.amount) }),
    date,
    isRecurring,
    recurringInterval,
    nextRecurringDate,
  });

  await existingTransaction.save();

  return;
};

export const deleteTransactionService = async (
  userId: string,
  transactionId: string,
) => {
  const deleted = await TransactionModel.findByIdAndDelete({
    _id: transactionId,
    userId,
  });
  if (!deleted) throw new NotFoundException("Transaction not found");

  return;
};

export const bulkDeleteTransactionService = async (
  userId: string,
  transactionIds: string[],
) => {
  const result = await TransactionModel.deleteMany({
    _id: { $in: transactionIds },
    userId,
  });

  if (result.deletedCount === 0)
    throw new NotFoundException("No transations found");

  return {
    sucess: true,
    deletedCount: result.deletedCount,
  };
};

export const bulkTransactionService = async (
  userId: string,
  transactions: CreateTransactionType[],
) => {
  try {
    const bulkOps = transactions.map((tx) => ({
      insertOne: {
        document: {
          ...tx,
          userId,
          isRecurring: false,
          nextRecurringDate: null,
          recurringInterval: null,
          lastProcesses: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    }));

    const result = await TransactionModel.bulkWrite(bulkOps, {
      ordered: true,
    });

    return {
      insertedCount: result.insertedCount,
      success: true,
    };
  } catch (error) {
    throw error;
  }
};

export const scanReceiptService = async (
  file: Express.Multer.File | undefined,
) => {
  if (!file) throw new BadRequestException("No file uploaded");

  try {
    if (!file.path) throw new BadRequestException("Failed to upload file");

    const result = await openai.chat.completions.create({
      model: openAIModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: receiptPrompt },
            { type: "image_url", image_url: { url: file.path } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 500,
    });

    // Try multiple common locations for returned content to be robust
    const pickers = [
      (r: any) => r?.choices?.[0]?.message?.content,
      (r: any) => r?.choices?.[0]?.text,
      (r: any) => r?.choices?.[0]?.message?.content?.text,
      (r: any) => r?.output?.[0]?.content?.[0]?.text,
      (r: any) => r?.data?.[0]?.text,
      (r: any) => r?.response?.choices?.[0]?.message?.content,
      (r: any) => r?.result?.content,
    ];

    let content: any = undefined;
    for (const pick of pickers) {
      try {
        const v = pick(result as any);
        if (v !== undefined && v !== null) {
          content = v;
          break;
        }
      } catch (e) {
        // ignore and continue
      }
    }

    if (content === undefined || content === null) {
      console.error("scanReceiptService no choices/content found on AI response", result);
      return { error: "No choices returned from AI" };
    }

    // If content is an object, normalize to string (prefer `.text` when present)
    if (typeof content === "object") {
      if (typeof content.text === "string" && content.text.trim()) {
        content = content.text;
      } else {
        try {
          content = JSON.stringify(content);
        } catch (e) {
          content = String(content);
        }
      }
    }

    // code: muntahaned

    if (!content) {
      console.warn("scanReceiptService no AI content returned");
      return { error: "Could not read receipt content" };
    }

    let data;
    try {
      data = JSON.parse(content);
    } catch (parseError) {
      console.error("scanReceiptService JSON parse failed", { content, parseError });
      return { error: "Could not parse receipt content" };
    }

    console.log("scanReceiptService parsed data", data);

    if (!data.amount || !data.date) {
      console.warn("scanReceiptService parsed response missing required fields", {
        amount: data.amount,
        date: data.date,
      });
      return { error: "Receipt missing required information" };
    }

    return {
      title: data.title || "Receipt",
      amount: data.amount,
      date: data.date,
      description: data.description,
      category: data.category,
      paymentMethod: data.paymentMethod,
      type: data.type,
      receiptUrl: file.path,
    };
  } catch (error) {
    console.error("scanReceiptService caught error", error);
    return { error: "Receipt scanning service unavailable" };
  }
};
