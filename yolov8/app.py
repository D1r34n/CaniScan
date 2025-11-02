from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import cv2, base64, numpy as np, re, csv, os, bcrypt, json
from datetime import datetime
from llm_service import llm_service

# ----------------------------
# Flask App Initialization
# ----------------------------
app = Flask(__name__)
<<<<<<< Updated upstream
CORS(app)  # Enable Cross-Origin requests, necessary for Electron <-> Flask communication
=======
app.secret_key = "skibidi"
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True

# Add CORS headers manually for Electron compatibility
# This approach works better with Electron's file:// protocol
@app.after_request
def after_request(response):
    # Allow common origins (localhost and Electron file://)
    origin = request.headers.get('Origin')
    if origin:
        # Allow any localhost or 127.0.0.1 origin
        if (origin.startswith('http://localhost') or 
            origin.startswith('http://127.0.0.1')):
            response.headers.add('Access-Control-Allow-Origin', origin)
            response.headers.add('Access-Control-Allow-Credentials', 'true')
    elif not origin or origin == 'null':
        # Handle requests without Origin header (e.g., file://) - use a default localhost
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
    
    # Always add these headers
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    return response
>>>>>>> Stashed changes

# ----------------------------
# Load YOLO Model for Disease Detection
# ----------------------------
model = YOLO(r"runs\detect\train2\weights\best.pt")  # Path to trained YOLOv8 weights

# ----------------------------
# User Database Setup
# ----------------------------
<<<<<<< Updated upstream
USERS_CSV = "users.csv"
=======
USERS_CSV = "csv/users.csv"
ANALYSIS_HISTORY_DIR = "csv/analysis_history"
>>>>>>> Stashed changes

# Ensure the CSV file exists; create with headers if not
if not os.path.exists(USERS_CSV):
    with open(USERS_CSV, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["first_name", "last_name", "email", "password"])  # CSV headers

# Ensure analysis history directory exists
if not os.path.exists(ANALYSIS_HISTORY_DIR):
    os.makedirs(ANALYSIS_HISTORY_DIR)

# ----------------------------
# Password Utilities
# ----------------------------
def hash_password(password):
    """Securely hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    """Verify plain password against hashed password."""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

# ----------------------------
# User Data Utilities
# ----------------------------
def save_user_to_csv(first_name, last_name, email, password):
    """Save a new user to the CSV file with hashed password."""
    hashed_password = hash_password(password)
    with open(USERS_CSV, mode="a", newline="") as file:
        writer = csv.writer(file)
        writer.writerow([first_name, last_name, email, hashed_password])

def load_users_from_csv():
    """Load all users from CSV and return as a list of dictionaries."""
    users = []
    if os.path.exists(USERS_CSV):
        with open(USERS_CSV, mode="r") as file:
            reader = csv.DictReader(file)
            for row in reader:
                users.append(row)
    return users

def find_user_by_email(email):
    """Find a user by their email (case-insensitive)."""
    users = load_users_from_csv()
    for user in users:
        if user["email"].strip().lower() == email.strip().lower():
            return user
    return None

# ----------------------------
# Analysis History Utilities
# ----------------------------
def get_user_history_file(email):
    """Get the path to user's analysis history file."""
    # Sanitize email for filename
    safe_email = re.sub(r'[^a-zA-Z0-9@._-]', '_', email.lower())
    return os.path.join(ANALYSIS_HISTORY_DIR, f"{safe_email}.json")

def load_user_analysis_history(email):
    """Load analysis history for a specific user."""
    history_file = get_user_history_file(email)
    if os.path.exists(history_file):
        try:
            with open(history_file, 'r') as f:
                return json.load(f)
        except:
            return []
    return []

