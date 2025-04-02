FROM python:3.13-slim

# System dependencies
RUN apt-get update && apt-get install -y netcat-openbsd gcc libpq-dev

WORKDIR /app
COPY ./requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x wait_for_db.sh

CMD ["./wait_for_db.sh", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
