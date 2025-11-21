"""
LLM Service for CaniScan - Integrates Llama3.2 for veterinary recommendations
"""
import os
import sys
import json
import re
from typing import Dict, List, Optional

# Add the Llama directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'Llama'))

try:
    from langchain_ollama.llms import OllamaLLM
except ImportError as e:
    print(f"Warning: LangChain dependencies not found: {e}")
    print("Please install: pip install langchain langchain-ollama langchain-core")
    OllamaLLM = None


class CaniScanLLMService:
    """LLM service for providing veterinary recommendations based on YOLO analysis"""
    
    def __init__(self):
        self.model = None
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the Ollama LLM model"""
        if OllamaLLM is None:
            print("Warning: OllamaLLM not available. LLM features will be disabled.")
            return
        
        try:
            self.model = OllamaLLM(model="llama3.2")
            print("✅ CaniScan LLM Service initialized successfully")
            
        except Exception as e:
            print(f"Error initializing LLM model: {e}")
            self.model = None
    
    def get_recommendation(self, diagnosis: str = "", confidence: float = 0, user_question: str = "") -> Dict[str, str]:
        """
        Get LLM recommendation - works as regular chatbot or with image analysis context
        
        Args:
            diagnosis: The disease diagnosis from YOLO (optional, empty string if no image analysis)
            confidence: Confidence score (0-100, 0 if no image analysis)
            user_question: User's question or message
            
        Returns:
            Dict with recommendation and status
        """
        if not self.model:
            return {
                "recommendation": "LLM service is not available. Please consult a veterinarian for professional advice.",
                "status": "error"
            }
        
        try:
            # Check if we have image analysis data
            has_image_analysis = diagnosis and diagnosis.strip() and diagnosis.lower() != "no disease detected" and confidence > 0
            
            # Debug: Print the values being passed
            print(f"DEBUG: Chat LLM receiving - Diagnosis: {diagnosis}, Confidence: {confidence}, Question: {user_question}, Has Image Analysis: {has_image_analysis}")
            
            if has_image_analysis:
                # Mode with image analysis - provide rational diagnosis reasoning
                prompt = f"""You are CaniScan AI, a specialized veterinary assistant for canine skin disease analysis and recommendations.

An image analysis has been performed on a dog's skin condition, and the following results were obtained:
- Diagnosis: {diagnosis}
- Confidence Score: {confidence}%

Your task is to provide rational reasoning for why the AI model thinks the dog has this type of skin disease, and then provide helpful recommendations.

Guidelines:
- Explain why this diagnosis makes sense based on the confidence level and the disease type
- If confidence is high (>85%), provide more specific reasoning and care recommendations
- If confidence is moderate (70-85%), explain the diagnosis but emphasize the need for professional confirmation
- If confidence is low (<70%), suggest why the diagnosis might be uncertain and recommend additional observations or vet consultation
- Always prioritize pet safety and professional veterinary care
- Keep responses concise but informative
- Use a friendly, professional tone

User Question: {user_question if user_question else "Please explain the diagnosis and provide recommendations"}

Provide a helpful response that:
1. First explains the rational reasoning for why the AI detected {diagnosis} with {confidence}% confidence
2. Then provides practical care recommendations based on this diagnosis
3. Always reminds the user to consult a veterinarian for proper treatment"""
            else:
                # Regular chatbot mode - no image analysis
                prompt = f"""You are CaniScan AI, a specialized veterinary assistant for canine skin disease analysis and recommendations.

You are a helpful chatbot that can answer questions about canine skin diseases, general pet care, and veterinary advice.

Guidelines:
- Provide helpful, accurate information about canine skin diseases and general pet care
- Answer questions about symptoms, treatments, and when to seek veterinary care
- Offer practical care tips and suggestions
- Always recommend consulting a veterinarian for serious conditions or when in doubt
- Be empathetic and supportive to pet owners
- Keep responses concise but informative
- Use a friendly, professional tone
- If the user asks about analyzing an image, remind them to upload an image and use the analyze feature

User Question: {user_question if user_question else "How can I help you today?"}

