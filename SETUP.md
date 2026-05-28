# ENPI Dashboard — AWS Setup Guide

## Architecture overview

```
Devices → S3 (enpi-sensors)
              ↓ S3 event trigger
          Lambda (enpi-process-upload)
              ↓ writes
          S3: summaries/{device_id}/{date}-{air|light}.json
          S3: fleet-manifest.json

Frontend: Next.js on Vercel
  ↓ reads via AWS SDK (server-side API routes)
  S3 summaries + fleet-manifest.json
  ↓ generates pre-signed URLs for downloads
```

---

## 1. S3 bucket CORS (allow Vercel to call presigned URLs)

In the AWS console → S3 → `enpi-sensors` → Permissions → CORS:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET"],
    "AllowedOrigins": ["https://your-vercel-app.vercel.app"],
    "ExposeHeaders": ["Content-Disposition"]
  }
]
```

---

## 2. IAM user for the web app (read-only + presigned URLs)

Create an IAM user `enpi-web-reader` with this inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::enpi-sensors",
        "arn:aws:s3:::enpi-sensors/*"
      ]
    }
  ]
}
```

Generate an access key for this user — these go into Vercel env vars.

---

## 3. IAM role for the Lambda

Create an IAM role `enpi-lambda-role` with:
- Trust policy: `lambda.amazonaws.com`
- Managed policy: `AWSLambdaBasicExecutionRole` (for CloudWatch logs)
- Inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::enpi-sensors",
        "arn:aws:s3:::enpi-sensors/*"
      ]
    }
  ]
}
```

---

## 4. Deploy the Lambda function

```bash
cd lambda/process-upload
zip -r ../enpi-process-upload.zip .
```

In the AWS console → Lambda → Create function:
- Name: `enpi-process-upload`
- Runtime: Node.js 20.x
- Architecture: x86_64
- Execution role: `enpi-lambda-role`
- Upload `enpi-process-upload.zip`
- Handler: `index.handler`
- Timeout: 60 seconds
- Memory: 256 MB

Environment variable:
- `BUCKET_NAME` = `enpi-sensors`

---

## 5. Add S3 trigger to Lambda

In the Lambda console → Configuration → Triggers → Add trigger:
- Source: S3
- Bucket: `enpi-sensors`
- Event type: `PUT`
- Suffix: `.csv.gz`

This fires the Lambda every time a device uploads a compressed daily file.

---

## 6. Bootstrap existing data

If the bucket already contains historical files, run the Lambda manually for each
existing file, or use this AWS CLI one-liner to trigger re-processing:

```bash
# List all existing .csv.gz files
aws s3 ls s3://enpi-sensors --recursive | grep '\.csv\.gz'

# Invoke Lambda manually for a single file (for testing)
aws lambda invoke \
  --function-name enpi-process-upload \
  --payload '{"Records":[{"s3":{"bucket":{"name":"enpi-sensors"},"object":{"key":"SG-BC4ERPI3CF2A/air_SG-BC4ERPI3CF2A_v0.4.0_2026-05-17.csv.gz"}}}]}' \
  /tmp/out.json && cat /tmp/out.json
```

For bulk bootstrapping, use the `/api/admin/bootstrap` endpoint (see below).

---

## 7. Bootstrap API endpoint (bulk backfill)

The web app exposes a protected admin route to rebuild the fleet manifest from
existing S3 files. After deploying to Vercel:

```bash
# Only works when authenticated — run from browser or curl with cookie
curl -X POST https://your-app.vercel.app/api/admin/bootstrap \
  -H "Cookie: enpi-session=<your-session-cookie>"
```

This scans all `.csv.gz` files in S3, invokes the Lambda for any missing
summaries, and rebuilds `fleet-manifest.json`.

---

## 8. Vercel deployment

```bash
npm i -g vercel
vercel  # follow prompts
```

Add these environment variables in the Vercel dashboard:
- `AUTH_PASSWORD`
- `JWT_SECRET`  (generate: `openssl rand -base64 32`)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`  (e.g. `us-east-1`)
- `S3_BUCKET_NAME`  (`enpi-sensors`)

---

## Estimated monthly costs (single device, low traffic)

| Service | Usage | Cost |
|---------|-------|------|
| S3 storage | ~36 MB/year raw + tiny summaries | < $0.01/mo |
| S3 GET requests | ~100/day | < $0.01/mo |
| Lambda | 2 invocations/day | Free tier |
| Vercel | Hobby plan | Free |
| **Total** | | **~$0/mo** |
