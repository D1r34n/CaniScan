"""
CaniScan Flask Backend
Disease detection API with YOLO model and LLM recommendations
"""

import json
import os
import re
import csv
import base64
import bcrypt
import time
import numpy as np
import cv2
from datetime import datetime
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from ultralytics import YOLO
from supabase import create_client, Client
from dotenv import load_dotenv
from llm_service import llm_service

# ========================================
# CONFIGURATION
# ========================================

load_dotenv()

# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials in .env file")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Flask App Initialization
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-in-production")

# CORS Configuration - Restrict to Electron origins
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:*", "http://127.0.0.1:*", "file://*"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "supports_credentials": True
    }
})

# Session Configuration
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True  # Set to True in production with HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True

# File Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_DIR = os.path.join(BASE_DIR, "csv")
ANALYSIS_CSV = os.path.join(CSV_DIR, "analysis_results.csv")

# Ensure CSV directory exists
os.makedirs(CSV_DIR, exist_ok=True)

# YOLO Model
MODEL_PATH = os.path.join(BASE_DIR, "runs", "v8", "n", "train_results2", "weights", "best.pt")
model = YOLO(MODEL_PATH, verbose=False)

# Initialize analysis CSV
if not os.path.exists(ANALYSIS_CSV):
    with open(ANALYSIS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "email", "disease", "confidence"])

print("✅ Flask server initialized successfully")

# ========================================
# VALIDATION PATTERNS
# ========================================

NAME_PATTERN = r"^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,50}$"
EMAIL_PATTERN = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
PASSWORD_PATTERN = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$"