Provide a helpful response to the user's question."""
            
            # Get response from LLM
            response = self.model.invoke(prompt)
            
            # Clean up the response
            cleaned_response = self._clean_response(str(response))
            
            # Debug: Print the response
            print(f"DEBUG: Chat LLM response: {cleaned_response[:100]}...")
            
            return {
                "recommendation": cleaned_response,
                "status": "success"
            }
            
        except Exception as e:
            print(f"Error getting LLM recommendation: {e}")
            error_msg = "I apologize, but I'm having trouble processing your request right now. Please try again or consult a veterinarian for immediate assistance."
            if diagnosis:
                error_msg = f"I apologize, but I'm having trouble processing your request right now. Please consult a veterinarian for professional advice about {diagnosis}."
            return {
                "recommendation": error_msg,
                "status": "error"
            }
    
    def _clean_response(self, response: str) -> str:
        """Clean and format the LLM response"""
        # Remove any markdown formatting
        response = re.sub(r'```.*?```', '', response, flags=re.DOTALL)
        response = re.sub(r'`([^`]+)`', r'\1', response)
        
        # Remove extra whitespace
        response = re.sub(r'\n\s*\n', '\n\n', response)
        response = response.strip()
        
        # Ensure it ends with a period if it doesn't already
        if response and not response.endswith(('.', '!', '?')):
            response += '.'
        
        return response
    
    def get_initial_recommendation(self, diagnosis: str, confidence: float) -> str:
        """Get initial recommendation when analysis is completed - automatically explains diagnosis"""
        if not self.model:
            if diagnosis and diagnosis.lower() != "no disease detected":
                return f"I see your dog has {diagnosis}. Here is the information about {diagnosis}: Based on the analysis with {confidence}% confidence, please consult a veterinarian for proper treatment."
            return f"Analysis complete: {diagnosis} detected with {confidence}% confidence. Please consult a veterinarian for proper treatment."
        
        try:
            # Debug: Print the values being passed
            print(f"DEBUG: LLM receiving - Diagnosis: {diagnosis}, Confidence: {confidence}")
            
            # Check if confidence is around 70% (65-75% range)
            is_around_70 = 65 <= confidence <= 75
            
            # Determine if there's a real diagnosis
            has_real_diagnosis = diagnosis and diagnosis.strip() and diagnosis.lower() != "no disease detected"
            
            if has_real_diagnosis:
                if is_around_70:
                    # Special handling for confidence around 70% - provide detailed information
                    initial_prompt = f"""You are CaniScan AI. An image analysis has been performed on a dog's skin condition.

The analysis detected: {diagnosis}
Confidence Score: {confidence}%

Your task is to automatically provide information to the pet owner. Start your response with exactly this format:
"I see your dog has {diagnosis}. Here is the information about {diagnosis}:"

Then provide:
1. A clear explanation of why the AI detected {diagnosis} with {confidence}% confidence (this is a moderate confidence level)
2. Detailed information about {diagnosis}, including:
   - What it is
   - Common symptoms
   - Potential causes
   - General care recommendations
3. Important note about the moderate confidence level and the importance of professional veterinary consultation
4. When to seek immediate veterinary care

Keep the response comprehensive but well-organized (4-6 sentences). Be supportive, professional, and empathetic. Always emphasize consulting a veterinarian for proper diagnosis and treatment."""
                else:
                    # For other confidence levels
                    initial_prompt = f"""You are CaniScan AI. An image analysis has been performed on a dog's skin condition.

The analysis detected: {diagnosis}
Confidence Score: {confidence}%

Your task is to automatically provide information to the pet owner. Start your response with exactly this format:
"I see your dog has {diagnosis}. Here is the information about {diagnosis}:"

Then provide:
1. A clear explanation of why the AI detected {diagnosis} with {confidence}% confidence
2. Information about {diagnosis}, including:
   - What it is
   - Common symptoms
   - General care recommendations
3. Guidance based on the confidence level:
   - If confidence is high (>85%): Provide more specific recommendations but still emphasize vet consultation
   - If confidence is low (<70%): Emphasize the uncertainty and importance of professional consultation
4. Always remind to consult a veterinarian for proper diagnosis and treatment

Keep the response informative but concise (3-5 sentences). Be supportive, professional, and empathetic."""
            else:
                # No disease detected
                initial_prompt = f"""You are CaniScan AI. An image analysis has been performed on a dog's skin condition.

The analysis shows: {diagnosis} (confidence: {confidence}%)

Provide a positive and supportive message to the pet owner about the healthy skin condition. Keep it brief and friendly (2-3 sentences)."""
            
            response = self.model.invoke(initial_prompt)
            cleaned_response = self._clean_response(str(response))
            
            # Debug: Print the response
            print(f"DEBUG: LLM response: {cleaned_response[:100]}...")
            
            return cleaned_response
            
        except Exception as e:
            print(f"Error getting initial recommendation: {e}")
            if diagnosis and diagnosis.lower() != "no disease detected":
                return f"I see your dog has {diagnosis}. Here is the information about {diagnosis}: Based on the analysis with {confidence}% confidence, please consult a veterinarian for proper diagnosis and treatment."
            return f"Analysis complete: {diagnosis} detected with {confidence}% confidence. Please consult a veterinarian for proper treatment."


    def summarize_multiple_detections(self, detections: List[Dict]) -> str:
        """
        Summarize multiple disease detections using the LLM.
        Each item in detections is { 'disease': str, 'confidence': float, 'bbox': [...] }
        """
        if not self.model:
            # Fallback (LLM not running)
            if len(detections) == 0:
                return "No diseases detected."
            
            if len(detections) == 1:
                d = detections[0]
                return f"The image detected {d['disease']} with a confidence score of {d['confidence']:.2f}%. Please consult a veterinarian for proper diagnosis and treatment."
            
            summary = "The image detected multiple skin conditions:\n"
            for d in detections:
                summary += f"- {d['disease']} with a confidence score of {d['confidence']:.2f}%\n"
            summary += "\nPlease consult a veterinarian for diagnosis and treatment."
            return summary

        # Handle single detection
        if len(detections) == 1:
            d = detections[0]
            prompt = f"""You are CaniScan AI. The YOLO model detected a skin disease in a dog's image.

    Detection:
    - Disease: {d['disease']}
    - Confidence Score: {d['confidence']:.2f}%

    Write a natural, conversational summary in plain text (NO markdown formatting like ** or __).

    Start with: "The image detected {d['disease']} with a confidence score of {d['confidence']:.2f}%."

    Then briefly explain:
    1. What {d['disease']} generally means
    2. Common symptoms to look for
    3. General care recommendations
    4. Remind the owner to consult a veterinarian for proper diagnosis and treatment

    Keep it informative, friendly, and safe. Use 3-5 sentences total.
    DO NOT use any markdown formatting (no **, __, or other special characters).
    """
        else:
            # Handle multiple detections
            detection_list = "\n".join(
                [f"- {d['disease']} with a confidence score of {d['confidence']:.2f}%" 
                for d in detections]
            )

            prompt = f"""You are CaniScan AI. The YOLO model detected multiple skin diseases in a dog's image.

    Detections:
    {detection_list}

    Write a natural, conversational summary in plain text (NO markdown formatting like ** or __).

    Start with: "The image detected multiple skin conditions:"

    Then:
    1. List each disease naturally in a sentence
    2. Provide a brief overview of what these conditions generally mean
    3. Give general care recommendations
    4. Remind the owner to seek veterinary confirmation for accurate diagnosis and treatment

    Keep it informative, friendly, and safe. Use 4-6 sentences total.
    DO NOT use any markdown formatting (no **, __, #, or other special characters).
    Write in plain, natural English.
    """

        try:
            response = self.model.invoke(prompt)
            cleaned = self._clean_response(str(response))
            
            # Additional cleaning to remove any remaining markdown
            cleaned = cleaned.replace('**', '').replace('__', '').replace('~~', '')
            cleaned = re.sub(r'\*([^\*]+)\*', r'\1', cleaned)  # Remove single asterisks
            cleaned = re.sub(r'_([^_]+)_', r'\1', cleaned)     # Remove underscores
            
            return cleaned
        except Exception as e:
            print(f"Error in summarize_multiple_detections: {e}")
            
            # Better fallback message
            if len(detections) == 1:
                d = detections[0]
                return f"The image detected {d['disease']} with a confidence score of {d['confidence']:.2f}%. Please consult a veterinarian for proper diagnosis and treatment."
            
            fallback = "The image detected multiple skin conditions:\n"
            for d in detections:
                fallback += f"- {d['disease']} with a confidence score of {d['confidence']:.2f}%\n"
            fallback += "\nPlease consult a veterinarian for proper diagnosis and treatment."
            return fallback

# Global instance
llm_service = CaniScanLLMService()

