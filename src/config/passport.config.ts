import {
  Strategy as JwtStrategy,
  ExtractJwt,
  StrategyOptions,
} from "passport-jwt";
import passport from "passport";
import { NextFunction, Request, Response } from "express";
import { Env } from "./env.config";
import { findByIdUserService } from "../services/user.service";
import { consumeSseTicket } from "../services/sse-ticket.service";

interface JwtPayload {
  userId: string;
}

const options: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: Env.JWT_SECRET,
  audience: ["user"],
  algorithms: ["HS256"],
};

passport.use(
  new JwtStrategy(options, async (payload: JwtPayload, done) => {
    try {
      if (!payload.userId) {
        return done(null, false, { message: "Invalid token payload" });
      }

      const user = await findByIdUserService(payload.userId);
      if (!user) {
        return done(null, false);
      }

      return done(null, user);
    } catch (error) {
      return done(error, false);
    }
  })
);

passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));

export const passportAuthenticateJwt = passport.authenticate("jwt", {
  session: false,
});

export const passportAuthenticateSseTicket = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const ticket = req.query?.ticket;
    if (!ticket || typeof ticket !== "string") {
      return res.status(401).json({
        message: "SSE ticket is required for notification stream authentication",
      });
    }

    const userId = await consumeSseTicket(ticket);
    if (!userId) {
      return res.status(401).json({
        message: "Invalid or expired SSE ticket",
      });
    }

    const user = await findByIdUserService(userId);
    if (!user) {
      return res.status(401).json({
        message: "Invalid SSE ticket user",
      });
    }

    req.user = user as any;
    next();
  } catch (error) {
    next(error);
  }
};
