FROM python:3.12-alpine
COPY vercel-proxy-ca.crt /usr/local/share/ca-certificates/vercel-proxy-ca.crt
RUN cat /usr/local/share/ca-certificates/vercel-proxy-ca.crt >> /etc/ssl/cert.pem && apk add --no-cache iptables iputils netcat-openbsd curl
ENV PIP_CERT=/etc/ssl/cert.pem
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
EXPOSE 5000
CMD ["python", "app.py"]
