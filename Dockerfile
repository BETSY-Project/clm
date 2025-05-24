# Dockerfile for Custom Log Manager (CLM)
# Base Python image - Alpine for smallest size
FROM python:3.11-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY ./app /app
# Ensure data directory exists for SQLite
RUN mkdir -p /app/clm_data

# Expose port
EXPOSE 5000

# Command to run the application
CMD ["python", "main.py"]