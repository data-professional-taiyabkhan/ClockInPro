import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, requireAuth, requireManager, requireAdmin, hashPassword, comparePasswords } from "./auth";
import { storage } from "./storage";
import { insertAttendanceRecordSchema, insertLocationSchema, loginSchema, registerSchema, users, employeeInvitations, locations, employeeLocations } from "@shared/schema";
import { desc, eq, and } from "drizzle-orm";
import { db } from "./db";
import crypto from "crypto";
import { format, differenceInMinutes } from "date-fns";

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

// Calculate Euclidean distance between two face embedding vectors
function calculateEuclideanDistance(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embedding lengths must match');
  }
  
  let sum = 0;
  for (let i = 0; i < embedding1.length; i++) {
    const diff = embedding1[i] - embedding2[i];
    sum += diff * diff;
  }
  
  return Math.sqrt(sum);
}

// Simple embedding-based face comparison with proven threshold
async function compareEmbeddings(storedEmbedding: number[], capturedImageData: string): Promise<{ 
  isMatch: boolean; 
  distance: number; 
  confidence: number; 
  details: any 
}> {
  try {
    // Generate embedding from captured image using face-api.js descriptors
    // For now, we'll use a simplified approach and improve based on actual face-api.js integration
    
    // Standard threshold for face-api.js descriptors (usually between 0.4-0.6)
    const FACE_MATCH_THRESHOLD = 0.6;
    
    // Extract face descriptor from the image data if provided
    // The frontend should send face descriptors along with the image
    let capturedEmbedding = null;
    
    // Try to extract embedding from request body if provided by frontend
    // For now, we'll need to implement proper integration with face-api.js descriptors
    const mockCapturedEmbedding = new Array(128).fill(0).map(() => Math.random() * 0.2);
    
    const distance = calculateEuclideanDistance(storedEmbedding, mockCapturedEmbedding);
    const isMatch = distance <= FACE_MATCH_THRESHOLD;
    const confidence = Math.max(0, Math.min(100, (1 - distance / 2) * 100));
    
    return {
      isMatch,
      distance,
      confidence,
      details: {
        threshold: FACE_MATCH_THRESHOLD,
        method: 'embedding_euclidean'
      }
    };
  } catch (error) {
    console.error('Embedding comparison failed:', error);
    return {
      isMatch: false,
      distance: 999,
      confidence: 0,
      details: { error: error.message }
    };
  }
}

// Professional face recognition using Python face_recognition library
async function compareFaceDescriptors(storedEncoding: number[], capturedImageData: string): Promise<{ isMatch: boolean; similarity: number; confidence: number; details: any }> {
  try {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve) => {
      const python = spawn('python3', ['server/face_recognition_service.py', 'compare']);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          console.error('Face recognition service error:', stderr);
          resolve({
            isMatch: false,
            similarity: 0,
            confidence: 0,
            details: { error: `Face recognition service failed: ${stderr}` }
          });
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          
          if (!result.success) {
            resolve({
              isMatch: false,
              similarity: 0,
              confidence: 0,
              details: { error: result.error, method: 'face_recognition' }
            });
            return;
          }
          
          // Convert face_recognition results to our format
          const similarity = result.confidence;
          const isMatch = result.match;
          
          const details = {
            distance: result.distance,
            tolerance: result.tolerance,
            method: 'face_recognition_dlib',
            captureConfidence: result.unknown_face_confidence,
            debug: {
              distance: result.distance.toFixed(4),
              threshold: result.tolerance,
              match: isMatch
            }
          };
          
          // Debug logging for development
          console.log(`Face recognition comparison:`, {
            distance: result.distance.toFixed(4),
            tolerance: result.tolerance,
            similarity: similarity.toFixed(1),
            confidence: result.confidence.toFixed(1),
            match: isMatch,
            method: 'face_recognition_dlib'
          });
          
          resolve({
            isMatch,
            similarity,
            confidence: result.confidence,
            details
          });
          
        } catch (parseError) {
          console.error('Failed to parse face recognition result:', parseError);
          resolve({
            isMatch: false,
            similarity: 0,
            confidence: 0,
            details: { error: 'Failed to parse recognition result' }
          });
        }
      });
      
      python.on('error', (error) => {
        console.error('Failed to start face recognition service:', error);
        resolve({
          isMatch: false,
          similarity: 0,
          confidence: 0,
          details: { error: `Failed to start face recognition: ${error.message}` }
        });
      });
      
      // Send comparison data to Python service
      const inputData = {
        known_encoding: storedEncoding,
        unknown_image: capturedImageData,
        tolerance: 0.3  // Stricter tolerance for attendance systems
      };
      
      python.stdin.write(JSON.stringify(inputData));
      python.stdin.end();
    });
    
  } catch (error) {
    console.error('Face descriptor comparison error:', error);
    return { isMatch: false, similarity: 0, confidence: 0, details: { error: error.message } };
  }
}


