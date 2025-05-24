from flask import Flask, request, jsonify, send_from_directory, abort, Response
from flask_cors import CORS
import os
import json
import time # For SSE polling delay
from database import add_log_entry, get_logs_by_service, delete_logs_by_service, init_db, count_logs_by_service, get_db_connection
# We also need to import sqlite3 if we are catching sqlite3.Error
import sqlite3

# Initialize the database (ensures table is created on startup)
init_db()

app = Flask(__name__, static_folder='static')
CORS(app,
     origins=["http://localhost:3000", "http://localhost:9999", "http://localhost:8000"], # Allow client, CLM UI, and Server
     methods=["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"], # Common request headers
     supports_credentials=True)

# --- API Endpoints ---

@app.route('/log', methods=['POST'])
def handle_log():
    """
    Receives a log entry and stores it.
    JSON payload expected:
    {
        "service": "client" | "server",
        "level": "info" | "success" | "warning" | "error",
        "message": "Log message content",
        "details": "Optional detailed information or object"
    }
    """
    if not request.is_json:
        app.logger.warning(f"Bad request to /log: not JSON. Raw data: {request.data.decode(errors='ignore')}")
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    # Log the received JSON data at a debug level for general visibility
    app.logger.debug(f"Received log data for /log: {data}")

    service = data.get('service')
    level = data.get('level')
    message = data.get('message')
    details = data.get('details') # Get optional details field

    if not all([service, level, message]):
        app.logger.warning(f"Bad request to /log: Missing required fields (service, level, message). Received data: {data}")
        return jsonify({"error": "Missing data: service, level, and message are required"}), 400

    # Validate service: must be 'client' or 'server'.
    if service not in ['client', 'server']:
        app.logger.warning(f"Bad request to /log: Invalid service name '{service}'. Must be 'client' or 'server'. Received data: {data}")
        return jsonify({"error": "Invalid service name. Must be 'client' or 'server'."}), 400

    # Validate level
    valid_levels = ['info', 'success', 'warning', 'error', 'debug']
    if level not in valid_levels:
        app.logger.warning(f"Bad request to /log: Invalid log level '{level}'. Must be one of {valid_levels}. Received data: {data}")
        return jsonify({"error": f"Invalid log level. Must be one of {valid_levels}."}), 400

    try:
        details_to_store = None
        if details is not None:
            if isinstance(details, (dict, list)): # Check if it's a dict or list
                details_to_store = json.dumps(details)
            else:
                details_to_store = str(details) # Convert to string if not dict/list (e.g. number, bool)
        
        add_log_entry(service, level, message, details_to_store)
        return jsonify({"status": "success", "message": "Log entry added"}), 201
    except Exception as e:
        app.logger.error(f"Error adding log entry: {e}")
        return jsonify({"error": "Failed to add log entry"}), 500

@app.route('/logs', methods=['GET'])
def handle_get_logs():
    """
    Retrieves logs for a specific service.
    Query parameter: ?service=<service_name>
    """
    service_name = request.args.get('service')
    if not service_name:
        return jsonify({"error": "Query parameter 'service' is required"}), 400

    if service_name not in ['client', 'server']: # Enforce known services
        return jsonify({"error": "Invalid service name. Must be 'client' or 'server'."}), 400

    try:
        logs = get_logs_by_service(service_name)
        return jsonify(logs), 200
    except Exception as e:
        app.logger.error(f"Error retrieving logs for service {service_name}: {e}")
        return jsonify({"error": f"Failed to retrieve logs for service {service_name}"}), 500

@app.route('/logs/<service_name>', methods=['DELETE'])
def handle_delete_logs(service_name):
    """
    Deletes all logs for a specific service.
    """
    if service_name not in ['client', 'server']: # Enforce known services
        return jsonify({"error": "Invalid service name. Must be 'client' or 'server'."}), 400
    
    try:
        deleted_count = delete_logs_by_service(service_name)
        return jsonify({"status": "success", "message": f"Deleted {deleted_count} logs for service '{service_name}'"}), 200
    except Exception as e:
        app.logger.error(f"Error deleting logs for service {service_name}: {e}")
        return jsonify({"error": f"Failed to delete logs for service {service_name}"}), 500

