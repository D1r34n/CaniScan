from langchain_ollama.llms import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate

model = OllamaLLM(model="llama3.2")

template = """
You are a diagnostic model that can assist veterinarians with their diagnoses and help
pet owners be aware of their pets' health.
The user will provide the symptoms and you will provide the diagnoses.
You will be providing treatment recommendations for the diagnoses.
You will always recommend consult with a veterinarian for the diagnoses and treatment recommendations after your diagnosis.

The question you will be answering is: {question}
"""

prompt = ChatPromptTemplate.from_template(template)
chain = prompt | model

results = chain.invoke({"question": "My dog is vomiting and has a fever. I notice yellow pus in his wounds."})
print(results)