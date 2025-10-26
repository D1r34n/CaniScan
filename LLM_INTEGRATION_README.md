# CaniScan LLM Integration

This document explains how to set up and use the LLM (Large Language Model) integration in CaniScan, which provides intelligent veterinary recommendations based on YOLO analysis results.

## Overview

The LLM integration combines:
- **YOLO Analysis**: Detects canine skin diseases from images
- **Llama3.2 Model**: Provides contextual veterinary recommendations
- **Real-time Chat**: Interactive recommendations based on analysis results

## Features

- **Intelligent Recommendations**: LLM provides context-aware advice based on diagnosis and confidence scores
- **Interactive Chat**: Users can ask follow-up questions about their pet's condition
- **Confidence-based Responses**: Recommendations adapt based on analysis confidence levels
- **Professional Guidance**: Always recommends consulting veterinarians for serious conditions

## Setup Instructions

### Prerequisites

1. **Ollama Installation**
   - Download and install Ollama from [https://ollama.ai/download](https://ollama.ai/download)
   - Ensure Ollama is running on your system

2. **Python Dependencies**
   - Install required packages: `pip install -r requirements.txt`

### Quick Setup

Run the automated setup script:

```bash
python setup_llm.py
```

This script will:
- Check if Ollama is installed
- Install Python dependencies
- Pull the Llama3.2 model
- Test the integration

### Manual Setup

If you prefer manual setup:

1. **Install Ollama** (if not already installed)
2. **Pull the Llama3.2 model**:
   ```bash
   ollama pull llama3.2
   ```
3. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

### Starting the Application

1. **Start the Flask server**:
   ```bash
   python yolov8/app.py
   ```

2. **Open CaniScan application** and navigate to the Analysis page

3. **Upload an image** of your dog's skin condition

4. **Click "Analyze"** to get:
   - YOLO disease detection
   - Confidence score
   - Initial LLM recommendation

5. **Chat with the AI** in the Recommendations tab for additional advice

### API Endpoints

The integration adds two new endpoints to the Flask server:

#### `/analyze` (Enhanced)
- **Method**: POST
- **Input**: Base64 encoded image
- **Output**: 
  ```json
  {
    "disease": "Fungal Infection",
    "confidence": 87.5,
    "recommendation": "Based on the analysis showing Fungal Infection with 87.5% confidence, I recommend keeping the affected area clean and dry..."
  }
  ```

#### `/chat` (New)
- **Method**: POST
- **Input**:
  ```json
  {
    "message": "What should I do about this condition?",
    "diagnosis": "Fungal Infection",
    "confidence": 87.5
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "response": "For fungal infections, I recommend...",
    "status": "success"
  }
  ```

## How It Works

### 1. Image Analysis
- User uploads an image
- YOLO model analyzes the image for skin diseases
- Returns diagnosis and confidence score

### 2. Initial Recommendation
- LLM receives diagnosis and confidence
- Generates contextual initial recommendation
- Displays in chat interface

### 3. Interactive Chat
- User can ask follow-up questions
- LLM considers current analysis context
- Provides personalized recommendations

### 4. Confidence-based Responses
- **High Confidence (>85%)**: Specific care recommendations
- **Medium Confidence (70-85%)**: General advice with vet consultation
- **Low Confidence (<70%)**: Emphasizes professional consultation

## Configuration

### LLM Service Configuration

The LLM service can be configured in `yolov8/llm_service.py`:

```python
class CaniScanLLMService:
    def __init__(self):
        self.model = OllamaLLM(model="llama3.2")  # Change model here
        # Customize prompts for different responses
```

### Customizing Prompts

You can modify the system prompts in `llm_service.py` to:
- Change the AI's personality
- Add specific veterinary guidelines
- Modify response format

## Troubleshooting

### Common Issues

1. **"LLM service is not available"**
   - Ensure Ollama is running: `ollama serve`
   - Check if Llama3.2 is installed: `ollama list`

2. **Import errors**
   - Install missing dependencies: `pip install langchain langchain-ollama`

3. **Slow responses**
   - LLM responses may take 5-15 seconds depending on hardware
   - Consider using a smaller model for faster responses

4. **Connection errors**
   - Ensure Flask server is running on port 5000
   - Check firewall settings

### Debug Mode

Enable debug logging by setting environment variable:
```bash
export FLASK_DEBUG=1
python yolov8/app.py
```

## File Structure

```
CaniScan/
├── yolov8/
│   ├── app.py              # Enhanced Flask app with LLM endpoints
│   └── llm_service.py      # LLM service implementation
├── Llama/                  # Original Llama implementation
├── requirements.txt        # Updated with LLM dependencies
├── setup_llm.py           # Setup script
└── revised_functions.js    # Updated frontend with LLM integration
```

## Security Notes

- The LLM integration runs locally using Ollama
- No data is sent to external services
- All analysis and recommendations are processed on your machine
- User data remains private and secure

## Support

For issues with the LLM integration:
1. Check the troubleshooting section above
2. Verify Ollama is running correctly
3. Test the setup with `python setup_llm.py`
4. Check Flask server logs for error messages

## Future Enhancements

Potential improvements:
- Support for multiple LLM models
- Conversation history persistence
- Advanced prompt engineering
- Integration with veterinary databases
- Multi-language support

