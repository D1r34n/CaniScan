Diagnosis Dialog (Canine Skin Diseases)

Brief guide to set up and run the interactive diagnostic dialog that asks targeted follow‑up questions and outputs a likely diagnosis in JSON.

Prerequisites
- Windows PowerShell
- Python 3.10+ (project uses a virtual environment in `venv/`)
- Ollama installed and the `llama3.2` model available

1) Install Ollama and pull model
- Install Ollama: see `https://ollama.com`
- In a PowerShell window, start the server and pull the model:
  - `ollama serve`
  - In another window: `ollama pull llama3.2`

2) Create/activate virtual environment (if not already present)
- PowerShell from project root:
  - `python -m venv venv`
  - `./venv/Scripts/Activate.ps1`

3) Install Python dependencies
- With the venv active:
  - `pip install -r requirements.txt`

4) Run the dialog
- Keep `ollama serve` running in a separate window.
- In the project window (venv active):
  - `python diagnosis_diaglog.py`

Notes
- If Ollama uses a non-default host/port, set the environment variable before running:
  - PowerShell: `$env:OLLAMA_HOST = "http://127.0.0.1:11434"`
- If you see "Model returned non-JSON; retrying.", the script will attempt to recover. Just answer the next question when prompted.


