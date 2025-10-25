# save as diagnosis_dialog.py
from langchain_ollama.llms import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate
import json
import re

model = OllamaLLM(model="llama3.2")

system = """
You are a veterinary triage assistant focused ONLY on canine skin diseases.
Your job:
- Before asking more questions, ask the user to give a description on what they see on the dog.
- Ask questions to reduce diagnostic uncertainty.
- Use heirarichal questioning in providing a diagnosis
- Repeat until you can give a specific likely skin disease diagnosis with confidence
- Then output a final diagnosis and brief rationale plus standard advice to consult a veterinarian.
Rules:
- Output ONLY valid JSON in this schema each turn:
  {{"action":"ask","question":"..."}} OR
  {{"action":"diagnose","diagnosis":"...","confidence":0.0-1.0,"rationale":"...","differentials":["..."]}}
- Never include extra text outside JSON.
- Never use code fences or markdown; return only the JSON object.
- Prefer focused, answerable questions (yes/no or short facts) about onset, distribution, pruritus, lesions, discharge, odor, 
systemic signs, exposures, parasites, diet, environment, prior treatments, recurrence.
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", system),
    ("human", "Initial complaint: {complaint}\nConversation so far:\n{transcript}\nStrictly return JSON.")
])

def ask_model(complaint, transcript):
    chain = prompt | model
    out = chain.invoke({"complaint": complaint, "transcript": transcript})
    return str(out).strip()

def _extract_first_json_object(text: str):
    """Return first balanced JSON object from text, or None.
    Handles optional code fences like ```json ... ```.
    """
    s = text.strip()
    # Strip code fences if present
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
        s = re.sub(r"```\s*$", "", s)
        s = s.strip()

    # Find first balanced { ... }
    start = s.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(s)):
        ch = s[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                candidate = s[start:i+1]
                return candidate
    return None

def run_dialog():
    complaint = "Owner notices their dog is acting differently"
    transcript = ""
    max_turns = 30
    for _ in range(max_turns):
        raw = ask_model(complaint, transcript)
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            # Try to recover by extracting the first JSON object
            recovered = _extract_first_json_object(raw)
            if recovered:
                try:
                    msg = json.loads(recovered)
                except json.JSONDecodeError:
                    print("Model returned non-JSON; retrying.")
                    continue
            else:
                print("Model returned non-JSON; retrying.")
                continue

        if msg.get("action") == "ask":
            q = msg.get("question", "").strip()
            if not q:
                print("Empty question; retrying.")
                continue
            print(q)
            ans = input("> ").strip()
            transcript += f"\nAssistant: {q}\nUser: {ans}"
            continue

        if msg.get("action") == "diagnose":
            diagnosis = msg.get("diagnosis", "Unknown")
            conf = msg.get("confidence", 0.0)
            rationale = msg.get("rationale", "")
            diffs = msg.get("differentials", []) or []
            print(f"\nLikely diagnosis: {diagnosis} (confidence {conf:.2f})")
            if rationale:
                print(f"Why: {rationale}")
            if diffs:
                print("Differentials: " + ", ".join(diffs))
            print("Please consult a veterinarian for confirmation and treatment.")
            return

    print("\nStopped due to turn limit. Consider providing more details.")

if __name__ == "__main__":
    run_dialog()