# ========================================
# UTILITY FUNCTIONS - Password
# ========================================

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify plain password against hashed password."""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

# ========================================
# UTILITY FUNCTIONS - User Database
# ========================================

def find_user_by_email(email: str) -> dict | None:
    """Find user in Supabase by email."""
    try:
        response = supabase.table("users").select("*").eq("email", email).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error finding user: {e}")
        return None

def create_user(first_name: str, last_name: str, email: str, password: str) -> dict:
    """Create new user in Supabase."""
    hashed_password = hash_password(password)
    
    response = supabase.table("users").insert({
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "password": hashed_password,
        "avatar_id": 0
    }).execute()
    
    if hasattr(response, 'error') and response.error:
        raise Exception(f"Supabase error: {response.error}")
    
    return response.data[0] if response.data else None

# ========================================
# UTILITY FUNCTIONS - Analysis CSV
# ========================================

def save_analysis_to_csv(email: str, detections: list) -> None:
    """
    Save all detections for an image in CSV as JSON.
    detections: list of dicts like [{"disease": "hotspot", "confidence": 90.0, "bbox": [x1,y1,x2,y2]}, ...]
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        with open(ANALYSIS_CSV, mode="a", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow([timestamp, email, json.dumps(detections)])
        print(f"✅ Saved analysis for {email} ({len(detections)} detections)")
    except Exception as e:
        print(f"❌ Error saving analysis: {e}")

def get_latest_analysis(email: str) -> dict | None:
    """Get the latest analysis result for a user from CSV."""
    if not os.path.exists(ANALYSIS_CSV):
        return None
    
    latest_analysis = None
    latest_timestamp = None
    
    try:
        with open(ANALYSIS_CSV, mode="r", encoding="utf-8") as file:
            reader = csv.DictReader(file, fieldnames=["timestamp","email","disease"])
            for row in reader:
                if row["email"].strip().lower() == email.strip().lower():
                    timestamp = row["timestamp"]
                    if latest_timestamp is None or timestamp > latest_timestamp:
                        latest_timestamp = timestamp
                        latest_analysis = {
                            "timestamp": timestamp,
                            "detections": json.loads(row["disease"])
                        }
    except Exception as e:
        print(f"Error reading analysis: {e}")
        return None
    
    return latest_analysis

def clear_user_analysis(email: str) -> bool:
    """Clear all analysis records for a specific user."""
    if not os.path.exists(ANALYSIS_CSV):
        return True
    
    try:
        rows_to_keep = []
        
        with open(ANALYSIS_CSV, mode="r", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            fieldnames = reader.fieldnames
            
            for row in reader:
                if row["email"].strip().lower() != email.strip().lower():
                    rows_to_keep.append(row)
        
        with open(ANALYSIS_CSV, mode="w", newline="", encoding="utf-8") as file:
            if fieldnames:
                writer = csv.DictWriter(file, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows_to_keep)
        
        print(f"✅ Cleared analysis history for: {email}")
        return True
    except Exception as e:
        print(f"❌ Error clearing analysis: {e}")
        return False

# ========================================
# VALIDATION FUNCTIONS
# ========================================

def validate_registration_data(data: dict) -> tuple[bool, str]:
    """Validate registration input data."""
    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()
    
    # Check required fields
    if not all([first_name, last_name, email, password]):
        return False, "All fields are required"
    
    # Validate names
    if not re.match(NAME_PATTERN, first_name):
        return False, "Invalid first name format"
    if not re.match(NAME_PATTERN, last_name):
        return False, "Invalid last name format"
    
    # Validate email
    if not re.match(EMAIL_PATTERN, email):
        return False, "Invalid email format"
    
    # Validate password
    if not re.match(PASSWORD_PATTERN, password):
        return False, "Password must be at least 8 characters with uppercase, lowercase, and number"
    
    return True, "Valid"

# ========================================
# AUTHENTICATION ROUTES
# ========================================

@app.route('/register', methods=['POST'])
def register():
    """Register a new user account."""
    try:
        data = request.get_json()
        
        # Validate input
        is_valid, message = validate_registration_data(data)
        if not is_valid:
            return jsonify({"success": False, "message": message}), 400
        
        # Extract validated fields
        first_name = data["first_name"].strip()
        last_name = data["last_name"].strip()
        email = data["email"].strip().lower()
        password = data["password"].strip()
        
        # Check if email exists
        existing_user = find_user_by_email(email)
        if existing_user:
            return jsonify({"success": False, "message": "Email already registered"}), 400
        
        # Create user
        user = create_user(first_name, last_name, email, password)
        
        if not user:
            return jsonify({"success": False, "message": "Failed to create user"}), 500
        
        print(f"✅ New user registered: {email}")
        return jsonify({"success": True, "message": "Registration successful"}), 201
        
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return jsonify({"success": False, "message": "Server error occurred"}), 500

@app.route('/login', methods=['POST'])
def login():
    """Login user and create session."""
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()
        
        # Validate input
        if not email or not password:
            return jsonify({"success": False, "message": "Email and password required"}), 400
        
        # Find user
        user = find_user_by_email(email)
        if not user or "password" not in user:
            return jsonify({"success": False, "message": "Invalid credentials"}), 401
        
        # Verify password
        if not verify_password(password, user["password"]):
            return jsonify({"success": False, "message": "Invalid credentials"}), 401
        
        # Create session
        session['email'] = user["email"]
        session['name'] = user['first_name']
        session['lastname'] = user['last_name']
        
        print(f"✅ User logged in: {email}")
        
        return jsonify({
            "success": True,
            "message": "Login successful",
            "name": user['first_name'],
            "email": user["email"]
        }), 200
        
    except Exception as e:
        print(f"❌ Login error: {e}")
        return jsonify({"success": False, "message": "Server error occurred"}), 500

@app.route('/logout', methods=['POST'])
def logout():
    """Logout user and clear session."""
    email = session.get('email', 'unknown')
    session.clear()
    print(f"✅ User logged out: {email}")
    return jsonify({"success": True, "message": "Logged out successfully"}), 200

@app.route('/status', methods=['GET'])
def status():
    """Check if user is logged in."""
    email = session.get('email')
    if not email:
        return jsonify({"logged_in": False}), 200

    try:
        # Fetch user data from Supabase
        response = supabase.table("users").select("first_name, last_name, avatar_id, email").eq("email", email).execute()
        if not response.data:
            return jsonify({"logged_in": False}), 200

        user = response.data[0]
        name = f"{user.get('first_name', '')}".strip()
        lastname = f"{user.get('last_name', '')}".strip()
        return jsonify({
            "logged_in": True,
            "email": user.get('email'),
            "name": name or "User",
            "lastname": lastname or "name",
            "avatar_id": user.get("avatar_id", 0)
        }), 200

    except Exception as e:
        print(f"❌ Status error: {e}")
        return jsonify({"logged_in": False}), 500

# ========================================
# USER PROFILE ROUTES
# ========================================

@app.route('/update-user', methods=['POST'])
def update_user():
    """Update user profile information."""
    email = session.get('email')

    if not email:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401

    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'Invalid JSON payload'}), 400

        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        avatar_id = data.get('avatar_id')

        update_data = {}

        # ✅ Validate and add first name if present
        if first_name:
            if not re.match(NAME_PATTERN, first_name):
                return jsonify({'success': False, 'message': 'Invalid first name'}), 400
            update_data["first_name"] = first_name

        # ✅ Validate and add last name if present
        if last_name:
            if not re.match(NAME_PATTERN, last_name):
                return jsonify({'success': False, 'message': 'Invalid last name'}), 400
            update_data["last_name"] = last_name

        # ✅ Validate and add avatar ID (explicitly allow 0)
        if avatar_id is not None:
            if not isinstance(avatar_id, int) or not (0 <= avatar_id < 5):
                return jsonify({'success': False, 'message': 'Invalid avatar ID'}), 400
            update_data["avatar_id"] = avatar_id

        # ✅ Prevent unnecessary DB calls
        if not update_data:
            return jsonify({'success': False, 'message': 'No changes to update'}), 400

        # ✅ Update user in database
        response = supabase.table("users").update(update_data).eq("email", email).execute()

        # ⚠️ Supabase-Python doesn’t have .error attribute anymore (you saw this earlier)
        # So use response.get("error") if response is a dict, or skip this check
        if isinstance(response, dict) and response.get("error"):
            return jsonify({'success': False, 'message': f"Database error: {response['error']}"}), 500

        # ✅ Update session data
        session.update(update_data)

        print(f"✅ Profile updated: {email}")

        return jsonify({
            'success': True,
            'message': 'Profile updated successfully',
            'data': update_data
        }), 200

    except Exception as e:
        print(f"❌ Update error: {e}")
        return jsonify({'success': False, 'message': 'Server error occurred'}), 500

