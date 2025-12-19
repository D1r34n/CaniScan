"""
LLM Service for CaniScan - Integrates Llama3.2 for veterinary recommendations
"""
import os
import sys
import json
import re
from typing import Dict, List, Optional

# Add the Llama directory to the path
def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and PyInstaller """
    try:
        base_path = sys._MEIPASS  # PyInstaller temp folder
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

llama_path = resource_path("Llama")
if llama_path not in sys.path:
    sys.path.append(llama_path)

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
            print("\nCaniScan LLM Service initialized successfully")
            
        except Exception as e:
            print(f"Error initializing LLM model: {e}")
            self.model = None
    
    def get_recommendation(self, diagnosis: str = "", confidence: float = 0, user_question: str = "", breed: str = "", conversation_history: list = None) -> Dict[str, str]:
        """
        Get LLM recommendation - works as regular chatbot or with image analysis context
        
        Args:
            diagnosis: The disease diagnosis from YOLO (optional, empty string if no image analysis)
            confidence: Confidence score (0-100, 0 if no image analysis)
            user_question: User's question or message
            breed: Dog breed (optional, for breed-specific context)
            conversation_history: List of previous messages in format [{"role": "user"/"assistant", "content": "..."}]
            
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
            has_breed = breed and breed.strip()
            has_history = conversation_history and len(conversation_history) > 0
            
            # Debug: Print the values being passed
            print(f"DEBUG: Chat LLM receiving - Diagnosis: {diagnosis}, Confidence: {confidence}, Question: {user_question}, Breed: {breed}, Has Image Analysis: {has_image_analysis}, History Length: {len(conversation_history) if conversation_history else 0}")
            
            # Build breed context string
            breed_context = ""
            if has_breed:
                breed_context = f"\n- Dog Breed: {breed}\n\nNote: Consider breed-specific characteristics, common health issues, and care recommendations for {breed} when providing your response."
            
            # Build conversation history context
            history_context = ""
            if has_history:
                history_lines = []
                for msg in conversation_history:
                    role = msg.get('role', 'user')
                    content = msg.get('content', '')
                    if role == 'user':
                        history_lines.append(f"User: {content}")
                    elif role == 'assistant':
                        history_lines.append(f"Assistant: {content}")
                
                if history_lines:
                    history_context = f"\n\nPrevious Conversation:\n" + "\n".join(history_lines) + f"\n\nCurrent User Question: {user_question}"
            
            if has_image_analysis:
                # Mode with image analysis - provide rational diagnosis reasoning
                base_prompt = f"""You are CaniScan AI, a specialized veterinary assistant for canine skin disease analysis and recommendations.

An image analysis has been performed on a dog's skin condition, and the following results were obtained:
- Diagnosis: {diagnosis}
- Confidence Score: {confidence}%{breed_context}

Your task is to provide rational reasoning for why the AI model thinks the dog has this type of skin disease, and then provide helpful recommendations.

Guidelines:
- Explain why this diagnosis makes sense based on the confidence level and the disease type
- If a breed is provided, consider breed-specific predispositions, common health issues, and care needs for that breed
- If confidence is high (>85%), provide more specific reasoning and care recommendations
- If confidence is moderate (70-85%), explain the diagnosis but emphasize the need for professional confirmation
- If confidence is low (<70%), suggest why the diagnosis might be uncertain and recommend additional observations or vet consultation
- Always prioritize pet safety and professional veterinary care
- Keep responses concise but informative
- Use a friendly, professional tone
- If there is previous conversation history, maintain context and answer follow-up questions based on what was discussed earlier"""
                
                if has_history:
                    prompt = base_prompt + history_context + "\n\nProvide a helpful response that addresses the user's current question while maintaining context from the previous conversation."
                else:
                    prompt = base_prompt + f"""

User Question: {user_question if user_question else "Please explain the diagnosis and provide recommendations"}

Provide a helpful response that:
1. First explains the rational reasoning for why the AI detected {diagnosis} with {confidence}% confidence
2. Then provides practical care recommendations based on this diagnosis{f" and the {breed} breed" if has_breed else ""}
3. Always reminds the user to consult a veterinarian for proper treatment"""
            else:
                # Regular chatbot mode - no image analysis
                breed_intro = f"\n\nDog Breed: {breed}\nNote: Consider breed-specific characteristics, common health issues, and care recommendations for {breed} when providing your response." if has_breed else ""
                
                base_prompt = f"""You are CaniScan AI, a specialized veterinary assistant for canine skin disease analysis and recommendations.

You are a helpful chatbot that can answer questions about canine skin diseases, general pet care, and veterinary advice.{breed_intro}

Guidelines:
- Provide helpful, accurate information about canine skin diseases and general pet care
- If a breed is provided, tailor your advice to consider breed-specific characteristics, common health issues, and care needs
- Answer questions about symptoms, treatments, and when to seek veterinary care
- Offer practical care tips and suggestions
- Always recommend consulting a veterinarian for serious conditions or when in doubt
- Be empathetic and supportive to pet owners
- Keep responses concise but informative
- Use a friendly, professional tone
- If the user asks about analyzing an image, remind them to upload an image and use the analyze feature
- If there is previous conversation history, maintain context and answer follow-up questions based on what was discussed earlier"""
                
                if has_history:
                    prompt = base_prompt + history_context + "\n\nProvide a helpful response to the user's current question while maintaining context from the previous conversation."
                else:
                    prompt = base_prompt + f"""

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
            
            summary = "Detected diseases:\n"
            for d in detections:
                summary += f"- {d['disease']} ({d['confidence']}%)\n"
            summary += "\nPlease consult a veterinarian for diagnosis and treatment."
            return summary

        # Build a list text for the LLM
        detection_text = "\n".join(
            [f"- {d['disease']} ({d['confidence']}%)" for d in detections]
        )

        prompt = f"""
