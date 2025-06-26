#!/usr/bin/env python3
"""
Test security verification - ensure different people cannot access each other's accounts
"""

import json
import base64
import io
import numpy as np
from PIL import Image, ImageDraw
import subprocess

def create_face_pattern_a():
    """Create distinctive face pattern A"""
    img = Image.new('RGB', (300, 300), color='lightblue')
    draw = ImageDraw.Draw(img)
    
    # Face outline
    draw.ellipse([75, 75, 225, 225], fill='peachpuff', outline='black', width=3)
    
    # Eyes - wider set
    draw.ellipse([95, 120, 115, 140], fill='white', outline='black', width=2)
    draw.ellipse([185, 120, 205, 140], fill='white', outline='black', width=2)
    draw.ellipse([102, 127, 108, 133], fill='black')  # Left pupil
    draw.ellipse([192, 127, 198, 133], fill='black')  # Right pupil
    
    # Distinctive nose - larger
    draw.polygon([(150, 150), (140, 170), (160, 170)], fill='pink', outline='black', width=2)
    
    # Mouth - wider
    draw.arc([120, 180, 180, 210], 0, 180, fill='red', width=4)
    
    # Hair/forehead distinctive pattern
    draw.rectangle([75, 75, 225, 100], fill='brown', outline='black')
    
    return img

def create_face_pattern_b():
    """Create distinctive face pattern B - completely different features"""
    img = Image.new('RGB', (300, 300), color='lightgreen')
    draw = ImageDraw.Draw(img)
    
    # Face outline - different shape
    draw.ellipse([50, 90, 250, 250], fill='tan', outline='black', width=3)
    
    # Eyes - closer together
    draw.ellipse([115, 130, 135, 150], fill='white', outline='black', width=2)
    draw.ellipse([165, 130, 185, 150], fill='white', outline='black', width=2)
    draw.ellipse([122, 137, 128, 143], fill='black')  # Left pupil
    draw.ellipse([172, 137, 178, 143], fill='black')  # Right pupil
    
    # Different nose - smaller, different shape
    draw.polygon([(150, 160), (145, 175), (155, 175)], fill='lightpink', outline='black', width=2)
    
    # Different mouth - smaller
    draw.arc([135, 190, 165, 210], 0, 180, fill='darkred', width=3)
    
    # Different hair pattern
    draw.ellipse([50, 90, 250, 140], fill='#8B4513', outline='black')
    
    return img

def image_to_base64(img):
    """Convert PIL image to base64 string"""
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=95)
    image_bytes = buffer.getvalue()
    base64_string = base64.b64encode(image_bytes).decode('utf-8')
    return f"data:image/jpeg;base64,{base64_string}"

def test_cross_verification():
    """Test that Person A's face cannot verify as Person B and vice versa"""
    print("=== CROSS-PERSON VERIFICATION SECURITY TEST ===")
    
    # Create two distinct face patterns
    face_a = create_face_pattern_a()
    face_b = create_face_pattern_b()
    
    face_a_data = image_to_base64(face_a)
    face_b_data = image_to_base64(face_b)
    
    print("1. Encoding Face A...")
    try:
        result_a = subprocess.run(
            ['python3', 'server/reliable_face_recognition.py', 'encode'],
            input=json.dumps({"image_data": face_a_data}),
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result_a.returncode != 0:
            print(f"❌ Failed to encode Face A: {result_a.stderr}")
            return
            
        response_a = json.loads(result_a.stdout)
        if not response_a.get('success'):
            print(f"❌ Face A encoding failed: {response_a.get('error')}")
            return
            
        encoding_a = response_a['encoding']
        print(f"✅ Face A encoded successfully (dimensions: {len(encoding_a)})")
        
    except Exception as e:
        print(f"❌ Error encoding Face A: {e}")
        return
    
    print("\n2. Encoding Face B...")
    try:
        result_b = subprocess.run(
            ['python3', 'server/reliable_face_recognition.py', 'encode'],
            input=json.dumps({"image_data": face_b_data}),
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result_b.returncode != 0:
            print(f"❌ Failed to encode Face B: {result_b.stderr}")
            return
            
        response_b = json.loads(result_b.stdout)
        if not response_b.get('success'):
            print(f"❌ Face B encoding failed: {response_b.get('error')}")
            return
            
        encoding_b = response_b['encoding']
        print(f"✅ Face B encoded successfully (dimensions: {len(encoding_b)})")
        
    except Exception as e:
        print(f"❌ Error encoding Face B: {e}")
        return
    
    print("\n3. Testing Face A trying to verify as Face B (should FAIL)...")
    try:
        result = subprocess.run(
            ['python3', 'server/reliable_face_recognition.py', 'compare'],
            input=json.dumps({
                "known_encoding": encoding_b,  # B's stored encoding
                "unknown_image": face_a_data,  # A's face trying to verify
                "tolerance": 0.8
            }),
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            response = json.loads(result.stdout)
            if response.get('success'):
                distance = response['result']['distance']
                is_match = response['result']['is_match']
                print(f"   Distance: {distance:.4f}")
                print(f"   Match: {is_match}")
                print(f"   Expected: Should FAIL (different people)")
                print(f"   Result: {'❌ SECURITY BREACH!' if is_match else '✅ SECURE'}")
            else:
                print(f"❌ Comparison failed: {response.get('error')}")
        else:
            print(f"❌ Process failed: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Error in cross-verification test: {e}")
    
    print("\n4. Testing Face B trying to verify as Face A (should FAIL)...")
    try:
        result = subprocess.run(
            ['python3', 'server/reliable_face_recognition.py', 'compare'],
            input=json.dumps({
                "known_encoding": encoding_a,  # A's stored encoding
                "unknown_image": face_b_data,  # B's face trying to verify
                "tolerance": 0.8
            }),
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            response = json.loads(result.stdout)
            if response.get('success'):
                distance = response['result']['distance']
                is_match = response['result']['is_match']
                print(f"   Distance: {distance:.4f}")
                print(f"   Match: {is_match}")
                print(f"   Expected: Should FAIL (different people)")
                print(f"   Result: {'❌ SECURITY BREACH!' if is_match else '✅ SECURE'}")
            else:
                print(f"❌ Comparison failed: {response.get('error')}")
        else:
            print(f"❌ Process failed: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Error in reverse cross-verification test: {e}")
    
    print("\n5. Testing legitimate verification (Face A vs Face A)...")
    try:
        result = subprocess.run(
            ['python3', 'server/reliable_face_recognition.py', 'compare'],
            input=json.dumps({
                "known_encoding": encoding_a,  # A's stored encoding
                "unknown_image": face_a_data,  # A's face verifying
                "tolerance": 0.8
            }),
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            response = json.loads(result.stdout)
            if response.get('success'):
                distance = response['result']['distance']
                is_match = response['result']['is_match']
                print(f"   Distance: {distance:.4f}")
                print(f"   Match: {is_match}")
                print(f"   Expected: Should PASS (same person)")
                print(f"   Result: {'✅ LEGITIMATE ACCESS' if is_match else '❌ LEGITIMATE USER BLOCKED'}")
            else:
                print(f"❌ Comparison failed: {response.get('error')}")
        else:
            print(f"❌ Process failed: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Error in legitimate verification test: {e}")

if __name__ == "__main__":
    test_cross_verification()