import { Router } from "express";
import {
  getNotificationsController,
  getUnreadNotificationCountController,
  markAllNotificationsReadController,
  streamNotificationsController,
} from "../controllers/notification.controller";
import {
  passportAuthenticateJwt,
  passportAuthenticateSseTicket,
} from "../config/passport.config";

const notificationRoutes = Router();

notificationRoutes.get("/all", passportAuthenticateJwt, getNotificationsController);
notificationRoutes.get(
  "/unread-count",
  passportAuthenticateJwt,
  getUnreadNotificationCountController,
);
notificationRoutes.patch(
  "/read-all",
  passportAuthenticateJwt,
  markAllNotificationsReadController,
);
notificationRoutes.get("/stream", passportAuthenticateSseTicket, streamNotificationsController);

export default notificationRoutes;
