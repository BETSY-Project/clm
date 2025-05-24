# CLM - Custom Log Manager

A simple service to receive, store, and view logs from client-side (JS/TS) and server-side (Python) applications.

## Running CLM

CLM runs as a Docker container.

1.  **Build the Docker image:**
    ```bash
    cd /path/to/your/clm_project_directory/clm
    docker build -t clm-app .
    ```

2.  **Run the Docker container:**
    ```bash
    docker run -d -p 9999:5000 -v $(pwd)/clm_data:/app/clm_data --name clm_instance clm-app
    ```
    This will start CLM, and it will be accessible at `http://localhost:9999`. Log data will be persisted in the `clm_data` directory in your project's `clm` folder.

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

### JavaScript/TypeScript

You can use the provided logger from `client/lib/logging/logger.ts`.

**1. Configure CLM URL:**
Ensure the `NEXT_PUBLIC_CLM_URL` environment variable is set to your CLM server address (e.g., `http://localhost:9999`). If not set, the logger might default to a different URL.

**2. Usage Example:**

```typescript
// Presuming logger.ts is correctly imported and configured
import { logger, LogType } from './path/to/client/lib/logging/logger'; // Adjust path as needed

// Set the CLM URL if not using environment variables or if needing to override
// This is a conceptual example; the actual logger.ts reads from process.env.NEXT_PUBLIC_CLM_URL
// You might need to adjust how the URL is set in your specific frontend setup.
// For instance, in a Next.js app, you'd set NEXT_PUBLIC_CLM_URL in your .env.local file.

// Example: NEXT_PUBLIC_CLM_URL=http://localhost:9999

logger.info("User logged in", { userId: "user123" });
logger.warn("Payment processing is slow", { gateway: "Stripe" });
logger.error("Failed to fetch user data", new Error("Network timeout"));
logger.success("Order placed successfully", { orderId: "orderXYZ" });

// You can also use the LogType enum directly if needed with sendToCLM (private method)
// but the public methods (info, error, etc.) are preferred.
```
The logger is a singleton and can be imported and used throughout your client-side application. It sends logs with `service: "client"`.

### Python

You can use the `get_server_logger` utility from `server/app/utils.py`.

**1. Configure CLM URL:**
The Python logger uses `settings.CLM_URL` from `app.config` to determine the CLM server address. Ensure this is set correctly (e.g., to `http://localhost:9999`).

**2. Usage Example:**

```python
# Presuming utils.py is in your Python path or accessible
# and app.config.settings.CLM_URL is configured (e.g., to 'http://localhost:9999')

import logging
from server.app.utils import get_server_logger # Adjust path as needed

# Configure the logger for your service
# This will send logs to CLM and also to the console by default.
# The service_name_for_clm will be used as the "service" field in CLM.
my_service_logger = get_server_logger(name="my-python-service", 
                                      level=logging.INFO,
                                      service_name_for_clm="my-backend-service")

my_service_logger.info("Application started.")
my_service_logger.warning("Cache miss for key: 'user_data_abc'")
my_service_logger.error("Database connection failed.", extra={"db_host": "10.0.0.5"})

try:
    result = 10 / 0
except ZeroDivisionError:
    # exc_info=True will include traceback in the 'details' field sent to CLM
    my_service_logger.critical("Critical error: Division by zero!", exc_info=True)

```
The `get_server_logger` function sets up a logger that sends records to CLM. The `service_name_for_clm` parameter determines the `service` field in the log entry.

## Viewing Logs

Open `http://localhost:9999` in your browser to access the CLM web interface where you can view logs.

## TODO

- Implement an API Key system for authentication/security