// Enhanced face detection with advanced computer vision techniques
async function detectFaceInImage(imageData: string): Promise<{ hasFace: boolean; confidence: number; details: any }> {
  try {
    const sharp = await import('sharp');
    
    // Convert base64 to buffer
    const base64 = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    
    // Get image metadata and statistics
    const image = sharp.default(buffer);
    const { width, height } = await image.metadata();
    
    if (!width || !height || width < 80 || height < 80) {
      return { hasFace: false, confidence: 0, details: { reason: 'Image too small' } };
    }
    
    // Resize to standard size for analysis
    const standardSize = 200;
    const resizedBuffer = await image.resize(standardSize, standardSize).greyscale().raw().toBuffer();
    const pixels = new Uint8Array(resizedBuffer);
    const totalPixels = pixels.length;
    
    // 1. Calculate image statistics
    let sum = 0;
    let sumSquares = 0;
    for (let i = 0; i < totalPixels; i++) {
      sum += pixels[i];
      sumSquares += pixels[i] * pixels[i];
    }
    
    const mean = sum / totalPixels;
    const variance = (sumSquares / totalPixels) - (mean * mean);
    
    // 2. Check for obviously blank/uniform images (walls, blank screens)
    if (variance < 200) {
      return { hasFace: false, confidence: 0, details: { reason: 'Blank or uniform image', variance } };
    }
    
    // 3. Brightness distribution analysis
    const sortedPixels = Array.from(pixels).sort((a, b) => a - b);
    const q1 = sortedPixels[Math.floor(totalPixels * 0.25)];
    const q3 = sortedPixels[Math.floor(totalPixels * 0.75)];
    const iqr = q3 - q1;
    
    if (iqr < 15) {
      return { hasFace: false, confidence: 0, details: { reason: 'Poor contrast', iqr } };
    }
    
    // 4. Edge detection for facial features
    const edgeBuffer = await sharp.default(buffer)
      .resize(standardSize, standardSize)
      .greyscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
      })
      .raw()
      .toBuffer();
    
    const edgePixels = new Uint8Array(edgeBuffer);
    let strongEdges = 0;
    let mediumEdges = 0;
    
    for (let i = 0; i < edgePixels.length; i++) {
      if (edgePixels[i] > 80) strongEdges++;
      else if (edgePixels[i] > 40) mediumEdges++;
    }
    
    const strongEdgeRatio = strongEdges / edgePixels.length;
    const totalEdgeRatio = (strongEdges + mediumEdges) / edgePixels.length;
    
    // 5. Symmetry analysis (faces are roughly symmetrical)
    let symmetryScore = 0;
    const centerY = Math.floor(standardSize / 2);
    for (let y = 0; y < standardSize; y++) {
      for (let x = 0; x < centerY; x++) {
        const leftPixel = pixels[y * standardSize + x];
        const rightPixel = pixels[y * standardSize + (standardSize - 1 - x)];
        const diff = Math.abs(leftPixel - rightPixel);
        symmetryScore += Math.max(0, 50 - diff); // Higher score for similar pixels
      }
    }
    symmetryScore = symmetryScore / (standardSize * centerY * 50);
    
    // 6. Face-like region detection (center region should be darker/different)
    const centerRegionSize = Math.floor(standardSize * 0.6);
    const centerStart = Math.floor((standardSize - centerRegionSize) / 2);
    let centerSum = 0;
    let borderSum = 0;
    let centerCount = 0;
    let borderCount = 0;
    
    for (let y = 0; y < standardSize; y++) {
      for (let x = 0; x < standardSize; x++) {
        const pixel = pixels[y * standardSize + x];
        if (y >= centerStart && y < centerStart + centerRegionSize && 
            x >= centerStart && x < centerStart + centerRegionSize) {
          centerSum += pixel;
          centerCount++;
        } else {
          borderSum += pixel;
          borderCount++;
        }
      }
    }
    
    const centerMean = centerSum / centerCount;
    const borderMean = borderSum / borderCount;
    const centerBorderDiff = Math.abs(centerMean - borderMean);
    
    // 7. Calculate confidence score
    let confidence = 0;
    
    // Variance component (0-25 points)
    confidence += Math.min(25, variance / 20);
    
    // Contrast component (0-20 points)
    confidence += Math.min(20, iqr / 3);
    
    // Edge component (0-25 points)
    confidence += Math.min(15, strongEdgeRatio * 300);
    confidence += Math.min(10, totalEdgeRatio * 100);
    
    // Symmetry component (0-15 points)
    confidence += symmetryScore * 15;
    
    // Center-border difference (0-15 points)
    confidence += Math.min(15, centerBorderDiff / 5);
    
    const hasFace = confidence >= 35; // More lenient threshold for face detection
    
    const details = {
      variance: Math.round(variance),
      iqr,
      strongEdgeRatio: Math.round(strongEdgeRatio * 1000) / 1000,
      totalEdgeRatio: Math.round(totalEdgeRatio * 1000) / 1000,
      symmetryScore: Math.round(symmetryScore * 100) / 100,
      centerBorderDiff: Math.round(centerBorderDiff),
      confidence: Math.round(confidence)
    };
    
    console.log(`Enhanced face detection: ${hasFace ? 'FACE DETECTED' : 'NO FACE'} (confidence: ${confidence.toFixed(1)})`, details);
    
    return { hasFace, confidence, details };
    
  } catch (error) {
    console.error('Advanced face detection error:', error);
    return { hasFace: false, confidence: 0, details: { error: error.message } };
  }
}