# ========================================
# DISEASE ANALYSIS ROUTES
# ========================================

# ----------------------------
# Load YOLO Model for Disease Detection
# ----------------------------
Yolov8 = YOLO(r"runs\v8\n\train_results2\weights\best.pt")  # Path to trained YOLOv8 weights
print("Class names: ", Yolov8.names)
Yolov11 = YOLO(r"runs\11\n\train_results\weights\best.pt")
print("Class names: ", Yolov11.names)
# actual path: C:\Users\Edrian\Documents\VSCodeProjects\CaniScan\runs\v8\n\train_results2\weights\best.pt


@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze image for multiple disease detections using YOLO."""
    try:
        print("🔹 Received /analyze request")
        data = request.get_json()
        user_email = session.get('email', 'anonymous')

        # Decode base64 image
        frame_data = data.get('frame', '').split(',')[-1]
        frame_bytes = base64.b64decode(frame_data)
        np_arr = np.frombuffer(frame_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({'success': False, 'message': 'Invalid image data'}), 400
        print(f"🔹 Image decoded: shape={img.shape}")

        # Select model
        model_name = data.get('model', 'Yolov8')
        model = Yolov11 if model_name.lower() == 'yolov11n' else Yolov8
        print(f"🔹 Using model: {model_name}")

        # Run YOLO detection
        start_time = time.time()
        results = model(img)
        inference_time = time.time() - start_time
        print(f"🔹 YOLO inference completed in {inference_time:.3f}s")

        boxes = results[0].boxes  # ultralytics Boxes object
        names_map = getattr(model, "names", {})

        detected_list = []
        annotated_img = img.copy()

        # Draw all detections
        if boxes is not None and len(boxes) > 0:
            for box in boxes:
                try:
                    cls_idx = int(box.cls.cpu().numpy().item())
                    conf = float(box.conf.cpu().numpy().item()) * 100
                    disease = names_map.get(cls_idx, f"class_{cls_idx}")
                    xy = box.xyxy.cpu().numpy()
                    coords = xy[0].tolist() if xy.ndim == 2 else xy.tolist()
                    x1, y1, x2, y2 = map(int, coords)

                    detected_list.append({
                        "disease": disease,
                        "confidence": round(conf, 2),
                        "bbox": [x1, y1, x2, y2]
                    })

                    # Draw bounding boxes
                    cv2.rectangle(annotated_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(
                        annotated_img,
                        f"{disease} {conf:.1f}%",
                        (x1, max(y1 - 10, 0)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (0, 255, 0),
                        2
                    )
                except Exception as e:
                    print(f"❌ Error processing box: {e}")
                    continue

        # If no detections, mark as healthy
        if not detected_list:
            detected_list = [{"disease": "healthy", "confidence": 0, "bbox": []}]
            confidence_list = [0]
        else:
            confidence_list = [det["confidence"] for det in detected_list]

        # Unique summary for LLM
        unique_summary = {}
        for det in detected_list:
            disease = det["disease"]
            if disease not in unique_summary or det["confidence"] > unique_summary[disease]["confidence"]:
                unique_summary[disease] = det

        # Save analysis
        save_analysis_to_csv(user_email, detected_list)

        # Convert annotated image to base64
        _, buffer = cv2.imencode('.jpg', annotated_img)
        annotated_b64 = base64.b64encode(buffer).decode('utf-8')
        annotated_uri = "data:image/jpeg;base64," + annotated_b64

        # LLM summary
        try:
            llm_summary = llm_service.summarize_multiple_detections(list(unique_summary.values()))
        except AttributeError:
            print("❌ summarize_multiple_detections not implemented")
            llm_summary = "Summary not available."

        # For frontend
        disease_str = ", ".join(unique_summary.keys())

        print(f"✅ Multi-analysis complete ({len(detected_list)} detections)")

        return jsonify({
            'success': True,
            'detections': detected_list,
            'disease': disease_str,
            'confidence': confidence_list,
            'inference_time': round(inference_time, 3),
            'annotated_image': annotated_uri,
            'summary': llm_summary
        }), 200

    except Exception as e:
        print(f"❌ Analysis error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': 'Analysis failed'}), 500


@app.route('/clear-analysis-history', methods=['POST'])
def clear_analysis_history():
    """Clear analysis history for current user."""
    user_email = session.get('email', 'anonymous')
    
    success = clear_user_analysis(user_email)
    
    if success:
        return jsonify({
            "success": True,
            "message": f"Analysis history cleared for {user_email}"
        }), 200
    else:
        return jsonify({
            "success": False,
            "message": "Failed to clear analysis history"
        }), 500

# ========================================
# LLM CHAT ROUTES
# ========================================

@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat messages with LLM recommendations."""
    try:
        data = request.get_json()
        user_message = data.get('message', '').strip()
        
        if not user_message:
            return jsonify({"success": False, "message": "Message is required"}), 400
        
        # Get user email and latest analysis
        user_email = session.get('email', 'anonymous')
        latest_analysis = get_latest_analysis(user_email)
        
        # Extract diagnosis and confidence
        disease_list = latest_analysis['detections'] if latest_analysis else []
        disease_str = ", ".join([d['disease'] for d in disease_list]) if disease_list else "healthy"
        confidence_list = [d['confidence'] for d in disease_list]  # list of all confidences
        
        # Get LLM response
        llm_response = llm_service.get_recommendation(disease_str, confidence_list, user_message)
        
        return jsonify({
            "success": True,
            "response": llm_response["recommendation"],
            "status": llm_response.get("status", "success")
        }), 200
        
    except Exception as e:
        print(f"❌ Chat error: {e}")
        return jsonify({
            "success": False,
            "message": "Chat service unavailable"
        }), 500

