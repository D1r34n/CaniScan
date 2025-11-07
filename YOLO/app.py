from flask import Flask, request, jsonify, session
from flask_cors import CORS
from ultralytics import YOLO
import cv2, base64, numpy as np, re, csv, os, bcrypt
from datetime import datetime
from llm_service import llm_service

# ----------------------------
# Flask App Initialization
# ----------------------------
app = Flask(__name__)

CORS(app)  # Enable Cross-Origin requests, necessary for Electron <-> Flask communication
app.secret_key = "skibidi"

# ----------------------------
# Load YOLO Model for Disease Detection
# ----------------------------
model = YOLO(r"runs\detect\train2\weights\best.pt")  # Path to trained YOLOv8 weights

# ----------------------------
# User Database Setup
# ----------------------------

# Get the directory where this script is located
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
USERS_CSV = os.path.join(BASE_DIR, "csv", "users.csv")
ANALYSIS_CSV = os.path.join(BASE_DIR, "csv", "analysis_results.csv")

# Ensure the CSV directory exists
csv_dir = os.path.join(BASE_DIR, "csv")
os.makedirs(csv_dir, exist_ok=True)
USERS_CSV = "users.csv"

# Ensure the CSV file exists; create with headers if not
if not os.path.exists(USERS_CSV):
    with open(USERS_CSV, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["first_name", "last_name", "email", "password"])  # CSV headers

# Ensure the analysis results CSV file exists; create with headers if not
if not os.path.exists(ANALYSIS_CSV):
    with open(ANALYSIS_CSV, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "email", "diagnosis", "confidence"])  # CSV headers

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
# Analysis Results CSV Utilities
# ----------------------------
def save_analysis_to_csv(email: str, diagnosis: str, confidence: float):
    """Save analysis results to CSV file."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(ANALYSIS_CSV, mode="a", newline="") as file:
        writer = csv.writer(file)
        writer.writerow([timestamp, email, diagnosis, round(confidence, 2)])

def get_latest_analysis(email: str):
    """Get the latest analysis result for a user from CSV."""
    if not os.path.exists(ANALYSIS_CSV):
        return None
    
    latest_analysis = None
    latest_timestamp = None
    
    with open(ANALYSIS_CSV, mode="r") as file:
        reader = csv.DictReader(file)
        for row in reader:
            if row["email"].strip().lower() == email.strip().lower():
                timestamp = row["timestamp"]
                # Compare timestamps to find the latest
                if latest_timestamp is None or timestamp > latest_timestamp:
                    latest_timestamp = timestamp
                    latest_analysis = {
                        "diagnosis": row["diagnosis"],
                        "confidence": float(row["confidence"]),
                        "timestamp": timestamp
                    }
    
    return latest_analysis

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
    data = request.get_json()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    user = find_user_by_email(email)
    if user and verify_password(password, user["password"]):
        # Set session
        session['email'] = user["email"]
        session['name'] = user['first_name']
        return jsonify({
            "success": True,
            "message": "Login successful",
            "name": user['first_name'],
            "email": user["email"]
        })
    else:
        return jsonify({"success": False, "message": "Invalid credentials"}), 401


@app.route('/logout', methods=['POST'])
def logout():
    session.clear()  # Remove all session data
    return jsonify({"success": True, "message": "Logged out successfully"})


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

    # Get user email from session (or use 'anonymous' if not logged in)
    user_email = session.get('email', 'anonymous')

    if detections is None or len(detections) == 0:
        # No disease detected - get general healthy recommendation
        diagnosis = "No disease detected"
        confidence = 0
        
        # Save to CSV
        save_analysis_to_csv(user_email, diagnosis, confidence)
        
        llm_response = llm_service.get_initial_recommendation(diagnosis, confidence)
        return jsonify({
            'disease': diagnosis, 
            'confidence': confidence,
            'recommendation': llm_response
        })

    # Pick the detection with highest confidence
    top_conf_idx = np.argmax(detections.conf.cpu().numpy())
    disease = model.names[int(detections.cls[top_conf_idx])]
    confidence = float(detections.conf[top_conf_idx]) * 100

    # Debug: Print the analysis results
    print(f"DEBUG: Analysis results - Disease: {disease}, Confidence: {confidence}")

    # Save analysis results to CSV
    save_analysis_to_csv(user_email, disease, confidence)
    print(f"DEBUG: Saved analysis to CSV - Email: {user_email}, Diagnosis: {disease}, Confidence: {confidence}")

    # Get LLM recommendation based on the diagnosis
    llm_response = llm_service.get_initial_recommendation(disease, confidence)

    return jsonify({
        'disease': disease, 
        'confidence': round(confidence, 2),
        'recommendation': llm_response
    })

@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat messages with LLM - reads diagnosis/confidence from CSV instead of POST data."""
    data = request.get_json()
    user_message = data.get('message', '').strip()
    
    # Get user email from session (or use 'anonymous' if not logged in)
    user_email = session.get('email', 'anonymous')
    
    # Read latest analysis from CSV instead of POST data
    latest_analysis = get_latest_analysis(user_email)
    
    if latest_analysis:
        diagnosis = latest_analysis['diagnosis']
        confidence = latest_analysis['confidence']
        print(f"DEBUG: Chat - Read from CSV - Diagnosis: {diagnosis}, Confidence: {confidence}")
    else:
        # Fallback: check if diagnosis/confidence were sent in POST (for backward compatibility)
        diagnosis = data.get('diagnosis', '').strip() if data.get('diagnosis') else ''
        confidence = float(data.get('confidence', 0)) if data.get('confidence') else 0
        print(f"DEBUG: Chat - No CSV data found, using POST data - Diagnosis: {diagnosis}, Confidence: {confidence}")
    
    if not user_message:
        return jsonify({"success": False, "message": "Message is required"}), 400
    
    # Get LLM recommendation - works with or without image analysis data
    llm_response = llm_service.get_recommendation(diagnosis, confidence, user_message)
    
    return jsonify({
        "success": True,
        "response": llm_response["recommendation"],
        "status": llm_response["status"]
    })