You are CaniScan AI. The YOLO model detected **multiple diseases** in a dog's skin image.

Here are the detections:
{detection_text}

Write a helpful explanation that:
1. Summarizes all the diseases found
2. Explains what each disease generally means
3. Provides general care recommendations
4. Reminds the owner to seek veterinary confirmation

Keep it informative, friendly, and safe.
"""

        try:
            response = self.model.invoke(prompt)
            cleaned = self._clean_response(str(response))
            return cleaned
        except Exception as e:
            print(f"Error in summarize_multiple_detections: {e}")
            fallback = "Detected diseases:\n" + detection_text + "\nPlease consult a veterinarian."
            return fallback

    def summarize_from_counts(self, disease_list: List[Dict], user_message: str = "") -> str:
        """
        Summarize disease counts into friendly insights (1 sentence each) for the frontend.

        Args:
            disease_list: List of dicts like [{"disease": "Hotspot", "count": 2}, ...]
            user_message: Optional user query from frontend

        Returns:
            str: Three single-sentence insights separated by newlines:
                1. Health status
                2. Top disease
                3. Other/rare conditions
        """
        # No data case
        if not disease_list:
            return (
                "No scans have been analyzed yet, please upload images to get health insights.\n"
                "No disease data available to report.\n"
                "Insights on common and rare conditions will appear once scans are analyzed."
            )

        total_scans = sum(d['count'] for d in disease_list)
        healthy_count = next((d['count'] for d in disease_list if d['disease'].lower() == 'healthy'), 0)
        diseases_only = [d for d in disease_list if d['disease'].lower() != 'healthy']

        # All healthy case
        if not diseases_only:
            return (
                f"All {total_scans} scans show healthy skin, keep up with routine care and hygiene.\n"
                "No diseases were detected in the current gallery, preventive care is effective.\n"
                "Continue regular monitoring to maintain optimal skin health."
            )

        # Most common disease
        top_disease = max(diseases_only, key=lambda x: x['count'])
        other_diseases = [d for d in diseases_only if d['count'] < top_disease['count']]

        # Health insight
        health_insight = (
            f"No healthy scans were detected among {total_scans} analyzed, monitor closely and seek veterinary advice."
            if healthy_count == 0
            else f"{healthy_count} out of {total_scans} scans show healthy skin, continue preventive care."
        )

        # Top disease insight
        top_insight = f"{top_disease['disease']} is the most frequent condition detected ({top_disease['count']} cases) and should be monitored with proper care."

        # Other/rare conditions insight
        if other_diseases:
            other_names = ", ".join([d['disease'] for d in other_diseases[:2]])
            other_insight = f"Other conditions like {other_names} were also detected and may require early veterinary consultation."
        else:
            other_insight = "No other significant conditions detected, maintain regular monitoring for all dogs."

        # Use LLM if available
        if self.model:
            counts_text = "\n".join([f"- {d['disease']}: {d['count']} case(s)" for d in disease_list])
            prompt = f"""
    You are CaniScan AI, a friendly veterinary assistant.

    ANALYSIS DATA:
    {counts_text}
    Total scans: {total_scans}
    Healthy scans: {healthy_count}
    Top condition: {top_disease['disease']} ({top_disease['count']} cases)
    User Message: {user_message}

    Provide EXACTLY 3 single-sentence insights separated by newlines.
    Do NOT include any introductions, headings, or extra text.
    The first insight must reflect the health status as defined above.
    Second is top disease, third is other/rare conditions.
    """
            try:
                response = self.model.invoke(prompt)
                cleaned = self._clean_response(str(response))
                lines = [line.strip() for line in cleaned.split('\n') if line.strip()]

                # Force first insight to match health_insight if healthy_count == 0
                if healthy_count == 0 and lines:
                    lines[0] = health_insight

                # Ensure exactly 3 lines
                while len(lines) < 3:
                    lines.append("No additional insights available.")
                return '\n'.join(lines[:3])
            except Exception as e:
                print(f"Error in LLM summarize_from_counts: {e}")

        # Fallback if no LLM
        return f"{health_insight}\n{top_insight}\n{other_insight}"


        
# Global instance
llm_service = CaniScanLLMService()

