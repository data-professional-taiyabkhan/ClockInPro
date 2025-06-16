import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertAttendanceRecordSchema } from "@shared/schema";
import { format, differenceInMinutes } from "date-fns";

// Enhanced face matching utility functions
function extractFaceCharacteristics(faceData: string): any {
  try {
    // Try parsing as JSON first (enhanced descriptors)
    return JSON.parse(faceData);
  } catch (error) {
    // Fallback for legacy format
    const parts = faceData.split('_');
    if (parts.length >= 3) {
      return { legacy: parts[2] };
    }
    return { legacy: faceData.substring(faceData.length - 20) };
  }
}

function calculateFaceSimilarity(stored: string, captured: string): number {
  const storedFeatures = extractFaceCharacteristics(stored);
  const capturedFeatures = extractFaceCharacteristics(captured);
  
  // Handle face-api.js descriptors (arrays of numbers)
  if (Array.isArray(storedFeatures) && Array.isArray(capturedFeatures)) {
    return calculateEuclideanSimilarity(storedFeatures, capturedFeatures);
  }
  
  // Handle enhanced feature objects
  if (storedFeatures.eyeRegion && capturedFeatures.eyeRegion) {
    return calculateEnhancedFeatureSimilarity(storedFeatures, capturedFeatures);
  }
  
  // Handle legacy format
  if (storedFeatures.legacy && capturedFeatures.legacy) {
    return calculateBasicSimilarity(storedFeatures.legacy, capturedFeatures.legacy);
  }
  
  // Mixed formats - return low confidence
  return 0.3;
}

function calculateEuclideanSimilarity(descriptor1: number[], descriptor2: number[]): number {
  if (descriptor1.length !== descriptor2.length) return 0;
  
  let sumSquaredDiffs = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sumSquaredDiffs += diff * diff;
  }
  
  const distance = Math.sqrt(sumSquaredDiffs);
  // Convert distance to similarity (lower distance = higher similarity)
  // Face-api.js typical threshold is 0.6, we use 0.5 for stricter matching
  const similarity = Math.max(0, 1 - (distance / 0.5));
  return similarity;
}

function calculateEnhancedFeatureSimilarity(stored: any, captured: any): number {
  let totalSimilarity = 0;
  
  // Compare facial regions (75% weight)
  const regions = ['eyeRegion', 'noseRegion', 'mouthRegion'];
  for (const region of regions) {
    if (stored[region] && captured[region]) {
      const regionSim = compareRegion(stored[region], captured[region]);
      totalSimilarity += regionSim * 0.25; // Each region worth 25%
    }
  }
  
  // Compare overall brightness (10% weight)
  if (stored.overallBrightness && captured.overallBrightness) {
    const brightnessDiff = Math.abs(stored.overallBrightness - captured.overallBrightness);
    const brightnessSim = Math.max(0, 1 - (brightnessDiff / 255));
    totalSimilarity += brightnessSim * 0.10;
  }
  
  // Compare color distribution (15% weight)
  if (stored.colorDistribution && captured.colorDistribution) {
    const colorSim = compareColorDistribution(stored.colorDistribution, captured.colorDistribution);
    totalSimilarity += colorSim * 0.15;
  }
  
  return totalSimilarity;
}

function compareRegion(region1: any, region2: any): number {
  let similarity = 0;
  let factors = 0;
  
  // Compare average RGB values
  ['avgR', 'avgG', 'avgB'].forEach(color => {
    if (region1[color] !== undefined && region2[color] !== undefined) {
      const diff = Math.abs(region1[color] - region2[color]);
      similarity += Math.max(0, 1 - (diff / 255));
      factors++;
    }
  });
  
  // Compare brightness
  if (region1.brightness !== undefined && region2.brightness !== undefined) {
    const brightnessDiff = Math.abs(region1.brightness - region2.brightness);
    similarity += Math.max(0, 1 - (brightnessDiff / 255));
    factors++;
  }
  
  return factors > 0 ? similarity / factors : 0;
}

function compareColorDistribution(dist1: number[], dist2: number[]): number {
  if (!dist1 || !dist2 || dist1.length !== dist2.length) return 0;
  
  let similarity = 0;
  const total1 = dist1.reduce((sum, val) => sum + val, 0);
  const total2 = dist2.reduce((sum, val) => sum + val, 0);
  
  for (let i = 0; i < dist1.length; i++) {
    const norm1 = total1 > 0 ? dist1[i] / total1 : 0;
    const norm2 = total2 > 0 ? dist2[i] / total2 : 0;
    similarity += 1 - Math.abs(norm1 - norm2);
  }
  
  return similarity / dist1.length;
}

