# Charity-Jet--Donation-Website

Young Heart NGO is a donation website with a static frontend and an Express plus MongoDB API. Payments are initialized through Paystack and blog media is stored in Cloudinary.

## Recommended Deployment Split

Use this production layout:

1. Frontend on Vercel
2. Backend API on Render, Railway, or DigitalOcean App Platform
3. Database on MongoDB Atlas
4. Media on Cloudinary

Render is the best default API host for this codebase because the backend is a long-running Express server and does not need serverless execution.

## Frontend Deployment on Vercel

The frontend now reads its API location from `frontend-config.js`.

- Local development defaults to `http://localhost:5000`
- Production defaults to the current site origin
- For a direct frontend-to-API setup, set `window.__API_ORIGIN__` before `frontend-config.js` loads

The repository also includes `vercel.json` with rewrites for `/api/*` and `/uploads/*`.

Before deploying to Vercel:

1. Replace `https://your-api-host.example.com` in `vercel.json` with your real backend URL
2. Deploy the project root to Vercel
3. Keep the frontend calling relative `/api/...` routes through the Vercel rewrite layer

## Backend Deployment

Deploy the `server` folder as a Node web service.

### Start Commands

1. Install: `npm install`
2. Start: `npm start`

### Required Environment Variables

- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_CALLBACK_URL`
- `CORS_ORIGIN`
- `SERVE_STATIC_FRONTEND=false`

For production, set:

- `CORS_ORIGIN` to your Vercel domain and any local development origins you need
- `PAYSTACK_CALLBACK_URL` to your frontend thank-you page, for example `https://your-frontend-domain.vercel.app/thankyou.html`
- `SERVE_STATIC_FRONTEND=false` so the backend runs as API-only

The backend exposes `GET /api/health` for uptime and deployment checks.

## Local Development

1. Start MongoDB locally or point `MONGODB_URI` to MongoDB Atlas
2. In `server`, run `npm install`
3. In `server`, run `npm run dev`
4. Open the frontend HTML files directly or from a simple static server

If you want the backend to serve the frontend locally, set `SERVE_STATIC_FRONTEND=true`.

## Authentication and Authorization

- Public routes: Home, About, Donate, Contact, Blog list/read
- Protected route: Contributors dashboard
- Admin only: Blog create, update, delete and manual contribution management

## API Endpoints

- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`
- GET `/api/contributors/dashboard`
- GET `/api/contributors/manual-payments`
- POST `/api/contributors/manual-payments`
- PUT `/api/contributors/manual-payments/:id`
- DELETE `/api/contributors/manual-payments/:id`
- GET `/api/blogs`
- GET `/api/blogs/:id`
- POST `/api/blogs`
- PUT `/api/blogs/:id`
- DELETE `/api/blogs/:id`
- POST `/api/payments/paystack/initialize`
- GET `/api/payments/paystack/transactions`
- GET `/api/health`
# ngo