def save_user_analysis_history(email, history):
    """Save analysis history for a specific user."""
    history_file = get_user_history_file(email)
    try:
        with open(history_file, 'w') as f:
            json.dump(history, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving history: {e}")
        return False

def add_to_user_history(email, image_src, diagnosis, confidence, image_filename=None):
    """Add a new analysis entry to user's history."""
    history = load_user_analysis_history(email)
    new_entry = {
        "imageSrc": image_src,
        "diagnosis": diagnosis,
        "confidence": confidence,
        "timestamp": datetime.now().isoformat(),
        "imageFilename": image_filename
    }
    history.insert(0, new_entry)  # Add to beginning
    if len(history) > 50:  # Keep last 50 entries
        history = history[:50]
    save_user_analysis_history(email, history)
    return history

def clear_user_history(email):
    """Clear all analysis history for a user."""
    history_file = get_user_history_file(email)
    if os.path.exists(history_file):
        try:
            os.remove(history_file)
            return True
        except:
            return False
    return True  # Already empty

# ----------------------------
# Flask Routes
# ----------------------------

@app.route('/register', methods=['POST'])
def register():
    """Handle user registration."""
    data = request.get_json()
    first_name = data.get("firstName", "").strip()
    last_name = data.get("lastName", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    # Ensure all fields are provided
    if not all([first_name, last_name, email, password]):
        return jsonify({"success": False, "message": "All fields are required."}), 400

    # Validate names (letters, spaces, hyphens, accents allowed)
    name_pattern = r"^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$"
    if not re.match(name_pattern, first_name):
        return jsonify({"success": False, "message": "Invalid first name format."}), 400
    elif not re.match(name_pattern, last_name):
        return jsonify({"success": False, "message": "Invalid last name format."}), 400

    # Validate email format
    email_pattern = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
    if not re.match(email_pattern, email):
        return jsonify({"success": False, "message": "Invalid email format."}), 400

    # Validate password strength
    password_pattern = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$"
    if not re.match(password_pattern, password):
        return jsonify({
            "success": False,
            "message": "Password must be at least 8 characters long, include uppercase, lowercase, and a number."
        }), 400

    # Check if email already exists
    if find_user_by_email(email):
        return jsonify({"success": False, "message": "Email is already registered."}), 400

    # Save new user
    save_user_to_csv(first_name, last_name, email, password)
    return jsonify({"success": True, "message": "Registration successful."})

@app.route('/login', methods=['POST'])
def login():
    """Handle user login and verify credentials."""
    data = request.get_json()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    user = find_user_by_email(email)
    if user and verify_password(password, user["password"]):
        return jsonify({
            "success": True,
            "message": "Login successful",
            "name": f"{user['first_name']}"
        })
    else:
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze an image frame for disease using YOLOv8 and provide LLM recommendations."""
    data = request.get_json()
    frame_data = data.get('frame').split(',')[1]  # Remove data URL prefix
    frame_bytes = base64.b64decode(frame_data)
    np_arr = np.frombuffer(frame_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    results = model(img)
    detections = results[0].boxes

    if detections is None or len(detections) == 0:
        # No disease detected - get general healthy recommendation
        llm_response = llm_service.get_initial_recommendation("No disease detected", 0)
        return jsonify({
            'disease': "No disease detected", 
            'confidence': 0,
            'recommendation': llm_response
        })

    # Pick the detection with highest confidence
    top_conf_idx = np.argmax(detections.conf.cpu().numpy())
    disease = model.names[int(detections.cls[top_conf_idx])]
    confidence = float(detections.conf[top_conf_idx]) * 100

    # Debug: Print the analysis results
    print(f"DEBUG: Analysis results - Disease: {disease}, Confidence: {confidence}")

    # Get LLM recommendation based on the diagnosis
    llm_response = llm_service.get_initial_recommendation(disease, confidence)

    return jsonify({
        'disease': disease, 
        'confidence': round(confidence, 2),
        'recommendation': llm_response
    })

@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat messages with LLM for additional recommendations. Analysis is optional."""
    data = request.get_json()
    user_message = data.get('message', '').strip()
    diagnosis = data.get('diagnosis', '') or ''
    confidence = data.get('confidence', 0) or 0
    
    # Debug: Print the chat request data
    print(f"DEBUG: Chat request - Message: {user_message}, Diagnosis: {diagnosis}, Confidence: {confidence}")
    
    if not user_message:
        return jsonify({"success": False, "message": "Message is required"}), 400
    
    # Get LLM recommendation - works with or without analysis
    # If diagnosis/confidence provided, it increases confidence; otherwise provides general advice
    llm_response = llm_service.get_recommendation(diagnosis, confidence, user_message)
    
    return jsonify({
        "success": True,
        "response": llm_response["recommendation"],
        "status": llm_response["status"]
    })

@app.route('/health', methods=['GET'])
def health():
    """Simple health check endpoint for Electron to confirm Flask server is running."""
    return jsonify({"status": "ok"}), 200

<<<<<<< Updated upstream
=======
@app.route('/status', methods=['GET'])
def status():
    if 'email' in session:
        return jsonify({"logged_in": True, "email": session['email']})
    else:
        return jsonify({"logged_in": False})

@app.route('/analysis-history', methods=['GET'])
def get_analysis_history():
    """Get analysis history for the current user."""
    if 'email' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    email = session['email']
    history = load_user_analysis_history(email)
    return jsonify({"success": True, "history": history})

@app.route('/analysis-history', methods=['POST'])
def add_analysis_history():
    """Add an analysis entry to user's history."""
    if 'email' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    data = request.get_json()
    email = session['email']
    image_src = data.get('imageSrc', '')
    diagnosis = data.get('diagnosis', '')
    confidence = data.get('confidence', '')
    image_filename = data.get('imageFilename', None)
    
    history = add_to_user_history(email, image_src, diagnosis, confidence, image_filename)
    return jsonify({"success": True, "history": history})

@app.route('/analysis-history/clear', methods=['POST'])
def clear_analysis_history():
    """Clear analysis history for the current user."""
    if 'email' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    email = session['email']
    if clear_user_history(email):
        return jsonify({"success": True, "message": "History cleared"})
    else:
        return jsonify({"success": False, "message": "Failed to clear history"}), 500
    
>>>>>>> Stashed changes
# ----------------------------
# Start Flask Server
# ----------------------------
if __name__ == '__main__':
    # Runs the Flask server on localhost:5000
    app.run(host='127.0.0.1', port=5000)
