import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertAttendanceRecordSchema } from "@shared/schema";
import { format, differenceInMinutes } from "date-fns";

// Face matching utility functions
function extractFaceCharacteristics(faceData: string): string {
  // Extract the base64 portion from the face data string
  const parts = faceData.split('_');
  if (parts.length >= 3) {
    return parts[2]; // The hash portion contains face characteristics
  }
  return faceData.substring(faceData.length - 20); // Fallback to last 20 chars
}

function calculateFaceSimilarity(stored: string, captured: string): number {
  // Simple similarity calculation based on string matching
  // In a real implementation, this would use ML algorithms to compare facial features
  
  if (stored === captured) return 1.0; // Perfect match
  
  // Calculate character-level similarity
  const minLength = Math.min(stored.length, captured.length);
  const maxLength = Math.max(stored.length, captured.length);
  
  if (maxLength === 0) return 0;
  
  let matches = 0;
  for (let i = 0; i < minLength; i++) {
    if (stored[i] === captured[i]) {
      matches++;
    }
  }
  
  // Account for length difference and calculate similarity
  const baseSimilarity = matches / maxLength;
  const lengthPenalty = (maxLength - minLength) / maxLength;
  
  return Math.max(0, baseSimilarity - lengthPenalty);
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Enhanced face matching that considers user-specific characteristics
  function matchUserFace(storedFaceData: string, capturedFaceData: string, userId: number): boolean {
    try {
      // Extract meaningful characteristics from both face data strings
      const storedHash = extractFaceCharacteristics(storedFaceData);
      const capturedHash = extractFaceCharacteristics(capturedFaceData);
      
      // Calculate similarity score
      const similarity = calculateFaceSimilarity(storedHash, capturedHash);
      
      // Validate timestamp to ensure fresh capture
      const capturedParts = capturedFaceData.split('_');
      const isValidFormat = capturedParts.length >= 2;
      const capturedTimestamp = isValidFormat ? parseInt(capturedParts[1]) : 0;
      const isRecentCapture = isValidFormat && (Date.now() - capturedTimestamp) < 300000; // Within 5 minutes
      
      // Check if stored data contains user-specific elements
      const storedParts = storedFaceData.split('_');
      const hasValidStoredFormat = storedParts.length >= 3;
      
      console.log(`Face match for user ${userId}: similarity=${similarity.toFixed(3)}, recent=${isRecentCapture}, validFormat=${hasValidStoredFormat}`);
      
      // Must have high similarity, recent capture, and valid format
      return similarity >= 0.8 && isRecentCapture && hasValidStoredFormat;
    } catch (error) {
      console.error('Face matching error:', error);
      return false;
    }
  }

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

      // Use enhanced face matching that validates user-specific characteristics
      const isValidMatch = matchUserFace(user.faceData, faceData, user.id);
      
      if (isValidMatch) {
        res.json({ verified: true, message: "Face verification successful" });
      } else {
        res.status(400).json({ verified: false, message: "Face verification failed - face does not match registered user" });
      }
    } catch (error) {
      console.error('Face verification error:', error);
      res.status(500).json({ message: "Face verification failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