@app.route('/generate-insights', methods=['POST'])
def generate_insights():
    """
    Generate insights based on current disease counts from frontend stat cards.
    Expects JSON payload like:
    {
        "disease_counts": {
            "hotspot": 2,
            "mange": 1,
            "fungal infection": 0,
            "allergic dermatitis": 1
        },
        "user_message": "Optional question from user"
    }
    """
    try:
        data = request.get_json()
        if not data or 'disease_counts' not in data:
            return jsonify({"success": False, "message": "disease_counts required"}), 400
        
        disease_counts = data['disease_counts']
        user_message = data.get('user_message', '')

        # Convert counts into a list of disease dicts
        disease_list = [
            {"disease": k, "count": v}
            for k, v in disease_counts.items() if v > 0
        ]

        # If nothing detected
        if not disease_list:
            return jsonify({
                "success": True,
                "insights": "Your pet looks healthy!"
            }), 200

        # Call your LLM service
        try:
            # Summarize based on disease list and optional message
            llm_summary = llm_service.summarize_from_counts(disease_list, user_message)
        except AttributeError:
            # fallback if method not implemented
            llm_summary = "LLM insights not available."

        return jsonify({
            "success": True,
            "insights": llm_summary
        }), 200

    except Exception as e:
        print(f"❌ Generate insights error: {e}")
        return jsonify({"success": False, "message": "Failed to generate insights"}), 500

# ========================================
# HEALTH CHECK ROUTE
# ========================================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "service": "CaniScan API",
        "timestamp": datetime.now().isoformat()
    }), 200

# ========================================
# START SERVER
# ========================================

if __name__ == '__main__':
    print("=" * 50)
    print("Starting CaniScan Flask Server")
    print("=" * 50)
    print("Host: 127.0.0.1")
    print("Port: 5000")
    print(f"Database: Supabase")
    print(f"Model: YOLOv8")
    print("=" * 50)
    
    app.run(host='127.0.0.1', port=5000, debug=True)