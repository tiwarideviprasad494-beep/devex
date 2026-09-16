# Deploy Devex Shipping Solutions

## What is ready

- `Dockerfile` to package the website and API.
- `render.yaml` to configure a Render web service automatically.
- `/health` endpoint for deployment health checks.
- `PORT` environment-variable support, as required by managed hosting platforms.

## Publish

1. Install Git for Windows from https://git-scm.com/download/win.
2. Create an empty private repository named `devex-logistics` in GitHub.
3. In this project folder, run the following commands, replacing the placeholder with your GitHub account name:

```powershell
git init
git add .
git commit -m "Initial Devex Shipping Solutions website"
git branch -M main
git remote add origin https://github.com/YOUR-GITHUB-USERNAME/devex-logistics.git
git push -u origin main
```

4. In Render, choose **New → Blueprint**, select the repository, and apply the detected `render.yaml`.
5. After deployment succeeds, add your own domain in Render's Custom Domains settings and follow its DNS instructions.

## Before accepting customer data

The current quote store is a local JSON file. It is suitable for development only. Use a managed database plus a transactional email/CRM integration before collecting genuine customer inquiries.
