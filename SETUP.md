# ENPI Dashboard — Setup Guide

Do these steps in order. The whole thing should take about 30 minutes.

---

## Overview

```
Devices → S3 (enpi-sensors)
              ↓ S3 event trigger
          Lambda (enpi-process-upload)   ← computes daily summaries
              ↓
          S3: summaries/ + fleet-manifest.json

Frontend: Next.js on Vercel
  ↓ reads via server-side API routes (AWS SDK)
  Reads summaries + manifest from S3
  ↓ generates pre-signed download URLs
```

---

## Step 1 — Create an IAM user for the web app

This user gives Vercel read-only access to your S3 bucket.

1. Go to **AWS Console → IAM → Users → Create user**
2. Username: `enpi-web-reader`
3. Skip "Add to group", click through to **Create user**
4. Click the user you just created → **Add permissions → Attach policies directly → Create inline policy**
5. Switch to the **JSON** tab, paste this:

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
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::enpi-sensors/fleet-manifest.json"
    },
    {
      "Effect": "Allow",
      "Action": ["lambda:InvokeFunction"],
      "Resource": "arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:enpi-process-upload"
    }
  ]
}
```

Replace `YOUR_ACCOUNT_ID` with your 12-digit AWS account ID (shown in the top-right corner of the AWS console).

6. Name the policy `enpi-web-read`, click **Create policy**
7. Go to the user → **Security credentials → Create access key**
8. Choose **Application running outside AWS**, create it
9. **Copy the Access Key ID and Secret Access Key** — you'll need these for Vercel. You can't retrieve the secret again after closing the page.

---

## Step 2 — Create an IAM role for the Lambda

This is a *role* (not a user) — Lambda assumes it when it runs.

1. Go to **AWS Console → IAM → Roles → Create role**
2. **Trusted entity type**: AWS service
3. **Use case**: Lambda → click Next
4. On the "Add permissions" screen, search for and check **AWSLambdaBasicExecutionRole** (this allows writing logs to CloudWatch)
5. Click Next, name the role `enpi-lambda-role`, click **Create role**
6. Click the role you just created → **Add permissions → Create inline policy**
7. Switch to JSON, paste this:

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

8. Name it `enpi-lambda-s3`, click **Create policy**

---

## Step 3 — Deploy the Lambda function

1. Open a terminal in the `lambda/process-upload/` folder inside this project
2. Create a zip file:

   **On Mac/Linux:**
   ```bash
   cd lambda/process-upload
   zip ../enpi-process-upload.zip index.mjs package.json
   ```

   **On Windows (PowerShell):**
   ```powershell
   cd lambda\process-upload
   Compress-Archive -Path index.mjs, package.json -DestinationPath ..\enpi-process-upload.zip
   ```

3. Go to **AWS Console → Lambda → Create function**
4. Choose **Author from scratch**
   - Function name: `enpi-process-upload`
   - Runtime: **Node.js 20.x**
   - Architecture: x86_64
   - Permissions: **Use an existing role** → select `enpi-lambda-role`
5. Click **Create function**
6. On the function page → **Code** tab → **Upload from** → **.zip file** → upload `enpi-process-upload.zip`
7. Go to **Configuration → Environment variables → Edit → Add environment variable**:
   - Key: `BUCKET_NAME`, Value: `enpi-sensors`
8. Go to **Configuration → General configuration → Edit**:
   - Timeout: **1 min 0 sec**
   - Memory: **256 MB**
   - Click Save

---

## Step 4 — Add the S3 trigger

This makes the Lambda run automatically whenever a device uploads a file.

1. On the Lambda function page → **+ Add trigger**
2. Source: **S3**
3. Bucket: `enpi-sensors`
4. Event types: **PUT**
5. Suffix: `.csv.gz`
6. Check the acknowledgement box, click **Add**

From now on, every time a device uploads a `.csv.gz` file to S3, the Lambda will automatically compute its daily summary.

---

## Step 5 — Configure S3 CORS

This allows the browser to download files directly from S3 via pre-signed URLs.

1. Go to **S3 → enpi-sensors → Permissions → Cross-origin resource sharing (CORS) → Edit**
2. Paste this (replace the URL with your Vercel URL after you deploy in Step 6):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET"],
    "AllowedOrigins": ["https://your-app.vercel.app"],
    "ExposeHeaders": ["Content-Disposition"]
  }
]
```

You can come back and update this after you know your Vercel URL. Until then you can use `"*"` as a temporary placeholder.

---

## Step 6 — Deploy to Vercel

1. Install the Vercel CLI if you don't have it:
   ```bash
   npm install -g vercel
   ```

2. In the `enpi-web` project folder, run:
   ```bash
   vercel
   ```
   Follow the prompts (link to your Vercel account, create a new project). When it asks about the framework, choose **Next.js**. Accept the default build settings.

3. It will print a preview URL like `https://enpi-web-abc123.vercel.app`. This is your app URL.

4. Now add the environment variables. Go to [vercel.com/dashboard](https://vercel.com/dashboard) → your project → **Settings → Environment Variables** and add:

   | Name | Value |
   |------|-------|
   | `AUTH_PASSWORD` | A password of your choice |
   | `JWT_SECRET` | Run `openssl rand -base64 32` in a terminal to generate one |
   | `AWS_ACCESS_KEY_ID` | From Step 1 |
   | `AWS_SECRET_ACCESS_KEY` | From Step 1 |
   | `AWS_REGION` | `us-east-1` |
   | `S3_BUCKET_NAME` | `enpi-sensors` |
   | `LAMBDA_FUNCTION_NAME` | `enpi-process-upload` |

5. After adding env vars, redeploy so they take effect:
   ```bash
   vercel --prod
   ```

6. Update the S3 CORS rule (from Step 5) with your actual production URL.

---

## Step 7 — Bootstrap historical data

If your bucket already has `.csv.gz` files from before this deployment, you need to tell the app about them.

1. Visit your Vercel URL and **log in** with the password you set
2. Click **Admin** in the top navigation bar
3. Click **Run bootstrap**

This scans all existing files in S3 and builds the `fleet-manifest.json` that the dashboard reads. It only reads filenames — it doesn't generate chart data (summaries) for old files.

**To also get chart data for historical files**, you need to trigger the Lambda for each old file. See the AWS CLI command below, or just wait — the Lambda will process all new files going forward automatically.

```bash
# Optional: trigger Lambda for one historical file to test it
aws lambda invoke \
  --function-name enpi-process-upload \
  --payload '{"Records":[{"s3":{"bucket":{"name":"enpi-sensors"},"object":{"key":"SG-BC4ERPI3CF2A/air_SG-BC4ERPI3CF2A_v0.4.0_2026-05-17.csv.gz"}}}]}' \
  /tmp/out.json && cat /tmp/out.json
```

---

## Troubleshooting

**Dashboard shows "No devices found" after bootstrap**
→ Check that `fleet-manifest.json` was created in the S3 bucket root (not inside a folder).

**Lambda not triggering on uploads**
→ Check CloudWatch Logs (AWS Console → CloudWatch → Log groups → `/aws/lambda/enpi-process-upload`).

**Download links not working**
→ Check S3 CORS is configured with your Vercel URL (Step 5).

**"Invalid password" on login**
→ Check the `AUTH_PASSWORD` env var in Vercel matches exactly what you're typing (no trailing spaces).

---

## Estimated monthly cost

| Service | Usage | Cost |
|---------|-------|------|
| S3 storage | ~36 MB/year per device | < $0.01/mo |
| Lambda | 2 invocations/day per device | Free tier |
| Vercel | Hobby plan | Free |
| **Total** | | **~$0/mo** |
