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
    from langchain_core.prompts import ChatPromptTemplate
except ImportError as e:
    print(f"Warning: LangChain dependencies not found: {e}")
    print("Please install: pip install langchain langchain-ollama langchain-core")
    OllamaLLM = None
    ChatPromptTemplate = None


class CaniScanLLMService:
    """LLM service for providing veterinary recommendations based on YOLO analysis"""
    
    def __init__(self):
        self.model = None
        self.prompt_template = None
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the Ollama LLM model"""
        if OllamaLLM is None:
            print("Warning: OllamaLLM not available. LLM features will be disabled.")
            return
        
        try:
            self.model = OllamaLLM(model="llama3.2")
            
            # Create a specialized prompt for CaniScan recommendations
            system_prompt = """
You are CaniScan AI, a specialized veterinary assistant for canine skin disease analysis and recommendations.

Your role:
- Provide helpful, accurate recommendations based on YOLO analysis results
- Consider the diagnosis confidence score when giving advice
- Offer practical care tips and treatment suggestions
- Always recommend consulting a veterinarian for serious conditions
- Be empathetic and supportive to pet owners

Guidelines:
- Base recommendations on the provided diagnosis and confidence score
- If confidence is low (<70%), suggest additional observations or vet consultation
- If confidence is high (>85%), provide more specific care recommendations
- Always prioritize pet safety and professional veterinary care
- Keep responses concise but informative
- Use a friendly, professional tone

Current analysis context:
- Diagnosis: {diagnosis}
- Confidence Score: {confidence}%
- User Question: {user_question}

Provide a helpful response focusing on practical care recommendations.
"""
            
            self.prompt_template = ChatPromptTemplate.from_template(system_prompt)
            print("✅ CaniScan LLM Service initialized successfully")
            
        except Exception as e:
            print(f"Error initializing LLM model: {e}")
            self.model = None
    
    def get_recommendation(self, diagnosis: str, confidence: float, user_question: str = "") -> Dict[str, str]:
        """
        Get LLM recommendation based on YOLO analysis
        
        Args:
            diagnosis: The disease diagnosis from YOLO
            confidence: Confidence score (0-100)
            user_question: Optional user question
            
        Returns:
            Dict with recommendation and status
        """
        if not self.model or not self.prompt_template:
            return {
                "recommendation": "LLM service is not available. Please consult a veterinarian for professional advice.",
                "status": "error"
            }
        
        try:
            # Debug: Print the values being passed
            print(f"DEBUG: Chat LLM receiving - Diagnosis: {diagnosis}, Confidence: {confidence}, Question: {user_question}")
            
            # Create the prompt
            prompt = self.prompt_template.format(
                diagnosis=diagnosis,
                confidence=confidence,
                user_question=user_question or "General care recommendations"
            )
            
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
            return {
                "recommendation": f"I apologize, but I'm having trouble processing your request right now. Please consult a veterinarian for professional advice about {diagnosis}.",
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
        """Get initial recommendation when analysis is completed"""
        if not self.model:
            return f"Analysis complete: {diagnosis} detected with {confidence}% confidence. Please consult a veterinarian for proper treatment."
        
        try:
            # Debug: Print the values being passed
            print(f"DEBUG: LLM receiving - Diagnosis: {diagnosis}, Confidence: {confidence}")
            
            initial_prompt = f"""
Based on the skin analysis showing {diagnosis} with {confidence}% confidence, provide a brief initial recommendation for the pet owner.

Keep it concise (2-3 sentences) and include:
1. Acknowledgment of the finding
2. Basic care advice
3. Reminder to consult a veterinarian

Be supportive and professional.
"""
            
            response = self.model.invoke(initial_prompt)
            cleaned_response = self._clean_response(str(response))
            
            # Debug: Print the response
            print(f"DEBUG: LLM response: {cleaned_response[:100]}...")
            
            return cleaned_response
            
        except Exception as e:
            print(f"Error getting initial recommendation: {e}")
            return f"Analysis complete: {diagnosis} detected with {confidence}% confidence. Please consult a veterinarian for proper treatment."


# Global instance
llm_service = CaniScanLLMService()

