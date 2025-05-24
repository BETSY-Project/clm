# CLM - Custom Log Manager

A simple service to receive, store, and view logs from client-side (JS/TS) and server-side (Python) applications. It provides a web interface to see logs from different services side-by-side.

## Running CLM

CLM runs as a Docker container.

1.  **Build the Docker image:**
    ```bash
    cd /path/to/your/clm_project_directory/clm 
    # Or simply `cd clm` if you are in the project root
    docker build -t clm-app .
    ```

2.  **Run the Docker container:**
    ```bash
    # If in the 'clm' directory:
    docker run -d -p 9999:5000 -v $(pwd)/clm_data:/app/clm_data --name clm_instance clm-app
    # Or from project root:
    # docker run -d -p 9999:5000 -v $(pwd)/clm/clm_data:/app/clm_data --name clm_instance clm-app
    ```
    This will start CLM, accessible at `http://localhost:9999`. Log data is persisted in the `clm_data` directory inside your `clm` project folder.

## Sending Logs to CLM

The CLM server expects logs at the `POST /log` endpoint. Both client-side (TypeScript) and server-side (Python) applications are configured to send logs to this endpoint.

**Payload Structure:**
```json
{
    "service": "string",  // e.g., "client", "server"
    "level": "string",    // e.g., "info", "success", "warning", "error", "debug"
    "message": "string",  // The core log message
    "details": "any"      // Optional: additional structured details.
                          // For server logs, this may include logger_name, exception traces, etc.
}
```

**Configuration:**
*   **Client (TypeScript)**: Uses `NEXT_PUBLIC_CLM_URL` (e.g., in `.env.local`) for the CLM server address.
*   **Server (Python)**: Uses `CLM_URL` (e.g., in `server/.env.local`) for the CLM server address.

**Behavior:**
*   Logs are tagged with their respective `service` name ("client" or "server").
*   Server logs are structured to provide a clean message and utilize appropriate log levels for better presentation in CLM.
*   If CLM is unavailable or not configured, logs will fall back to the browser console (for client) or server terminal (for server). Note that very early server startup messages (before configuration is fully loaded) will also appear in the server terminal.
*   The CLM backend now accepts "debug" level logs. Currently, the CLM UI will display "debug" logs similarly to "info" logs.

## Viewing Logs

Open `http://localhost:9999` in your browser to access the CLM web interface. You should see separate columns for "client" and "server" logs.

## TODO

- Implement an API Key system for authentication/security.
- SQLite MCP Server for my AI coding Agent.
- Filtering.