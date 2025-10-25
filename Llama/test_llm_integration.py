"""
Test script for CaniScan LLM Integration
This script tests the LLM service and API endpoints
"""

import requests
import json
import base64
import os
from PIL import Image
import io

def test_llm_service():
    """Test the LLM service directly"""
    print("🧪 Testing LLM Service...")
    
    try:
        from yolov8.llm_service import llm_service
        
        # Test initial recommendation
        recommendation = llm_service.get_initial_recommendation("Fungal Infection", 87.5)
        print(f"✅ Initial recommendation: {recommendation[:100]}...")
        
        # Test chat recommendation
        chat_response = llm_service.get_recommendation("Fungal Infection", 87.5, "What should I do?")
        print(f"✅ Chat response: {chat_response['recommendation'][:100]}...")
        
        return True
    except Exception as e:
        print(f"❌ LLM Service test failed: {e}")
        return False

def test_flask_endpoints():
    """Test Flask API endpoints"""
    print("\n🧪 Testing Flask API Endpoints...")
    
    base_url = "http://localhost:5000"
    
    # Test health endpoint
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            print("✅ Health endpoint working")
        else:
            print(f"❌ Health endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to Flask server: {e}")
        print("Please start the Flask server with: python yolov8/app.py")
        return False
    
    # Test chat endpoint
    try:
        chat_data = {
            "message": "What should I do about this condition?",
            "diagnosis": "Fungal Infection",
            "confidence": 87.5
        }
        
        response = requests.post(f"{base_url}/chat", json=chat_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Chat endpoint working: {result['response'][:100]}...")
        else:
            print(f"❌ Chat endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Chat endpoint test failed: {e}")
        return False
    
    return True

def create_test_image():
    """Create a simple test image"""
    print("\n🖼️ Creating test image...")
    
    # Create a simple colored image
    img = Image.new('RGB', (200, 200), color='lightgray')
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/jpeg;base64,{img_str}"

def test_analysis_endpoint():
    """Test the analysis endpoint with a test image"""
    print("\n🧪 Testing Analysis Endpoint...")
    
    base_url = "http://localhost:5000"
    
    try:
        # Create test image
        test_image = create_test_image()
        
        # Test analysis endpoint
        analysis_data = {
            "frame": test_image
        }
        
        response = requests.post(f"{base_url}/analyze", json=analysis_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Analysis endpoint working:")
            print(f"   Disease: {result['disease']}")
            print(f"   Confidence: {result['confidence']}%")
            print(f"   Recommendation: {result['recommendation'][:100]}...")
            return True
        else:
            print(f"❌ Analysis endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Analysis endpoint test failed: {e}")
        return False

def main():
    """Main test function"""
    print("🐕 CaniScan LLM Integration Test")
    print("=" * 50)
    
    # Test LLM service
    llm_test = test_llm_service()
    
    # Test Flask endpoints
    flask_test = test_flask_endpoints()
    
    # Test analysis endpoint
    analysis_test = test_analysis_endpoint()
    
    # Summary
    print("\n📊 Test Results:")
    print(f"LLM Service: {'✅ PASS' if llm_test else '❌ FAIL'}")
    print(f"Flask Endpoints: {'✅ PASS' if flask_test else '❌ FAIL'}")
    print(f"Analysis Endpoint: {'✅ PASS' if analysis_test else '❌ FAIL'}")
    
    if llm_test and flask_test and analysis_test:
        print("\n🎉 All tests passed! LLM integration is working correctly.")
    else:
        print("\n❌ Some tests failed. Please check the issues above.")
        print("\nTroubleshooting:")
        print("1. Ensure Ollama is running: ollama serve")
        print("2. Check if Llama3.2 is installed: ollama list")
        print("3. Start Flask server: python yolov8/app.py")
        print("4. Install dependencies: pip install -r requirements.txt")

if __name__ == "__main__":
    main()
