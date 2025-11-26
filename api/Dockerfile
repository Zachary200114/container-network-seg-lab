FROM python:3.12-alpine

# Install tools: curl, ping, nc, iptables
RUN apk update && apk add --no-cache curl iputils netcat-openbsd iptables

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 5000

CMD ["python", "app.py"]