@app.route('/get-current-analysis', methods=['GET'])
def get_current_analysis():
    """Get the latest analysis results from CSV for the current user."""
    user_email = session.get('email', 'anonymous')
    latest_analysis = get_latest_analysis(user_email)
    
    if latest_analysis:
        return jsonify({
            "success": True,
            "diagnosis": latest_analysis['diagnosis'],
            "confidence": latest_analysis['confidence'],
            "timestamp": latest_analysis['timestamp']
        })
    else:
        return jsonify({
            "success": False,
            "message": "No analysis found",
            "diagnosis": "",
            "confidence": 0
        })

@app.route('/clear-analysis-history', methods=['POST'])
def clear_analysis_history():
    """Clear analysis history from CSV for the current user."""
    user_email = session.get('email', 'anonymous')
    
    if not os.path.exists(ANALYSIS_CSV):
        return jsonify({
            "success": True,
            "message": "No analysis history found to clear"
        })
    
    try:
        # Read all rows except those matching the user's email
        rows_to_keep = []
        with open(ANALYSIS_CSV, mode="r") as file:
            reader = csv.DictReader(file)
            fieldnames = reader.fieldnames
            for row in reader:
                # Keep rows that don't match the current user's email
                if row["email"].strip().lower() != user_email.strip().lower():
                    rows_to_keep.append(row)
        
        # Write back only the rows to keep
        with open(ANALYSIS_CSV, mode="w", newline="") as file:
            if fieldnames:
                writer = csv.DictWriter(file, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows_to_keep)
        
        print(f"DEBUG: Cleared analysis history for user: {user_email}")
        
        return jsonify({
            "success": True,
            "message": f"Analysis history cleared for {user_email}"
        })
    except Exception as e:
        print(f"Error clearing analysis history: {e}")
        return jsonify({
            "success": False,
            "message": f"Error clearing analysis history: {str(e)}"
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Simple health check endpoint for Electron to confirm Flask server is running."""
    return jsonify({"status": "ok"}), 200

@app.route('/status', methods=['GET'])
def status():
    if 'email' in session:
        return jsonify({"logged_in": True, "email": session['email']})
    else:
        return jsonify({"logged_in": False})
    
# ----------------------------
# Start Flask Server
# ----------------------------
if __name__ == '__main__':
    # Runs the Flask server on localhost:5000
    app.run(host='127.0.0.1', port=5000)