@app.route('/logs/count', methods=['GET'])
def handle_count_logs():
    """
    Retrieves the total count of logs for a specific service.
    Query parameter: ?service=<service_name>
    """
    service_name = request.args.get('service')
    if not service_name:
        return jsonify({"error": "Query parameter 'service' is required"}), 400

    if service_name not in ['client', 'server']: # Enforce known services
        return jsonify({"error": "Invalid service name. Must be 'client' or 'server'."}), 400

    try:
        count = count_logs_by_service(service_name)
        return jsonify({"service": service_name, "count": count}), 200
    except Exception as e:
        app.logger.error(f"Error counting logs for service {service_name}: {e}")
        return jsonify({"error": f"Failed to count logs for service {service_name}"}), 500

# --- SSE Log Streaming ---

def generate_log_stream(service_name: str):
    """Generator function to stream logs for a given service."""
    app.logger.info(f"Log stream started for service: {service_name}")
    last_sent_timestamp = 0
    
    try:
        app.logger.info(f"[{service_name}] Fetching initial logs...")
        initial_logs = get_logs_by_service(service_name)
        app.logger.info(f"[{service_name}] Found {len(initial_logs)} initial logs.")
        
        for log_entry in initial_logs:
            log_dict = dict(log_entry) if not isinstance(log_entry, dict) else log_entry
            event_data = f"event: initial_log\ndata: {json.dumps(log_dict)}\n\n"
            yield event_data
            if log_dict.get('timestamp', 0) > last_sent_timestamp:
                last_sent_timestamp = log_dict['timestamp']
        
        app.logger.info(f"[{service_name}] Finished sending initial logs. Last timestamp: {last_sent_timestamp}")
        app.logger.info(f"[{service_name}] Entering polling loop for new logs...")

        while True:
            try:
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    # Fetch logs newer than the last one sent
                    cursor.execute(
                        "SELECT timestamp, level, message, details FROM logs WHERE service = ? AND timestamp > ? ORDER BY timestamp ASC",
                        (service_name, last_sent_timestamp)
                    )
                    new_logs = cursor.fetchall()
                
                if new_logs:
                    app.logger.info(f"[{service_name}] Found {len(new_logs)} new logs.")
                    for log_row in new_logs:
                        log_dict = dict(log_row)
                        event_data = f"event: new_log\ndata: {json.dumps(log_dict)}\n\n"
                        yield event_data
                        if log_dict.get('timestamp', 0) > last_sent_timestamp:
                             last_sent_timestamp = log_dict['timestamp']
            except sqlite3.Error as e: # Catch potential sqlite3 errors during polling
                app.logger.error(f"[{service_name}] Database error during SSE polling: {e}")
                # Optionally, yield an error event to the client or just continue polling
            except Exception as e: # Catch other unexpected errors
                app.logger.error(f"[{service_name}] Unexpected error during SSE polling: {e}", exc_info=True)
            
            time.sleep(0.5) # Polling interval for new logs (e.g., 0.5 seconds)
            # A very short sleep might be too resource-intensive on the DB.
            # Adjust based on desired responsiveness vs. load.
    except GeneratorExit:
        # This happens when the client disconnects
        app.logger.info(f"Client disconnected from log stream for service: {service_name}")
    except Exception as e:
        app.logger.error(f"Error in log stream for {service_name}: {e}", exc_info=True)


@app.route('/stream/<service_name>')
def stream_logs(service_name: str):
    """Streams log events for a specific service."""
    if service_name not in ['client', 'server']:
        return jsonify({"error": "Invalid service name. Must be 'client' or 'server'."}), 400
    
    return Response(generate_log_stream(service_name), mimetype='text/event-stream')

# --- Static File Serving ---

@app.route('/')
def serve_index():
    """Serves the main HTML page."""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serves other static files (CSS, JS)."""
    return send_from_directory(app.static_folder, filename)


if __name__ == '__main__':
    # Make sure the CLM_DATA_DIR exists, though database.py also does this.
    # This path should match the one used in database.py and Docker volume mount.
    data_dir = '/app/clm_data'
    os.makedirs(data_dir, exist_ok=True)
    
    app.run(host='0.0.0.0', port=5000, debug=True)