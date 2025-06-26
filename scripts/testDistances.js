#!/usr/bin/env node

/**
 * Test script for face recognition distance calculations
 * Tests genuine and impostor comparisons to verify the face verification pipeline
 */

import { face_distance, normalizeEmbedding } from '../server/lib/faceCompare.js';

// Generate test embeddings that simulate real face descriptors
function generateTestEmbedding(seed, variance = 0.1) {
  const embedding = new Array(128);
  let rng = seed;
  
  for (let i = 0; i < 128; i++) {
    // Linear congruential generator for reproducible random numbers
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    embedding[i] = (rng / 0x7fffffff - 0.5) * 2; // Range [-1, 1]
  }
  
  // Add some noise for variance
  for (let i = 0; i < 128; i++) {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    const noise = (rng / 0x7fffffff - 0.5) * variance;
    embedding[i] += noise;
  }
  
  return normalizeEmbedding(embedding);
}

function runDistanceTests() {
  console.log('=== Face Recognition Distance Test ===\n');
  
  // Test 1: Genuine pair (same person, different photos)
  console.log('Test 1: Genuine Pair (Same Person)');
  const person1_photo1 = generateTestEmbedding(12345, 0.05); // Low variance = same person
  const person1_photo2 = generateTestEmbedding(12345, 0.08); // Slightly different lighting/angle
  
  const genuineDistance = face_distance(person1_photo1, person1_photo2);
  console.log(`Person 1 Photo 1 vs Photo 2:`);
  console.log(`Distance: ${genuineDistance.toFixed(4)}`);
  console.log(`Expected: < 0.6 (should MATCH)`);
  console.log(`Result: ${genuineDistance <= 0.6 ? 'MATCH ✓' : 'NO MATCH ✗'}\n`);
  
  // Test 2: Impostor pair (different people)
  console.log('Test 2: Impostor Pair (Different People)');
  const person1_embedding = generateTestEmbedding(12345, 0.05);
  const person2_embedding = generateTestEmbedding(67890, 0.05); // Different seed = different person
  
  const impostorDistance = face_distance(person1_embedding, person2_embedding);
  console.log(`Person 1 vs Person 2:`);
  console.log(`Distance: ${impostorDistance.toFixed(4)}`);
  console.log(`Expected: > 0.6 (should NOT match)`);
  console.log(`Result: ${impostorDistance > 0.6 ? 'NO MATCH ✓' : 'MATCH ✗'}\n`);
  
  // Test 3: Multiple genuine comparisons
  console.log('Test 3: Multiple Genuine Comparisons');
  const baseEmbedding = generateTestEmbedding(55555, 0.02);
  
  for (let i = 1; i <= 3; i++) {
    const variation = generateTestEmbedding(55555 + i, 0.06);
    const distance = face_distance(baseEmbedding, variation);
    console.log(`Variation ${i}: Distance = ${distance.toFixed(4)} (${distance <= 0.6 ? 'MATCH' : 'NO MATCH'})`);
  }
  
  console.log('\n=== Test Summary ===');
  console.log(`Threshold: 0.6`);
  console.log(`Genuine distance: ${genuineDistance.toFixed(4)} ${genuineDistance <= 0.6 ? '(PASS)' : '(FAIL)'}`);
  console.log(`Impostor distance: ${impostorDistance.toFixed(4)} ${impostorDistance > 0.6 ? '(PASS)' : '(FAIL)'}`);
  
  const allTestsPassed = genuineDistance <= 0.6 && impostorDistance > 0.6;
  console.log(`\nOverall: ${allTestsPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`);
  
  return allTestsPassed;
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    runDistanceTests();
  } catch (error) {
    console.error('Test failed with error:', error.message);
    process.exit(1);
  }
}

export { runDistanceTests };