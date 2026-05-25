import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middlerware";
import { HTTPSTATUS } from "../config/http.config";
import {
  getNotificationsService,
  getUnreadNotificationCountService,
  markAllNotificationsReadService,
  registerNotificationStreamClient,
} from "../services/notification.service";

export const getNotificationsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = String(req.user?._id);
    const limit = Number(req.query.limit ?? 10);

    const notifications = await getNotificationsService(userId, limit);

    return res.status(HTTPSTATUS.OK).json({
      notifications,
    });
  },
);

export const getUnreadNotificationCountController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = String(req.user?._id);
    const count = await getUnreadNotificationCountService(userId);

    return res.status(HTTPSTATUS.OK).json({
      count,
    });
  },
);

export const markAllNotificationsReadController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = String(req.user?._id);

    await markAllNotificationsReadService(userId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Notifications marked as read",
    });
  },
);

export const streamNotificationsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = String(req.user?._id);
    const removeClient = registerNotificationStreamClient(userId, res);

    req.on("close", () => {
      removeClient();
    });
  },
);
