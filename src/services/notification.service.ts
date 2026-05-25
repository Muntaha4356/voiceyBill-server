import { Response } from "express";
import { EventEmitter } from "events";
import NotificationModel, {
  NotificationDocument,
  NotificationTypeEnum,
} from "../models/notification.model";

type NotificationEvent = {
  userId: string;
  notification: NotificationDocument;
};

const notificationEvents = new EventEmitter();
const NOTIFICATION_EVENT = "notification-created";

const createNotificationPayload = (notification: NotificationDocument) => ({
  _id: (notification as any)._id,
  transactionId: notification.transactionId,
  type: notification.type,
  title: notification.title,
  amount: notification.amount,
  isRead: notification.isRead,
  createdAt: notification.createdAt,
});

const writeSse = (res: Response, event: string, payload: unknown) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

export const createNotificationService = async (params: {
  userId: string;
  transactionId: string;
  type: keyof typeof NotificationTypeEnum;
  title: string;
  amount: number;
}) => {
  const notification = await NotificationModel.create({
    userId: params.userId,
    transactionId: params.transactionId,
    type: params.type,
    title: params.title,
    amount: params.amount,
    isRead: false,
  });

  console.debug(`Emit notification for user ${params.userId}, transaction ${params.transactionId}`);
  notificationEvents.emit(NOTIFICATION_EVENT, {
    userId: params.userId,
    notification,
  });

  return notification;
};

export const getNotificationsService = async (
  userId: string,
  limit = 10,
) => {
  return NotificationModel.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

export const getUnreadNotificationCountService = async (userId: string) => {
  return NotificationModel.countDocuments({ userId, isRead: false });
};

export const markAllNotificationsReadService = async (userId: string) => {
  await NotificationModel.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true } },
  );
};

export const registerNotificationStreamClient = (
  userId: string,
  res: Response,
) => {
  const normalizedUserId = String(userId);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write("retry: 10000\n\n");

  const handleNotification = (event: NotificationEvent) => {
    if (String(event.userId) === normalizedUserId) {
      console.debug(`Delivering notification to SSE client for user ${normalizedUserId}`);
      writeSse(res, NOTIFICATION_EVENT, {
        notification: createNotificationPayload(event.notification),
      });
    }
  };

  notificationEvents.on(NOTIFICATION_EVENT, handleNotification);

  return () => {
    notificationEvents.removeListener(NOTIFICATION_EVENT, handleNotification);
  };
};