function calculateBasicSimilarity(stored: string, captured: string): number {
  if (stored === captured) return 1.0;
  
  const minLength = Math.min(stored.length, captured.length);
  const maxLength = Math.max(stored.length, captured.length);
  
  if (maxLength === 0) return 0;
  
  let matches = 0;
  let partialMatches = 0;
  
  // Check for exact matches and similar characters
  for (let i = 0; i < minLength; i++) {
    if (stored[i] === captured[i]) {
      matches++;
    } else {
      // Check for similar characters (for base64 encoding variations)
      const storedChar = stored.charCodeAt(i);
      const capturedChar = captured.charCodeAt(i);
      if (Math.abs(storedChar - capturedChar) <= 2) {
        partialMatches++;
      }
    }
  }
  
  // Give full weight to exact matches, half weight to partial matches
  const effectiveMatches = matches + (partialMatches * 0.5);
  const baseSimilarity = effectiveMatches / maxLength;
  
  // Reduce length penalty for basic similarity
  const lengthPenalty = (maxLength - minLength) / maxLength * 0.5;
  
  return Math.max(0, baseSimilarity - lengthPenalty);
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Enhanced face matching with improved accuracy
  function matchUserFace(storedFaceData: string, capturedFaceData: string, userId: number): boolean {
    try {
      const similarity = calculateFaceSimilarity(storedFaceData, capturedFaceData);
      const storedFeatures = extractFaceCharacteristics(storedFaceData);
      const capturedFeatures = extractFaceCharacteristics(capturedFaceData);
      
      // Determine threshold based on descriptor type with user-specific validation
      let threshold = 0.4; // Secure baseline threshold
      let descriptorType = 'basic';
      let hasUserSpecificFeatures = false;
      
      if (Array.isArray(storedFeatures) && Array.isArray(capturedFeatures)) {
        // Face-api.js descriptors are most accurate
        threshold = 0.6;
        descriptorType = 'face-api';
        hasUserSpecificFeatures = true;
      } else if (storedFeatures.eyeRegion && capturedFeatures.eyeRegion && 
                 storedFeatures.cheekRegion && capturedFeatures.cheekRegion) {
        // Enhanced features with multiple regions - more secure
        threshold = 0.45;
        descriptorType = 'enhanced';
        hasUserSpecificFeatures = true;
      } else if (storedFeatures.eyeRegion && capturedFeatures.eyeRegion) {
        // Basic enhanced features
        threshold = 0.4;
        descriptorType = 'enhanced-basic';
        hasUserSpecificFeatures = true;
      } else if (storedFeatures.legacy && capturedFeatures.legacy) {
        // Legacy descriptors - less secure
        threshold = 0.35;
        descriptorType = 'legacy';
      } else {
        // Mixed or unknown descriptor types - most secure
        threshold = 0.45;
        descriptorType = 'mixed';
      }
      
      // Add user-specific validation for enhanced security
      if (hasUserSpecificFeatures) {
        // Check geometric consistency for the specific user
        if (storedFeatures.faceRadius && capturedFeatures.faceRadius) {
          const radiusDiff = Math.abs(storedFeatures.faceRadius - capturedFeatures.faceRadius) / 
                            Math.max(storedFeatures.faceRadius, capturedFeatures.faceRadius);
          if (radiusDiff > 0.3) { // Face size too different
            console.log(`Face size mismatch for user ${userId}: ${radiusDiff.toFixed(2)} > 0.3`);
            return false;
          }
        }
        
        // Check aspect ratio consistency
        if (storedFeatures.aspectRatio && capturedFeatures.aspectRatio) {
          const aspectDiff = Math.abs(storedFeatures.aspectRatio - capturedFeatures.aspectRatio) / 
                            Math.max(storedFeatures.aspectRatio, capturedFeatures.aspectRatio);
          if (aspectDiff > 0.2) { // Face proportions too different
            console.log(`Face proportion mismatch for user ${userId}: ${aspectDiff.toFixed(2)} > 0.2`);
            return false;
          }
        }
      }
      
      // Additional validation for enhanced/face-api descriptors
      let isValidCapture = true;
      if (capturedFeatures.timestamp) {
        const captureAge = Date.now() - capturedFeatures.timestamp;
        isValidCapture = captureAge < 300000; // Within 5 minutes
      }
      
      const isMatch = similarity >= threshold && isValidCapture;
      
      console.log(`Face verification for user ${userId}:`);
      console.log(`- Descriptor type: ${descriptorType}`);
      console.log(`- Similarity: ${(similarity * 100).toFixed(1)}%`);
      console.log(`- Threshold: ${(threshold * 100).toFixed(1)}%`);
      console.log(`- Valid capture: ${isValidCapture}`);
      console.log(`- Match result: ${isMatch}`);
      
      return isMatch;
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
        // More specific error messages based on similarity scores
        const similarity = calculateFaceSimilarity(user.faceData, faceData);
        const capturedFeatures = extractFaceCharacteristics(faceData);
        
        let errorMessage = "Face verification failed - face does not match registered user";
        
        if (similarity < 0.2) {
          errorMessage = "Face verification failed - captured face appears to be a different person";
        } else if (similarity < 0.35) {
          errorMessage = "Face verification failed - face similarity too low, please improve lighting and positioning";
        } else if (capturedFeatures.timestamp && (Date.now() - capturedFeatures.timestamp) > 300000) {
          errorMessage = "Face verification failed - capture too old, please try again";
        } else {
          errorMessage = `Face verification failed - similarity ${(similarity * 100).toFixed(0)}% is below threshold. Please ensure good lighting and clear face visibility.`;
        }
        
        res.status(400).json({ verified: false, message: errorMessage });
      }
    } catch (error) {
      console.error('Face verification error:', error);
      res.status(500).json({ message: "Face verification failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
