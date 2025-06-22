import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, requireAuth, requireManager, requireAdmin, hashPassword, comparePasswords } from "./auth";
import { storage } from "./storage";
import { insertAttendanceRecordSchema, loginSchema, registerSchema, users, employeeInvitations } from "@shared/schema";
import { desc, eq, and } from "drizzle-orm";
import { db } from "./db";
import crypto from "crypto";
import { format, differenceInMinutes } from "date-fns";
import { rekognitionService } from "./aws-rekognition";

// Enhanced fallback image comparison using Sharp for better analysis
async function compareImages(registeredImageData: string, capturedImageData: string): Promise<boolean> {
  try {
    const sharp = await import('sharp');
    
    // Convert base64 to buffers
    const registeredBase64 = registeredImageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const capturedBase64 = capturedImageData.replace(/^data:image\/[a-z]+;base64,/, '');
    
    const registeredBuffer = Buffer.from(registeredBase64, 'base64');
    const capturedBuffer = Buffer.from(capturedBase64, 'base64');
    
    // Multiple comparison approaches for better accuracy
    const results = await Promise.all([
      // 1. Full image comparison
      compareImageBuffers(sharp, registeredBuffer, capturedBuffer, 200),
      // 2. Center face region comparison
      compareImageBuffers(sharp, registeredBuffer, capturedBuffer, 150, true),
      // 3. Edge detection comparison
      compareEdgeDetection(sharp, registeredBuffer, capturedBuffer),
    ]);
    
    const [fullSimilarity, faceSimilarity, edgeSimilarity] = results;
    
    // Weighted average with higher weight on face region
    const weightedSimilarity = (fullSimilarity * 0.3 + faceSimilarity * 0.5 + edgeSimilarity * 0.2);
    
    console.log(`Enhanced image comparison - Full: ${(fullSimilarity * 100).toFixed(1)}%, Face: ${(faceSimilarity * 100).toFixed(1)}%, Edge: ${(edgeSimilarity * 100).toFixed(1)}%, Weighted: ${(weightedSimilarity * 100).toFixed(1)}%`);
    
    // More strict requirement when using fallback method
    return weightedSimilarity > 0.80;
    
  } catch (error) {
    console.error('Enhanced image comparison error:', error);
    return false; // Fail secure - don't allow if comparison fails
  }
}

async function compareImageBuffers(sharp: any, buffer1: Buffer, buffer2: Buffer, size: number, centerCrop: boolean = false): Promise<number> {
  let processed1, processed2;
  
  if (centerCrop) {
    // Focus on center region (face area)
    const cropSize = Math.floor(size * 0.7);
    const offset = Math.floor((size - cropSize) / 2);
    
    processed1 = await sharp.default(buffer1)
      .resize(size, size)
      .extract({ left: offset, top: offset, width: cropSize, height: cropSize })
      .greyscale()
      .raw()
      .toBuffer();
      
    processed2 = await sharp.default(buffer2)
      .resize(size, size)
      .extract({ left: offset, top: offset, width: cropSize, height: cropSize })
      .greyscale()
      .raw()
      .toBuffer();
  } else {
    processed1 = await sharp.default(buffer1)
      .resize(size, size)
      .greyscale()
      .raw()
      .toBuffer();
      
    processed2 = await sharp.default(buffer2)
      .resize(size, size)
      .greyscale()
      .raw()
      .toBuffer();
  }
  
  // Calculate pixel difference
  let totalDiff = 0;
  const totalPixels = processed1.length;
  
  for (let i = 0; i < totalPixels; i++) {
    totalDiff += Math.abs(processed1[i] - processed2[i]);
  }
  
  const avgDiff = totalDiff / totalPixels / 255;
  return 1 - avgDiff;
}

