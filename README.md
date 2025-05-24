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

The CLM server expects logs at the `POST /log` endpoint with the following JSON payload:

```json
{
    "service": "string",  // e.g., "client", "server"
    "level": "string",    // e.g., "info", "success", "warning", "error"
    "message": "string",  // The log message
    "details": "any"      // Optional: additional details (object, string, etc.)
}
```

### Client-side (JavaScript/TypeScript)

The application uses a logger utility found in `client/lib/logging/logger.ts`.

*   **Configuration**: Ensure the `NEXT_PUBLIC_CLM_URL` environment variable in your client's `.env.local` (or equivalent) is set to your CLM server address (e.g., `NEXT_PUBLIC_CLM_URL=http://localhost:9999`).
*   **Behavior**: The client logger sends logs with `service: "client"`. If CLM is unavailable or not configured, logs will fall back to the browser console.

### Server-side (Python)

The application uses a logger utility configured via `server/app/logger.py`.

*   **Configuration**: The Python logger uses `settings.CLM_URL` (typically set in `server/.env.local` via `app.config.py`) to determine the CLM server address (e.g., `CLM_URL="http://localhost:9999"`).
*   **Behavior**: The server logger, obtained via `get_server_logger` from `app.logger`, sends logs with `service: "server"`. If CLM is unavailable or not configured, logs will fall back to the server's terminal output.

## Viewing Logs

Open `http://localhost:9999` in your browser to access the CLM web interface. You should see separate columns for "client" and "server" logs.

## TODO

- Implement an API Key system for authentication/security.