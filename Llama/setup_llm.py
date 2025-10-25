"""
Setup script for CaniScan LLM Integration
This script helps set up the LLM integration with Ollama and Llama3.2
"""

import subprocess
import sys
import os

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"Error: {e.stderr}")
        return False

def check_ollama_installed():
    """Check if Ollama is installed"""
    try:
        result = subprocess.run("ollama --version", shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Ollama is already installed")
            return True
        else:
            print("❌ Ollama is not installed")
            return False
    except:
        print("❌ Ollama is not installed")
        return False

def install_ollama():
    """Install Ollama"""
    print("\n📥 Installing Ollama...")
    print("Please visit https://ollama.ai/download to download and install Ollama for your system.")
    print("After installation, please run this script again.")
    return False

def pull_llama_model():
    """Pull the Llama3.2 model"""
    return run_command("ollama pull llama3.2", "Pulling Llama3.2 model")

def install_python_dependencies():
    """Install Python dependencies"""
    return run_command("pip install -r requirements.txt", "Installing Python dependencies")

def test_llm_integration():
    """Test the LLM integration"""
    print("\n🧪 Testing LLM integration...")
    try:
        # Test if we can import the required modules
        from langchain_ollama.llms import OllamaLLM
        from langchain_core.prompts import ChatPromptTemplate
        
        # Test if Ollama is running
        result = subprocess.run("ollama list", shell=True, capture_output=True, text=True)
        if result.returncode == 0 and "llama3.2" in result.stdout:
            print("✅ LLM integration test passed")
            return True
        else:
            print("❌ Llama3.2 model not found. Please run: ollama pull llama3.2")
            return False
    except ImportError as e:
        print(f"❌ LLM integration test failed: {e}")
        return False

def main():
    """Main setup function"""
    print("🐕 CaniScan LLM Integration Setup")
    print("=" * 50)
    
    # Check if Ollama is installed
    if not check_ollama_installed():
        if not install_ollama():
            return
    
    # Install Python dependencies
    if not install_python_dependencies():
        print("❌ Failed to install Python dependencies")
        return
    
    # Pull Llama model
    if not pull_llama_model():
        print("❌ Failed to pull Llama3.2 model")
        return
    
    # Test integration
    if test_llm_integration():
        print("\n🎉 Setup completed successfully!")
        print("\nNext steps:")
        print("1. Start the Flask server: python yolov8/app.py")
        print("2. Open the CaniScan application")
        print("3. Upload an image and analyze it")
        print("4. Try chatting with the AI assistant!")
    else:
        print("\n❌ Setup completed with errors. Please check the issues above.")

if __name__ == "__main__":
    main()