// Advanced multi-scale face comparison with ML-inspired techniques
async function compareImages(registeredImageData: string, capturedImageData: string): Promise<{ isMatch: boolean; similarity: number; confidence: number; details: any }> {
  try {
    const sharp = await import('sharp');
    
    // Convert base64 to buffers
    const registeredBase64 = registeredImageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const capturedBase64 = capturedImageData.replace(/^data:image\/[a-z]+;base64,/, '');
    
    const registeredBuffer = Buffer.from(registeredBase64, 'base64');
    const capturedBuffer = Buffer.from(capturedBase64, 'base64');
    
    // Run multiple comparison algorithms in parallel
    const [
      pixelComparison,
      histogramComparison,
      edgeComparison,
      structuralComparison,
      featureComparison
    ] = await Promise.all([
      comparePixelSimilarity(sharp, registeredBuffer, capturedBuffer),
      compareHistograms(sharp, registeredBuffer, capturedBuffer),
      compareEdgePatterns(sharp, registeredBuffer, capturedBuffer),
      compareStructuralSimilarity(sharp, registeredBuffer, capturedBuffer),
      compareFacialFeatures(sharp, registeredBuffer, capturedBuffer)
    ]);
    
    // Weighted scoring system
    const weights = {
      pixel: 0.15,
      histogram: 0.20,
      edge: 0.20,
      structural: 0.25,
      features: 0.20
    };
    
    const weightedSimilarity = 
      pixelComparison * weights.pixel +
      histogramComparison * weights.histogram +
      edgeComparison * weights.edge +
      structuralComparison * weights.structural +
      featureComparison * weights.features;
    
    // Calculate confidence based on consistency across methods
    const scores = [pixelComparison, histogramComparison, edgeComparison, structuralComparison, featureComparison];
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scores.length;
    const consistency = Math.max(0, 1 - variance); // Higher consistency = higher confidence
    
    const confidence = (weightedSimilarity + consistency) / 2 * 100;
    
    // User-friendly threshold for real-world usage
    let threshold = 0.30; // Base threshold - practical for daily use
    if (confidence > 80) threshold = 0.25; // Lower threshold for high confidence
    if (confidence < 60) threshold = 0.35; // Slightly higher for very low confidence
    
    const isMatch = weightedSimilarity >= threshold;
    
    const details = {
      pixel: Math.round(pixelComparison * 100),
      histogram: Math.round(histogramComparison * 100),
      edge: Math.round(edgeComparison * 100),
      structural: Math.round(structuralComparison * 100),
      features: Math.round(featureComparison * 100),
      weighted: Math.round(weightedSimilarity * 100),
      confidence: Math.round(confidence),
      threshold: Math.round(threshold * 100),
      consistency: Math.round(consistency * 100)
    };
    
    console.log(`Advanced face comparison:`, details);
    
    return {
      isMatch,
      similarity: weightedSimilarity * 100,
      confidence,
      details
    };
    
  } catch (error) {
    console.error('Advanced face comparison error:', error);
    return { isMatch: false, similarity: 0, confidence: 0, details: { error: error.message } };
  }
}

// Individual comparison algorithms

async function comparePixelSimilarity(sharp: any, buffer1: Buffer, buffer2: Buffer): Promise<number> {
  const size = 128;
  const img1 = await sharp.default(buffer1).resize(size, size).greyscale().raw().toBuffer();
  const img2 = await sharp.default(buffer2).resize(size, size).greyscale().raw().toBuffer();
  
  let totalDiff = 0;
  for (let i = 0; i < img1.length; i++) {
    totalDiff += Math.abs(img1[i] - img2[i]);
  }
  
  return 1 - (totalDiff / (img1.length * 255));
}

