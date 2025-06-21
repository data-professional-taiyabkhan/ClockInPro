import bcrypt from "bcrypt";
import { storage } from "./storage";
import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import type { User } from "@shared/schema";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  return bcrypt.compare(supplied, stored);
}

export function setupAuth(app: Express) {
  app.use(session({
    secret: process.env.SESSION_SECRET || "your-secret-key-here",
    store: storage.sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Authentication middleware
  app.use((req: any, res, next) => {
    if (req.session?.userId) {
      storage.getUser(req.session.userId).then(user => {
        req.user = user;
        next();
      }).catch(() => next());
    } else {
      next();
    }
  });
}

// Middleware to require authentication
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Middleware to require manager/admin role
export function requireManager(req: Request, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== "manager" && req.user.role !== "admin")) {
    return res.status(403).json({ message: "Manager access required" });
  }
  next();
}

// Middleware to require admin role
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export { hashPassword, comparePasswords };