import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertAttendanceRecordSchema } from "@shared/schema";
import { format, differenceInMinutes } from "date-fns";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Clock in endpoint
  app.post("/api/clock-in", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const existingRecord = await storage.getTodayAttendanceRecord(req.user!.id, today);

    if (existingRecord && !existingRecord.clockOutTime) {
      return res.status(400).json({ message: "Already clocked in today" });
    }

    const attendanceRecord = await storage.createAttendanceRecord({
      userId: req.user!.id,
      clockInTime: new Date(),
      date: today,
    });

    res.json(attendanceRecord);
  });

  // Clock out endpoint
  app.post("/api/clock-out", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const todayRecord = await storage.getTodayAttendanceRecord(req.user!.id, today);

    if (!todayRecord || todayRecord.clockOutTime) {
      return res.status(400).json({ message: "No active clock-in found" });
    }

    const clockOutTime = new Date();
    const totalMinutes = differenceInMinutes(clockOutTime, todayRecord.clockInTime);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const totalHours = `${hours}h ${minutes}m`;

    const updatedRecord = await storage.updateAttendanceRecord(todayRecord.id, {
      clockOutTime,
      totalHours,
    });

    res.json(updatedRecord);
  });

  // Get user attendance records
  app.get("/api/attendance", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const records = await storage.getUserAttendanceRecords(req.user!.id);
    res.json(records);
  });

  // Get today's attendance status
  app.get("/api/attendance/today", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const todayRecord = await storage.getTodayAttendanceRecord(req.user!.id, today);
    
    res.json({
      record: todayRecord,
      isClockedIn: todayRecord && !todayRecord.clockOutTime,
    });
  });

  // Register face data
  app.post("/api/register-face", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { faceData } = req.body;
      if (!faceData) {
        return res.status(400).json({ message: "Face data is required" });
      }

      const updatedUser = await storage.updateUserFaceData(req.user!.id, faceData);
      res.json({ message: "Face registered successfully", user: updatedUser });
    } catch (error) {
      console.error('Face registration error:', error);
      res.status(500).json({ message: "Face registration failed" });
    }
  });

  // Verify face for clock in/out
  app.post("/api/verify-face", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { faceData } = req.body;
      if (!faceData) {
        return res.status(400).json({ message: "Face data is required" });
      }

      const user = req.user!;
      if (!user.faceRegistered || !user.faceData) {
        return res.status(400).json({ message: "Face not registered. Please register your face first." });
      }

      // In a real implementation, you would compare the face descriptors using ML algorithms
      // For demo purposes, we'll simulate successful verification if the user has registered face data
      // and the incoming face data follows the expected format
      const isFaceDataValid = faceData.startsWith('face_') && faceData.length > 20;
      const hasRegisteredFace = user.faceRegistered && user.faceData && user.faceData.startsWith('face_');
      
      if (isFaceDataValid && hasRegisteredFace) {
        res.json({ verified: true, message: "Face verification successful" });
      } else {
        res.status(400).json({ verified: false, message: "Face verification failed" });
      }
    } catch (error) {
      console.error('Face verification error:', error);
      res.status(500).json({ message: "Face verification failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