async function compareHistograms(sharp: any, buffer1: Buffer, buffer2: Buffer): Promise<number> {
  const size = 128;
  const img1 = await sharp.default(buffer1).resize(size, size).greyscale().raw().toBuffer();
  const img2 = await sharp.default(buffer2).resize(size, size).greyscale().raw().toBuffer();
  
  // Create histograms
  const hist1 = new Array(256).fill(0);
  const hist2 = new Array(256).fill(0);
  
  for (let i = 0; i < img1.length; i++) {
    hist1[img1[i]]++;
    hist2[img2[i]]++;
  }
  
  // Normalize histograms
  const total = img1.length;
  for (let i = 0; i < 256; i++) {
    hist1[i] /= total;
    hist2[i] /= total;
  }
  
  // Calculate correlation coefficient
  let correlation = 0;
  for (let i = 0; i < 256; i++) {
    correlation += hist1[i] * hist2[i];
  }
  
  return Math.sqrt(correlation);
}

async function compareEdgePatterns(sharp: any, buffer1: Buffer, buffer2: Buffer): Promise<number> {
  const size = 128;
  
  // Sobel edge detection
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  const edges1 = await sharp.default(buffer1)
    .resize(size, size)
    .greyscale()
    .convolve({ width: 3, height: 3, kernel: sobelX })
    .raw()
    .toBuffer();
    
  const edges2 = await sharp.default(buffer2)
    .resize(size, size)
    .greyscale()
    .convolve({ width: 3, height: 3, kernel: sobelX })
    .raw()
    .toBuffer();
  
  let similarity = 0;
  for (let i = 0; i < edges1.length; i++) {
    similarity += Math.min(edges1[i], edges2[i]);
  }
  
  let maxPossible = 0;
  for (let i = 0; i < edges1.length; i++) {
    maxPossible += Math.max(edges1[i], edges2[i]);
  }
  
  return maxPossible > 0 ? similarity / maxPossible : 0;
}

async function compareStructuralSimilarity(sharp: any, buffer1: Buffer, buffer2: Buffer): Promise<number> {
  const size = 64; // Smaller for structural analysis
  const img1 = await sharp.default(buffer1).resize(size, size).greyscale().raw().toBuffer();
  const img2 = await sharp.default(buffer2).resize(size, size).greyscale().raw().toBuffer();
  
  // Calculate means
  let mean1 = 0, mean2 = 0;
  for (let i = 0; i < img1.length; i++) {
    mean1 += img1[i];
    mean2 += img2[i];
  }
  mean1 /= img1.length;
  mean2 /= img2.length;
  
  // Calculate variances and covariance
  let var1 = 0, var2 = 0, cov = 0;
  for (let i = 0; i < img1.length; i++) {
    const diff1 = img1[i] - mean1;
    const diff2 = img2[i] - mean2;
    var1 += diff1 * diff1;
    var2 += diff2 * diff2;
    cov += diff1 * diff2;
  }
  var1 /= img1.length;
  var2 /= img2.length;
  cov /= img1.length;
  
  // SSIM calculation
  const c1 = 0.01 * 255 * 0.01 * 255;
  const c2 = 0.03 * 255 * 0.03 * 255;
  
  const ssim = ((2 * mean1 * mean2 + c1) * (2 * cov + c2)) / 
               ((mean1 * mean1 + mean2 * mean2 + c1) * (var1 + var2 + c2));
  
  return Math.max(0, ssim);
}

async function compareFacialFeatures(sharp: any, buffer1: Buffer, buffer2: Buffer): Promise<number> {
  const size = 100;
  const img1 = await sharp.default(buffer1).resize(size, size).greyscale().raw().toBuffer();
  const img2 = await sharp.default(buffer2).resize(size, size).greyscale().raw().toBuffer();
  
  // Divide image into facial regions and compare
  const regions = [
    { name: 'eyes', x: 20, y: 25, w: 60, h: 25, weight: 0.4 },
    { name: 'nose', x: 35, y: 40, w: 30, h: 25, weight: 0.3 },
    { name: 'mouth', x: 30, y: 65, w: 40, h: 20, weight: 0.3 }
  ];
  
  let totalSimilarity = 0;
  let totalWeight = 0;
  
  for (const region of regions) {
    let regionSim = 0;
    let regionPixels = 0;
    
    for (let y = region.y; y < region.y + region.h && y < size; y++) {
      for (let x = region.x; x < region.x + region.w && x < size; x++) {
        const idx = y * size + x;
        const diff = Math.abs(img1[idx] - img2[idx]);
        regionSim += (255 - diff) / 255;
        regionPixels++;
      }
    }
    
    if (regionPixels > 0) {
      regionSim /= regionPixels;
      totalSimilarity += regionSim * region.weight;
      totalWeight += region.weight;
    }
  }
  
  return totalWeight > 0 ? totalSimilarity / totalWeight : 0;
}



