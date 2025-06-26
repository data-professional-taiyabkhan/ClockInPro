#!/usr/bin/env node

/**
 * Test script to debug face recognition distance calculations
 * This will help identify why the system gives 0.27 instead of 0.6 for different people
 */

import { spawn } from 'child_process';
import fs from 'fs';

async function testFaceRecognition() {
  console.log('=== FACE RECOGNITION DEBUGGING TEST ===');
  
  // Test 1: Generate encoding from a test image
  console.log('\n1. Testing face encoding generation...');
  
  const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  
  try {
    const encoding1 = await generateEncoding(testImageBase64);
    console.log('Test encoding 1 generated:', encoding1 ? 'SUCCESS' : 'FAILED');
    
    if (encoding1) {
      console.log('Encoding dimensions:', encoding1.length);
      
      // Test 2: Generate another encoding from the same image
      const encoding2 = await generateEncoding(testImageBase64);
      console.log('Test encoding 2 generated:', encoding2 ? 'SUCCESS' : 'FAILED');
      
      if (encoding2) {
        // Test 3: Compare identical images (should give distance ~0)
        const identicalDistance = await compareEncodings(encoding1, testImageBase64);
        console.log('Identical image comparison distance:', identicalDistance);
        
        // Test 4: Test with different encodings
        const differentEncoding = encoding1.map(val => val + 0.1); // Slightly modify
        const differentDistance = calculateEuclideanDistance(encoding1, differentEncoding);
        console.log('Different encoding distance:', differentDistance);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
  
  console.log('\n=== TEST COMPLETE ===');
}

function generateEncoding(imageData) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['server/face_recognition_service.py', 'encode'], {
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
            resolve(result.encoding);
          } else {
            reject(new Error(result.error || 'Encoding generation failed'));
          }
        } catch (parseError) {
          reject(new Error(`Invalid response: ${output}`));
        }
      } else {
        reject(new Error(`Process failed: ${errorOutput}`));
      }
    });
    
    const inputData = JSON.stringify({ image_data: imageData });
    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();
  });
}

function compareEncodings(knownEncoding, unknownImage) {
  return new Promise((resolve, reject) => {
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
            resolve(result.result.distance);
          } else {
            reject(new Error(result.error || 'Comparison failed'));
          }
        } catch (parseError) {
          reject(new Error(`Invalid response: ${output}`));
        }
      } else {
        reject(new Error(`Process failed: ${errorOutput}`));
      }
    });
    
    const inputData = JSON.stringify({
      known_encoding: knownEncoding,
      unknown_image: unknownImage,
      tolerance: 0.6
    });
    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();
  });
}

function calculateEuclideanDistance(encoding1, encoding2) {
  if (encoding1.length !== encoding2.length) {
    throw new Error('Encoding dimensions do not match');
  }
  
  let sum = 0;
  for (let i = 0; i < encoding1.length; i++) {
    const diff = encoding1[i] - encoding2[i];
    sum += diff * diff;
  }
  
  return Math.sqrt(sum);
}

// Run the test
testFaceRecognition().catch(console.error);