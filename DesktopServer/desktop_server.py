from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import os
import uuid
from datetime import datetime
import json
import socket
import subprocess
import platform
import signal
import sys

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration - Point to uploads folder outside of desktop server
# Get the parent directory of the current script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(os.path.dirname(BASE_DIR), 'uploads')

# Alternative: Use absolute path
# UPLOAD_FOLDER = r'C:\path\to\your\uploads'  # Windows
# UPLOAD_FOLDER = '/path/to/your/uploads'      # Linux/Mac

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}

# Create upload directory if it doesn't exist
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
    print(f"Created uploads folder at: {UPLOAD_FOLDER}")
else:
    print(f"Using uploads folder at: {UPLOAD_FOLDER}")

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_local_ip():
    """Get the local IP address of the machine"""
    try:
        # Method 1: Connect to a remote address to get local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        try:
            # Method 2: Use hostname resolution
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)
            if local_ip.startswith('127.'):
                # If it's localhost, try alternative method
                return get_local_ip_alternative()
            return local_ip
        except Exception:
            return get_local_ip_alternative()

def get_local_ip_alternative():
    """Alternative method using system commands"""
    try:
        system = platform.system().lower()
        if system == "windows":
            # Windows command
            result = subprocess.run(['ipconfig'], capture_output=True, text=True)
            lines = result.stdout.split('\n')
            for i, line in enumerate(lines):
                if 'Wireless LAN adapter Wi-Fi:' in line or 'Ethernet adapter Ethernet:' in line:
                    # Look for IPv4 address in next few lines
                    for j in range(i+1, min(i+10, len(lines))):
                        if 'IPv4 Address' in lines[j]:
                            ip = lines[j].split(':')[-1].strip()
                            if not ip.startswith('127.'):
                                return ip
        else:
            # Linux/Mac command
            result = subprocess.run(['hostname', '-I'], capture_output=True, text=True)
            ips = result.stdout.strip().split()
            for ip in ips:
                if not ip.startswith('127.'):
                    return ip
    except Exception:
        pass
    return "192.168.1.100"  # Fallback

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'Caniscan Desktop Server is running',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/ip', methods=['GET'])
def get_ip():
    """Get the local IP address of the server"""
    try:
        local_ip = get_local_ip()
        print(f"Detected local IP: {local_ip}")
        return jsonify({
            'success': True,
            'ip': local_ip,
            'message': 'Local IP address retrieved successfully',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        print(f"Failed to get IP address: {str(e)}")
        return jsonify({
            'success': False,
            'ip': '192.168.1.100',
            'message': f'Failed to get IP: {str(e)}',
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle image uploads from Android app"""
    try:
        if 'image' not in request.files:
            return jsonify({
                'success': False,
                'message': 'No image file provided'
            }), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({
                'success': False,
                'message': 'No file selected'
            }), 400
        
        if file and allowed_file(file.filename):
            # Generate unique filename
            file_extension = file.filename.rsplit('.', 1)[1].lower()
            unique_filename = f"{uuid.uuid4()}.{file_extension}"
            
            # Save file
            file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
            file.save(file_path)
            
            # Get file info
            file_size = os.path.getsize(file_path)
            
            # Log the upload
            upload_info = {
                'filename': unique_filename,
                'original_name': file.filename,
                'size': file_size,
                'timestamp': datetime.now().isoformat(),
                'client_ip': request.remote_addr
            }
            
            print(f"Image uploaded: {upload_info}")
            
            return jsonify({
                'success': True,
                'message': 'Image uploaded successfully',
                'filename': unique_filename,
                'size': file_size,
                'timestamp': upload_info['timestamp']
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Invalid file type. Allowed types: ' + ', '.join(ALLOWED_EXTENSIONS)
            }), 400
            
    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Upload failed: {str(e)}'
        }), 500

@app.route('/images', methods=['GET'])
def list_images():
    """List all uploaded images and folders"""
    try:
        path = request.args.get('path', '')
        current_path = os.path.join(UPLOAD_FOLDER, path) if path else UPLOAD_FOLDER
        
        if not os.path.exists(current_path):
            return jsonify({
                'success': False,
                'message': 'Path not found'
            }), 404
        
        images = []
        folders = []
        
        for item in os.listdir(current_path):
            item_path = os.path.join(current_path, item)
            
            if os.path.isdir(item_path):
                # Count items in folder
                item_count = len([f for f in os.listdir(item_path) 
                                if os.path.isfile(os.path.join(item_path, f)) and allowed_file(f)])
                folders.append({
                    'name': item,
                    'type': 'folder',
                    'item_count': item_count,
                    'path': os.path.join(path, item).replace('\\', '/') if path else item
                })
            elif allowed_file(item):
                file_size = os.path.getsize(item_path)
                file_time = os.path.getmtime(item_path)
                
                images.append({
                    'filename': item,
                    'size': file_size,
                    'uploaded_at': datetime.fromtimestamp(file_time).isoformat(),
                    'path': os.path.join(path, item).replace('\\', '/') if path else item
                })
        
        # Sort by upload time (newest first)
        images.sort(key=lambda x: x['uploaded_at'], reverse=True)
        # Sort folders alphabetically
        folders.sort(key=lambda x: x['name'])
        
        return jsonify({
            'success': True,
            'images': images,
            'folders': folders,
            'count': len(images),
            'current_path': path
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to list images: {str(e)}'
        }), 500

@app.route('/images/<path:filepath>', methods=['GET'])
def get_image(filepath):
    """Serve uploaded images from any path"""
    try:
        # Security check - prevent directory traversal
        if '..' in filepath or filepath.startswith('/'):
            return jsonify({
                'success': False,
                'message': 'Invalid file path'
            }), 400
            
        file_path = os.path.join(UPLOAD_FOLDER, filepath)
        
        if os.path.exists(file_path) and os.path.isfile(file_path):
            filename = os.path.basename(file_path)
            if allowed_file(filename):
                from flask import send_file
                return send_file(file_path)
            else:
                return jsonify({
                    'success': False,
                    'message': 'Invalid file type'
                }), 400
        else:
            return jsonify({
                'success': False,
                'message': 'Image not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to serve image: {str(e)}'
        }), 500

@app.route('/folders', methods=['POST'])
def create_folder():
    """Create a new folder"""
    try:
        data = request.get_json()
        folder_name = data.get('name', '').strip()
        parent_path = data.get('path', '')
        
        if not folder_name:
            return jsonify({
                'success': False,
                'message': 'Folder name is required'
            }), 400
        
        # Security check - prevent directory traversal
        if '..' in folder_name or '/' in folder_name or '\\' in folder_name:
            return jsonify({
                'success': False,
                'message': 'Invalid folder name'
            }), 400
        
        # Create folder path
        if parent_path:
            folder_path = os.path.join(UPLOAD_FOLDER, parent_path, folder_name)
        else:
            folder_path = os.path.join(UPLOAD_FOLDER, folder_name)
        
        # Check if folder already exists
        if os.path.exists(folder_path):
            return jsonify({
                'success': False,
                'message': 'Folder already exists'
            }), 400
        
        # Create the folder
        os.makedirs(folder_path, exist_ok=True)
        print(f"Folder created: {folder_path}")
        
        return jsonify({
            'success': True,
            'message': 'Folder created successfully',
            'folder_name': folder_name,
            'folder_path': os.path.join(parent_path, folder_name).replace('\\', '/') if parent_path else folder_name
        })
        
    except Exception as e:
        print(f"Create folder error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Failed to create folder: {str(e)}'
        }), 500

@app.route('/images/<path:filepath>', methods=['DELETE'])
def delete_image(filepath):
    """Delete uploaded images from any path"""
    try:
        # Security check - prevent directory traversal
        if '..' in filepath or filepath.startswith('/'):
            return jsonify({
                'success': False,
                'message': 'Invalid file path'
            }), 400
            
        file_path = os.path.join(UPLOAD_FOLDER, filepath)
        
        if os.path.exists(file_path) and os.path.isfile(file_path):
            filename = os.path.basename(file_path)
            if allowed_file(filename):
                os.remove(file_path)
                print(f"Image deleted: {filepath}")
                return jsonify({
                    'success': True,
                    'message': 'Image deleted successfully'
                })
            else:
                return jsonify({
                    'success': False,
                    'message': 'Invalid file type'
                }), 400
        else:
            return jsonify({
                'success': False,
                'message': 'Image not found'
            }), 404
    except Exception as e:
        print(f"Delete error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Failed to delete image: {str(e)}'
        }), 500

@app.route('/shutdown', methods=['POST'])
def shutdown():
    """Shutdown the Flask server"""
    try:
        print("Shutdown request received. Stopping server...")
        func = request.environ.get('werkzeug.server.shutdown')
        if func is None:
            # For production servers, we need to use os._exit
            os._exit(0)
        func()
        return jsonify({
            'success': True,
            'message': 'Server shutting down...'
        })
    except Exception as e:
        print(f"Shutdown error: {str(e)}")
        os._exit(0)

@app.route('/', methods=['GET'])
def dashboard():
    """Simple web dashboard to view uploaded images"""
    dashboard_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Caniscan Desktop Server</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: #f5f5f5;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 {
                color: #333;
                text-align: center;
                margin-bottom: 30px;
            }
            .status {
                background: #e8f5e8;
                border: 1px solid #4caf50;
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 20px;
                text-align: center;
            }
            .images-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }
            .image-card {
                border: 1px solid #ddd;
                border-radius: 8px;
                overflow: hidden;
                background: white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .image-card img {
                width: 100%;
                height: 150px;
                object-fit: cover;
            }
            .image-info {
                padding: 10px;
                font-size: 12px;
                color: #666;
            }
            .refresh-btn {
                background: #007bff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin-bottom: 20px;
            }
            .refresh-btn:hover {
                background: #0056b3;
            }
            .no-images {
                text-align: center;
                color: #666;
                font-style: italic;
                padding: 40px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📱 Caniscan Desktop Server</h1>
            
            <div class="status">
                <strong>✅ Server Status:</strong> Running and ready to receive images from your Android device
            </div>
            
            <button class="refresh-btn" onclick="loadImages()">🔄 Refresh Images</button>
            
            <div id="images-container">
                <div class="no-images">Loading images...</div>
            </div>
        </div>

        <script>
            function loadImages() {
                fetch('/images')
                    .then(response => response.json())
                    .then(data => {
                        const container = document.getElementById('images-container');
                        
                        if (data.success && data.images.length > 0) {
                            container.innerHTML = '<div class="images-grid">' +
                                data.images.map(image => `
                                    <div class="image-card">
                                        <img src="/images/${image.filename}" alt="${image.filename}">
                                        <div class="image-info">
                                            <strong>${image.filename}</strong><br>
                                            Size: ${(image.size / 1024).toFixed(1)} KB<br>
                                            Uploaded: ${new Date(image.uploaded_at).toLocaleString()}
                                        </div>
                                    </div>
                                `).join('') +
                                '</div>';
                        } else {
                            container.innerHTML = '<div class="no-images">No images uploaded yet. Use the Android app to upload images!</div>';
                        }
                    })
                    .catch(error => {
                        console.error('Error loading images:', error);
                        document.getElementById('images-container').innerHTML = 
                            '<div class="no-images">Error loading images. Please try again.</div>';
                    });
            }
            
            // Load images on page load
            loadImages();
            
            // Auto-refresh every 5 seconds
            setInterval(loadImages, 5000);
        </script>
    </body>
    </html>
    """
    return dashboard_html

if __name__ == '__main__':
    # Handle SIGINT (Ctrl+C) and SIGTERM signals
    def signal_handler(sig, frame):
        print("\n🛑 Shutting down Desktop Server...")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print("Starting Caniscan Desktop Server...")
    print(f"Uploads folder location: {UPLOAD_FOLDER}")
    print("Ready to receive images from Android app")
    print("Web dashboard available at: http://localhost:5000")
    print("API endpoints:")
    print("   - POST /upload - Upload images")
    print("   - GET /images - List all images and folders")
    print("   - GET /images/<path> - View specific image")
    print("   - DELETE /images/<path> - Delete specific image")
    print("   - POST /folders - Create new folder")
    print("   - POST /shutdown - Shutdown server")
    print("   - GET /health - Health check")
    print("   - GET /ip - Get local IP address")
    print("=" * 50)
    
    # Display detected IP address on startup
    try:
        detected_ip = get_local_ip()
        print(f"Detected local IP address: {detected_ip}")
        print(f"Use this IP address in your phone app: http://{detected_ip}:5001")
    except Exception as e:
        print(f"Could not detect IP address: {e}")
        print("Default IP address: 192.168.1.100")
    
    print("=" * 50)
    
    try:
        app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False)
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user.")
        sys.exit(0)