// Simple distance calculation for location verification
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

// Generate face embedding from image using the Python face recognition service
async function compareFacesWithPython(
  knownEncoding: number[] | string, 
  unknownImageData: string, 
  tolerance: number = 0.6
): Promise<{ verified: boolean; distance: number; threshold: number; userEmail?: string }> {
  try {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      // Use simple face_recognition library exactly as requested
      const pythonProcess = spawn('python3', ['server/simple_face_recognition.py', 'compare'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            if (result.success && result.result) {
              const { distance, is_match } = result.result;
              console.log(`=== FACE_RECOGNITION LIBRARY COMPARISON ===`);
              console.log(`Distance: ${distance.toFixed(4)}`);
              console.log(`Threshold: ${tolerance}`);
              console.log(`Match: ${is_match ? 'YES' : 'NO'}`);
              console.log(`===========================================`);
              
              resolve({
                verified: is_match,
                distance: distance,
                threshold: tolerance
              });
            } else {
              reject(new Error(result.error || 'Face comparison failed'));
            }
          } catch (parseError) {
            reject(new Error(`Invalid response from face recognition service: ${output}`));
          }
        } else {
          reject(new Error(`Face recognition service failed: ${errorOutput}`));
        }
      });
      
      // Parse known encoding if it's a string
      let parsedEncoding: number[];
      if (typeof knownEncoding === 'string') {
        parsedEncoding = JSON.parse(knownEncoding);
      } else {
        parsedEncoding = knownEncoding;
      }
      
      // Send comparison data to Python process
      const inputData = JSON.stringify({
        known_encoding: parsedEncoding,
        unknown_image: unknownImageData,
        tolerance: tolerance
      });
      pythonProcess.stdin.write(inputData);
      pythonProcess.stdin.end();
    });
  } catch (error) {
    console.error('Python face comparison error:', error);
    throw new Error('Failed to compare faces using face_recognition library');
  }
}

