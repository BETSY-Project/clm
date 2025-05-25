import sqlite3
import os
import time
import logging

# Path for the data directory inside the Docker container
# The WORKDIR is /app, and the volume is mounted at /app/clm_data
DATABASE_DIR = '/app/clm_data'
DATABASE_PATH = os.path.join(DATABASE_DIR, 'logs.db')

logger = logging.getLogger(__name__)

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    os.makedirs(DATABASE_DIR, exist_ok=True) # Ensure the directory exists
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row # Access columns by name
    return conn

def init_db():
    """Initializes the database and creates the logs table if it doesn't exist."""
    sql = '''
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service TEXT NOT NULL,
            timestamp INTEGER NOT NULL, -- Store as UNIX timestamp in nanoseconds (integer for perfect ordering)
            level TEXT NOT NULL CHECK(level IN ('info', 'success', 'warning', 'error', 'debug')),
            message TEXT NOT NULL,
            details TEXT
        )
    '''
    try:
        with get_db_connection() as conn:
            conn.execute(sql)
        logger.info(f"Database initialized at {DATABASE_PATH}")
    except sqlite3.Error as e:
        logger.error(f"Database initialization error: {e}")

def add_log_entry(service: str, level: str, message: str, details: str | None = None):
    """Adds a new log entry to the database, optionally including details."""
    current_timestamp = time.time_ns()
    sql = "INSERT INTO logs (service, timestamp, level, message, details) VALUES (?, ?, ?, ?, ?)"
    try:
        with get_db_connection() as conn:
            conn.execute(sql, (service, current_timestamp, level, message, details))
        logger.info(f"CLM DB: Successfully added log for {service} - {level} - {message[:50]}...")
    except sqlite3.Error as e:
        logger.error(f"CLM DB: Database error adding log for {service} - {level} - {message[:50]}...: {e}")

def get_logs_by_service(service: str):
    """Retrieves all logs for a specific service, ordered by timestamp."""
    sql = "SELECT timestamp, level, message, details FROM logs WHERE service = ? ORDER BY timestamp ASC"
    try:
        with get_db_connection() as conn:
            cursor = conn.execute(sql, (service,))
            logs = cursor.fetchall()
        return [dict(log) for log in logs]
    except sqlite3.Error as e:
        logger.error(f"Database error retrieving logs for {service}: {e}")
        return []  # Return empty list on error

def count_logs_by_service(service: str):
    """Counts all logs for a specific service."""
    sql = "SELECT COUNT(id) FROM logs WHERE service = ?"
    try:
        with get_db_connection() as conn:
            cursor = conn.execute(sql, (service,))
            count = cursor.fetchone()[0]
        return count
    except sqlite3.Error as e:
        logger.error(f"Database error counting logs for {service}: {e}")
        return 0  # Return 0 on error

def delete_logs_by_service(service: str):
    """Deletes all logs for a specific service."""
    sql = "DELETE FROM logs WHERE service = ?"
    try:
        with get_db_connection() as conn:
            cursor = conn.execute(sql, (service,))
            return cursor.rowcount # Returns the number of deleted rows
    except sqlite3.Error as e:
        logger.error(f"Database error deleting logs for {service}: {e}")
        return 0

# Initialize the database when this module is loaded
if __name__ == '__main__':
    init_db()
    # Example usage:
    # add_log_entry("client", "info", "Client application started.")
    # add_log_entry("server", "error", "Server failed to connect to external API.")
    # print(get_logs_by_service("client"))
    # print(get_logs_by_service("server"))
else:
    # Ensure DB is initialized if module is imported elsewhere (e.g., by main.py)
    # This might run multiple times if main.py reloads, but CREATE TABLE IF NOT EXISTS is safe.
    init_db()