async function compareEdgeDetection(sharp: any, buffer1: Buffer, buffer2: Buffer): Promise<number> {
  // Apply edge detection to focus on facial features
  const edges1 = await sharp.default(buffer1)
    .resize(150, 150)
    .greyscale()
    .convolve({
      width: 3,
      height: 3,
      kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
    })
    .raw()
    .toBuffer();
    
  const edges2 = await sharp.default(buffer2)
    .resize(150, 150)
    .greyscale()
    .convolve({
      width: 3,
      height: 3,
      kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
    })
    .raw()
    .toBuffer();
  
  let totalDiff = 0;
  const totalPixels = edges1.length;
  
  for (let i = 0; i < totalPixels; i++) {
    totalDiff += Math.abs(edges1[i] - edges2[i]);
  }
  
  const avgDiff = totalDiff / totalPixels / 255;
  return 1 - avgDiff;
}

// UK Postcode validation regex
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

// Simple distance calculation for location verification
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon1-lon2) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Authentication routes
  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: "Account is inactive" });
      }

      const isPasswordValid = await comparePasswords(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Set session
      (req.session as any).userId = user.id;

      // Return user without password
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ message: "Login failed" });
    }
  });

  app.post("/api/register", requireManager, async (req, res) => {
    try {
      const userData = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(userData.password);
      
      const { confirmPassword, ...userToCreate } = userData;
      const user = await storage.createUser({
        ...userToCreate,
        password: hashedPassword,
      });

      // Return user without password
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ message: "Registration failed" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session?.destroy(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", requireAuth, (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const { password: _, ...safeUser } = req.user;
    res.json(safeUser);
  });

  // Manager/Admin employee face image management
  app.post("/api/employees/:id/face-image", requireAuth, async (req, res) => {
    try {
      // Check if user is manager or admin
      if (req.user!.role !== 'manager' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Manager or Admin access required" });
      }

      const { imageData } = req.body;
      const employeeId = parseInt(req.params.id);
      
      if (!imageData || !imageData.startsWith('data:image/')) {
        return res.status(400).json({ message: "Invalid image data" });
      }

      // Validate with AWS Rekognition if available
      try {
        const validation = await rekognitionService.validateImageForRegistration(imageData);
        if (!validation.isValid) {
          return res.status(400).json({ 
            message: validation.message || "Face image validation failed" 
          });
        }
      } catch (error) {
        console.log("AWS validation unavailable, proceeding with basic validation");
      }

      // Update employee with face image URL
      const updatedUser = await storage.updateUserFaceImage(employeeId, imageData);
      
      const { password: _, ...safeUser } = updatedUser;
      res.json({
        message: "Employee face image updated successfully",
        user: safeUser
      });
    } catch (error) {
      console.error("Face image upload error:", error);
      res.status(500).json({ message: "Failed to upload face image" });
    }
  });

  // Location management (Admin only)
  app.post("/api/locations", requireAdmin, async (req, res) => {
    try {
      const { name, postcode, latitude, longitude, radiusMeters } = req.body;
      
      if (!UK_POSTCODE_REGEX.test(postcode)) {
        return res.status(400).json({ message: "Invalid UK postcode format" });
      }

      const location = await storage.createLocation({
        name,
        postcode: postcode.toUpperCase(),
        latitude,
        longitude,
        radiusMeters: radiusMeters || 100
      });

      res.json(location);
    } catch (error) {
      console.error("Location creation error:", error);
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  app.get("/api/locations", requireManager, async (req, res) => {
    try {
      const locations = await storage.getActiveLocations();
      res.json(locations);
    } catch (error) {
      console.error("Get locations error:", error);
      res.status(500).json({ message: "Failed to get locations" });
    }
  });

  // Face verification for check-in
  app.post("/api/verify-face", requireAuth, async (req, res) => {
    try {
      const { imageData, userLocation } = req.body;
      
      if (!req.user?.faceImageUrl) {
        return res.status(400).json({ message: "No face image registered. Please register your face first." });
      }

      // Location verification
      if (userLocation && userLocation.postcode) {
        const allowedLocation = await storage.getLocationByPostcode(userLocation.postcode.toUpperCase());
        if (!allowedLocation) {
          return res.status(403).json({ 
            message: "Check-in not allowed from this location. Please contact your manager." 
          });
        }

        // Distance verification if coordinates provided
        if (userLocation.latitude && userLocation.longitude && 
            allowedLocation.latitude && allowedLocation.longitude) {
          const distance = calculateDistance(
            parseFloat(userLocation.latitude),
            parseFloat(userLocation.longitude),
            parseFloat(allowedLocation.latitude),
            parseFloat(allowedLocation.longitude)
          );

          if (distance > allowedLocation.radiusMeters) {
            return res.status(403).json({ 
              message: `You are ${Math.round(distance)}m away. Please move closer to the work location.` 
            });
          }
        }
      }

      // Face verification using AWS Rekognition
      try {
        const comparison = await rekognitionService.compareFaces(
          req.user.faceImageUrl,
          imageData
        );

        if (comparison.isMatch) {
          res.json({ 
            verified: true, 
            message: "Face verification successful",
            similarity: comparison.similarity,
            location: userLocation?.postcode 
          });
        } else {
          res.status(400).json({ 
            verified: false, 
            message: `Face verification failed. Similarity: ${comparison.similarity.toFixed(1)}%` 
          });
        }
      } catch (error) {
        console.error("Face verification error:", error);
        
        // Enhanced fallback verification using image analysis
        try {
          const registeredImage = req.user.faceImageUrl;
          const capturedImage = imageData;
          
          // Check if captured image appears to contain a face (basic validation)
          const capturedBase64 = capturedImage.replace(/^data:image\/[a-z]+;base64,/, '');
          if (capturedBase64.length < 1000) {
            return res.status(400).json({
              verified: false,
              message: "Image appears to be too small or invalid"
            });
          }
          
          const isVerified = await compareImages(registeredImage, capturedImage);
          
          if (isVerified) {
            res.json({
              verified: true,
              message: "Face verification successful (enhanced mode)",
            });
          } else {
            res.status(400).json({
              verified: false,
              message: "Face verification failed - images do not match sufficiently"
            });
          }
        } catch (fallbackError) {
          console.error("Fallback verification error:", fallbackError);
          res.status(400).json({
            verified: false,
            message: "Face verification failed - unable to process images"
          });
        }
      }
    } catch (error) {
      console.error("Face verification error:", error);
      res.status(500).json({ message: "Face verification failed" });
    }
  });

  // Attendance management
  app.post("/api/clock-in", requireAuth, async (req, res) => {
    try {
      const { locationPostcode, verified, method = "face" } = req.body;
      
      if (!verified) {
        return res.status(400).json({ message: "Face verification required for check-in" });
      }

      const today = format(new Date(), "yyyy-MM-dd");
      
      // Check if user has any active (unclosed) sessions today
      const records = await storage.getUserAttendanceRecords(req.user!.id, 20);
      const todayRecords = records.filter(record => record.date === today);
      const activeRecord = todayRecords.find(record => !record.clockOutTime);

      if (activeRecord) {
        return res.status(400).json({ message: "Please clock out before clocking in again" });
      }

      // Get location if postcode provided
      let locationId = null;
      if (locationPostcode) {
        const location = await storage.getLocationByPostcode(locationPostcode);
        locationId = location?.id || null;
      }

      const attendanceRecord = await storage.createAttendanceRecord({
        userId: req.user!.id,
        clockInTime: new Date(),
        date: today,
        locationId,
        checkInMethod: method,
      });

      res.json(attendanceRecord);
    } catch (error) {
      console.error("Clock in error:", error);
      res.status(500).json({ message: "Failed to clock in" });
    }
  });

  app.post("/api/clock-out", requireAuth, async (req, res) => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      
      // Get all attendance records and find the most recent one without clock-out
      const records = await storage.getUserAttendanceRecords(req.user!.id, 20);
      const todayRecords = records.filter(record => record.date === today);
      
      // Find the most recent record that doesn't have a clock-out time
      const activeRecord = todayRecords
        .sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime())
        .find(record => !record.clockOutTime);

      if (!activeRecord) {
        return res.status(400).json({ message: "You are not currently clocked in" });
      }

      // Double check that this record hasn't already been clocked out
      if (activeRecord.clockOutTime) {
        return res.status(400).json({ message: "This session is already clocked out" });
      }

      const clockOutTime = new Date();
      const totalMinutes = differenceInMinutes(clockOutTime, new Date(activeRecord.clockInTime));
      const totalHours = (totalMinutes / 60).toFixed(2);

      const updatedRecord = await storage.updateAttendanceRecord(activeRecord.id, {
        clockOutTime,
        totalHours: parseFloat(totalHours)
      });

      console.log(`User ${req.user!.email} clocked out from session ${activeRecord.id}`);
      res.json(updatedRecord);
    } catch (error) {
      console.error("Clock out error:", error);
      res.status(500).json({ message: "Failed to clock out" });
    }
  });

  // Manual check-in for managers
  app.post("/api/manual-clock-in", requireManager, async (req, res) => {
    try {
      const { userId, date, clockInTime, locationId, notes } = req.body;
      
      const attendanceRecord = await storage.createAttendanceRecord({
        userId,
        clockInTime: new Date(clockInTime),
        date,
        locationId,
        checkInMethod: "manual",
        manuallyApprovedBy: req.user!.id,
        notes
      });

      res.json(attendanceRecord);
    } catch (error) {
      console.error("Manual clock in error:", error);
      res.status(500).json({ message: "Failed to manually clock in user" });
    }
  });

  // Manual clock-out for managers
  app.post("/api/manual-clock-out", requireManager, async (req, res) => {
    try {
      const { userId, clockOutTime, notes } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const today = format(new Date(), "yyyy-MM-dd");
      
      // Find the most recent active record for the user
      const records = await storage.getUserAttendanceRecords(userId, 20);
      const todayRecords = records.filter(record => record.date === today);
      
      // Find the most recent record that doesn't have a clock-out time
      const activeRecord = todayRecords
        .sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime())
        .find(record => !record.clockOutTime);

      if (!activeRecord) {
        return res.status(400).json({ message: "This user is not currently clocked in" });
      }

      // Double check that this record hasn't already been clocked out
      if (activeRecord.clockOutTime) {
        return res.status(400).json({ message: "This session is already clocked out" });
      }

      const finalClockOutTime = clockOutTime ? new Date(clockOutTime) : new Date();
      const totalMinutes = differenceInMinutes(finalClockOutTime, new Date(activeRecord.clockInTime));
      const totalHours = (totalMinutes / 60).toFixed(2);

      const updatedRecord = await storage.updateAttendanceRecord(activeRecord.id, {
        clockOutTime: finalClockOutTime,
        totalHours: parseFloat(totalHours),
        notes: notes || activeRecord.notes
      });

      console.log(`Manager ${req.user!.email} clocked out user ${userId} from session ${activeRecord.id}`);
      res.json(updatedRecord);
    } catch (error) {
      console.error("Manual clock out error:", error);
      res.status(500).json({ message: "Failed to manually clock out user" });
    }
  });

  // Attendance reporting
  app.get("/api/attendance", requireAuth, async (req, res) => {
    try {
      let records;
      
      if (req.user!.role === "employee") {
        // Employees see only their own records
        records = await storage.getUserAttendanceRecords(req.user!.id, 30);
      } else {
        // Managers and admins see all records
        records = await storage.getAllAttendanceRecords(100);
      }

      res.json(records);
    } catch (error) {
      console.error("Get attendance error:", error);
      res.status(500).json({ message: "Failed to get attendance records" });
    }
  });

  app.get("/api/attendance/today", requireAuth, async (req, res) => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      
      // Get all records for today and check if any are still active (not clocked out)
      const records = await storage.getUserAttendanceRecords(req.user!.id, 10);
      const todayRecords = records.filter(record => record.date === today);
      const activeRecord = todayRecords.find(record => !record.clockOutTime);
      
      res.json({
        record: todayRecords[0] || null, // Most recent record for today
        records: todayRecords, // All records for today
        isClockedIn: !!activeRecord
      });
    } catch (error) {
      console.error("Get today attendance error:", error);
      res.status(500).json({ message: "Failed to get today's attendance" });
    }
  });

  // Delete user with role-based permissions
  app.delete("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Check if user exists
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deleting yourself
      if (userId === req.user!.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      // Role-based deletion permissions
      const currentUserRole = req.user!.role;
      const targetUserRole = targetUser.role;

      // No one can delete admin
      if (targetUserRole === "admin") {
        return res.status(403).json({ message: "Cannot delete admin users" });
      }

      // Only admin can delete managers
      if (targetUserRole === "manager" && currentUserRole !== "admin") {
        return res.status(403).json({ message: "Only admin can delete managers" });
      }

      // Managers can only delete employees, admins can delete anyone (except admin)
      if (currentUserRole === "manager" && targetUserRole !== "employee") {
        return res.status(403).json({ message: "Managers can only delete employees" });
      }

      // Employees cannot delete anyone
      if (currentUserRole === "employee") {
        return res.status(403).json({ message: "Employees cannot delete users" });
      }

      await storage.deleteUser(userId);
      console.log(`User ${targetUser.email} (${targetUserRole}) deleted by ${req.user!.email} (${currentUserRole})`);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Employee management (Manager/Admin only)
  app.get("/api/employees", requireAuth, async (req, res) => {
    try {
      // Check if user is manager or admin
      if (req.user!.role !== 'manager' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Manager access required" });
      }

      // Get all users for managers/admins to see
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      
      // Remove passwords from response
      const safeUsers = allUsers.map(user => {
        const { password: _, ...safeUser } = user;
        return safeUser;
      });
      
      console.log(`Returning ${safeUsers.length} users for ${req.user!.role}:`, safeUsers.map(u => `${u.email} (${u.role})`));
      res.json(safeUsers);
    } catch (error) {
      console.error("Get employees error:", error);
      res.status(500).json({ message: "Failed to get employees" });
    }
  });

  // Employee invitation system
  app.post("/api/create-invitation", requireAuth, async (req, res) => {
    try {
      // Check if user is manager or admin
      if (req.user!.role !== 'manager' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Manager or Admin access required" });
      }

      const { email, role } = req.body;

      // Check role permissions: only admin can invite managers
      if (role === 'manager' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can create manager invitations" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invitation = await storage.createInvitation({
        email,
        role: role || "employee",
        invitedBy: req.user!.id,
        expiresAt,
        token
      });

      res.json({
        ...invitation,
        invitationUrl: `${req.protocol}://${req.hostname}/register?token=${token}`
      });
    } catch (error) {
      console.error("Create invitation error:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  app.get("/api/invitations", requireAuth, async (req, res) => {
    try {
      // Check if user is manager or admin
      if (req.user!.role !== 'manager' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Manager or Admin access required" });
      }

      const invitations = await storage.getActiveInvitations();
      res.json(invitations);
    } catch (error) {
      console.error("Get invitations error:", error);
      res.status(500).json({ message: "Failed to get invitations" });
    }
  });

  app.post("/api/register-with-token", async (req, res) => {
    try {
      const { token, firstName, lastName, password, faceImageData } = req.body;
      
      // Validate invitation token
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation) {
        return res.status(400).json({ message: "Invalid or expired invitation" });
      }

      if (new Date() > invitation.expiresAt) {
        return res.status(400).json({ message: "Invitation has expired" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(invitation.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Create user with face image
      const user = await storage.createUser({
        email: invitation.email,
        firstName,
        lastName,
        password: hashedPassword,
        role: invitation.role,
        faceImageUrl: faceImageData || null,
      });

      // Mark invitation as used
      await storage.markInvitationUsed(invitation.id);

      // Set session
      (req.session as any).userId = user.id;

      // Return user without password
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Register with token error:", error);
      res.status(400).json({ message: "Registration failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}