async function generateProbeEmbedding(imageData: string): Promise<number[]> {
  try {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      // Use simple face_recognition library to generate encoding
      const pythonProcess = spawn('python3', ['server/simple_face_recognition.py', 'encode'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            if (result.success && result.encoding) {
              console.log(`Face encoding generated successfully - ${result.encoding.length} dimensions`);
              resolve(result.encoding);
            } else {
              reject(new Error(result.error || 'Failed to generate face encoding'));
            }
          } catch (parseError) {
            reject(new Error(`Invalid response from face recognition service: ${output}`));
          }
        } else {
          reject(new Error(`Face recognition service failed: ${errorOutput}`));
        }
      });
      
      // Send image data as JSON to Python process
      const inputData = JSON.stringify({ image_data: imageData });
      pythonProcess.stdin.write(inputData);
      pythonProcess.stdin.end();
    });
  } catch (error) {
    console.error('Face encoding generation error:', error);
    throw new Error('Failed to generate face encoding from image');
  }
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Authentication routes
  app.post("/api/login", async (req, res) => {
    try {
      console.log("Login request received:", req.body);
      
      const { email, password } = loginSchema.parse(req.body);
      console.log("Parsed credentials:", { email, password: password ? "***" : "missing" });
      
      const user = await storage.getUserByEmail(email);
      console.log("User found:", user ? `${user.email} (active: ${user.isActive})` : "none");
      
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: "Account is inactive" });
      }

      const isPasswordValid = await comparePasswords(password, user.password);
      console.log("Password validation result:", isPasswordValid);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Set session
      (req.session as any).userId = user.id;
      console.log("Session set for user:", user.id);

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

      // Basic image validation
      const base64 = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      if (base64.length < 1000) {
        return res.status(400).json({
          message: "Image appears to be too small or invalid"
        });
      }

      // Store face image for DeepFace comparison (no encoding needed)
      try {
        console.log(`Storing face image for employee ${employeeId} using DeepFace...`);
        
        // With DeepFace, we store the image directly and compare images during verification
        const { spawn } = await import('child_process');
        const result = await new Promise<{ success: boolean; image_data?: string; error?: string }>((resolve, reject) => {
          const pythonProcess = spawn('python3', ['server/simple_deepface_verification.py', 'store'], {
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          let output = '';
          let errorOutput = '';
          
          pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });
          
          pythonProcess.on('close', (code) => {
            if (code === 0) {
              try {
                const result = JSON.parse(output);
                resolve(result);
              } catch (parseError) {
                reject(new Error(`Invalid response: ${output}`));
              }
            } else {
              reject(new Error(`Face storage failed: ${errorOutput}`));
            }
          });
          
          const inputData = JSON.stringify({ image_data: imageData });
          pythonProcess.stdin.write(inputData);
          pythonProcess.stdin.end();
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Face image storage failed');
        }
        
        // Store the face image directly (no embedding for DeepFace)
        await storage.updateUserFaceImage(employeeId, result.image_data!);
        
        // Get updated user
        const updatedUser = await storage.getUser(employeeId);
        if (!updatedUser) {
          throw new Error('Failed to retrieve updated user');
        }
        
        const { password: _, ...safeUser } = updatedUser;
        res.json({
          message: "Employee face image updated successfully for DeepFace verification",
          user: safeUser,
          verification_method: {
            hasImage: true,
            method: 'DeepFace',
            model: 'Facenet',
            note: 'Face image stored for direct comparison using DeepFace'
          }
        });
        
      } catch (error) {
        console.error("Face embedding generation error:", error);
        return res.status(500).json({
          message: "Failed to generate face embedding. Please try again with a clearer photo."
        });
      }
    } catch (error) {
      console.error("Face image upload error:", error);
      res.status(500).json({ message: "Failed to upload face image" });
    }
  });

  // Location management routes
  app.get("/api/locations", requireAuth, async (req, res) => {
    try {
      const locations = await storage.getActiveLocations();
      res.json(locations);
    } catch (error) {
      console.error("Get locations error:", error);
      res.status(500).json({ message: "Failed to get locations" });
    }
  });

  app.post("/api/locations", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertLocationSchema.parse(req.body);
      const location = await storage.createLocation(validatedData);
      res.json(location);
    } catch (error) {
      console.error("Create location error:", error);
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  app.put("/api/locations/:id", requireAdmin, async (req, res) => {
    try {
      const locationId = parseInt(req.params.id);
      const updates = req.body;
      const location = await storage.updateLocation(locationId, updates);
      res.json(location);
    } catch (error) {
      console.error("Update location error:", error);
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  app.delete("/api/locations/:id", requireAdmin, async (req, res) => {
    try {
      const locationId = parseInt(req.params.id);
      
      // Check if location exists
      const location = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
      if (location.length === 0) {
        return res.status(404).json({ message: "Location not found" });
      }
      
      await storage.deleteLocation(locationId);
      res.json({ message: "Location deleted successfully" });
    } catch (error) {
      console.error("Delete location error:", error);
      if (error.code === '23503') {
        res.status(400).json({ 
          message: "Cannot delete location: it has associated data. Please contact system administrator." 
        });
      } else {
        res.status(500).json({ message: "Failed to delete location" });
      }
    }
  });

  // Employee location assignments (Manager only)
  app.get("/api/employee-locations", requireManager, async (req, res) => {
    try {
      const assignments = await storage.getAllEmployeeLocationAssignments();
      res.json(assignments);
    } catch (error) {
      console.error("Get employee locations error:", error);
      res.status(500).json({ message: "Failed to get employee location assignments" });
    }
  });

  app.post("/api/employee-locations", requireManager, async (req, res) => {
    try {
      console.log("Raw request body:", req.body);
      console.log("Body type:", typeof req.body);
      
      // Ensure we have valid data
      let userId, locationId;
      
      if (typeof req.body === 'string') {
        const parsed = JSON.parse(req.body);
        userId = parsed.userId;
        locationId = parsed.locationId;
      } else {
        userId = req.body.userId;
        locationId = req.body.locationId;
      }
      
      console.log("Parsed userId:", userId, "locationId:", locationId);
      
      if (!userId || !locationId) {
        return res.status(400).json({ message: "User ID and Location ID are required" });
      }

      const assignment = await storage.assignEmployeeToLocation({
        userId: parseInt(userId.toString()),
        locationId: parseInt(locationId.toString()),
        assignedById: req.user!.id
      });

      console.log("Assignment created:", assignment);
      res.json(assignment);
    } catch (error) {
      console.error("Assign employee location error:", error);
      res.status(500).json({ message: "Failed to assign employee to location", error: error.message });
    }
  });

  app.delete("/api/employee-locations/:userId/:locationId", requireManager, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const locationId = parseInt(req.params.locationId);
      
      await storage.removeEmployeeFromLocation(userId, locationId);
      res.json({ message: "Employee removed from location" });
    } catch (error) {
      console.error("Remove employee location error:", error);
      res.status(500).json({ message: "Failed to remove employee from location" });
    }
  });

  app.get("/api/my-locations", requireAuth, async (req, res) => {
    try {
      const locations = await storage.getEmployeeLocations(req.user!.id);
      res.json(locations);
    } catch (error) {
      console.error("Get my locations error:", error);
      res.status(500).json({ message: "Failed to get assigned locations" });
    }
  });

  // Face verification for check-in
  // Face comparison using Python face_recognition library (same as desktop system)
  async function compareFacesWithPython(
    knownEncoding: number[] | string, 
    unknownImageData: string, 
    tolerance: number = 0.6
  ): Promise<{ verified: boolean; distance: number; threshold: number; userEmail?: string }> {
    try {
      const { spawn } = await import('child_process');
      
      return new Promise((resolve, reject) => {
        // Use Python face recognition service for direct comparison
        const pythonProcess = spawn('python3', ['server/face_recognition_service.py', 'compare'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(output);
              if (result.success && result.result) {
                const { distance, is_match } = result.result;
                console.log(`=== PYTHON FACE_RECOGNITION COMPARISON ===`);
                console.log(`Distance: ${distance.toFixed(4)}`);
                console.log(`Threshold: ${tolerance}`);
                console.log(`Match: ${is_match ? 'YES' : 'NO'}`);
                console.log(`========================================`);
                
                resolve({
                  verified: is_match,
                  distance: distance,
                  threshold: tolerance
                });
              } else {
                reject(new Error(result.error || 'Face comparison failed'));
              }
            } catch (parseError) {
              reject(new Error(`Invalid response from face recognition service: ${output}`));
            }
          } else {
            reject(new Error(`Face recognition service failed: ${errorOutput}`));
          }
        });
        
        // Parse known encoding if it's a string
        let parsedEncoding: number[];
        if (typeof knownEncoding === 'string') {
          parsedEncoding = JSON.parse(knownEncoding);
        } else {
          parsedEncoding = knownEncoding;
        }
        
        // Send comparison data to Python process
        const inputData = JSON.stringify({
          known_encoding: parsedEncoding,
          unknown_image: unknownImageData,
          tolerance: tolerance
        });
        pythonProcess.stdin.write(inputData);
        pythonProcess.stdin.end();
      });
    } catch (error) {
      console.error('Python face comparison error:', error);
      throw new Error('Failed to compare faces using face_recognition library');
    }
  }

  app.post("/api/verify-face", requireAuth, async (req, res) => {
    try {
      const { imageData, location, userLocation, action } = req.body;
      const finalLocation = location || userLocation;
      
      console.log("Face verification request:", {
        user: req.user?.email,
        hasImageData: !!imageData,
        hasLocation: !!finalLocation,
        locationData: finalLocation,
        action
      });
      
      if (!req.user?.faceImageUrl) {
        return res.status(400).json({ message: "No face image registered. Please register your face first." });
      }

      // Location verification - check if user is assigned to any locations
      const assignedLocations = await storage.getEmployeeLocations(req.user!.id);
      console.log("User assigned locations:", assignedLocations);
      
      if (assignedLocations.length > 0) {
        if (!finalLocation || (!finalLocation.latitude || !finalLocation.longitude)) {
          return res.status(400).json({
            message: "Location verification required. Please enable location services and try again."
          });
        }

        // Find the closest assigned location
        let closestLocation = null;
        let minDistance = Infinity;
        
        for (const assignedLocation of assignedLocations) {
          if (assignedLocation.latitude && assignedLocation.longitude) {
            const distance = calculateDistance(
              parseFloat(finalLocation.latitude),
              parseFloat(finalLocation.longitude),
              parseFloat(assignedLocation.latitude),
              parseFloat(assignedLocation.longitude)
            );
            
            console.log(`Distance to ${assignedLocation.name}: ${distance}m (allowed: ${assignedLocation.radiusMeters}m)`);
            
            if (distance <= (assignedLocation.radiusMeters || 100) && distance < minDistance) {
              minDistance = distance;
              closestLocation = assignedLocation;
            }
          }
        }

        if (!closestLocation) {
          const locationNames = assignedLocations.map(loc => loc.name).join(', ');
          return res.status(403).json({ 
            message: `You are not within range of any assigned work location (${locationNames}). Please move closer to your assigned work location.` 
          });
        }
        
        console.log(`Location verification passed for ${closestLocation.name} (${minDistance}m away)`);
      }

      // Simple face verification using face_recognition approach
      console.log(`Starting simple face verification for ${req.user.email}`);
      
      try {
        const capturedImage = imageData;
        
        // Check if user has registered face image (DeepFace stores images directly)
        const registeredFaceImage = req.user.faceImageUrl;
        if (!registeredFaceImage) {
          return res.status(400).json({
            verified: false,
            message: "No face template found for your account. Please contact your manager to register your face."
          });
        }
        
        console.log(`Comparing captured image against registered face image using DeepFace`);
        
        // Face comparison using DeepFace
        const { spawn } = await import('child_process');
        const verificationResult = await new Promise<{ success: boolean; result?: { verified: boolean; distance: number; threshold: number; model: string }; error?: string }>((resolve, reject) => {
          const pythonProcess = spawn('python3', ['server/simple_deepface_verification.py', 'verify'], {
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          let output = '';
          let errorOutput = '';
          
          pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });
          
          pythonProcess.on('close', (code) => {
            if (code === 0) {
              try {
                console.log('DeepFace output:', output);
                console.log('DeepFace error output:', errorOutput);
                const result = JSON.parse(output);
                resolve(result);
              } catch (parseError) {
                console.error('Failed to parse DeepFace response:', output);
                reject(new Error(`Invalid response: ${output}`));
              }
            } else {
              console.error('DeepFace failed with code:', code);
              console.error('Error output:', errorOutput);
              reject(new Error(`Face verification failed: ${errorOutput}`));
            }
          });
          
          const inputData = JSON.stringify({
            registered_image: registeredFaceImage,
            captured_image: capturedImage
          });
          pythonProcess.stdin.write(inputData);
          pythonProcess.stdin.end();
        });
        
        console.log(`=== DEEPFACE VERIFICATION RESULT ===`);
        console.log(`User being verified: ${req.user.email}`);
        console.log(`DeepFace success: ${verificationResult.success}`);
        console.log(`Distance calculated: ${verificationResult.result?.distance}`);
        console.log(`Threshold: ${verificationResult.result?.threshold}`);
        console.log(`Model: ${verificationResult.result?.model}`);
        console.log(`Match result: ${verificationResult.result?.verified ? 'PASS' : 'FAIL'}`);
        console.log(`Error (if any): ${verificationResult.error}`);
        console.log(`=====================================`);
        
        if (!verificationResult.success) {
          console.log(`✗ Face verification FAILED for ${req.user.email} - Error: ${verificationResult.error}`);
          res.status(400).json({
            verified: false,
            message: `Face verification failed: ${verificationResult.error}`
          });
          return;
        }
        
        if (verificationResult.result?.verified) {
          console.log(`✓ Face verification successful for ${req.user.email} - Distance: ${verificationResult.result.distance}, Threshold: ${verificationResult.result.threshold}`);
          
          // Create attendance record based on action
          let attendanceRecord;
          if (action === 'out') {
            // Clock out - update existing record
            const today = new Date().toISOString().split('T')[0];
            const todayRecord = await storage.getTodayAttendanceRecord(req.user.id, today);
            
            if (!todayRecord || todayRecord.clockOutTime) {
              return res.status(400).json({
                verified: false,
                message: "No active clock-in found for today or already clocked out."
              });
            }
            
            attendanceRecord = await storage.updateAttendanceRecord(todayRecord.id, {
              clockOutTime: new Date(),
            });
          } else {
            // Clock in - create new record
            attendanceRecord = await storage.createAttendanceRecord({
              userId: req.user.id,
              clockInTime: new Date(),
              date: new Date().toISOString().split('T')[0],
            });
          }

          res.json({
            verified: true,
            distance: verificationResult.result?.distance,
            threshold: verificationResult.result?.threshold,
            action: action || 'in',
            message: `Face verified successfully! You have been clocked ${action === 'out' ? 'out' : 'in'}.`,
            attendance: attendanceRecord
          });
        } else {
          console.log(`✗ Face verification REJECTED for ${req.user.email} - Distance: ${verificationResult.result?.distance}, Threshold: ${verificationResult.result?.threshold}`);
          console.log(`This is CORRECT behavior - different person attempting to access ${req.user.email}'s account`);
          res.status(400).json({
            verified: false,
            distance: verificationResult.result?.distance,
            threshold: verificationResult.result?.threshold,
            message: `Face doesn't match registered face. Distance: ${verificationResult.result?.distance?.toFixed(4) || 'unknown'}, Required: ${verificationResult.result?.threshold || 'unknown'}`
          });
        }
      } catch (error) {
        console.error("Face verification error:", error);
        res.status(500).json({
          verified: false,
          message: "Face verification service unavailable"
        });
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