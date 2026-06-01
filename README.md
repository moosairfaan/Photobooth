# Old Friends — Vintage Photobooth

A browser-based vintage photobooth: four sequential shots, film-style strip, and three ways to keep it — email, QR scan, or download.

**Live site:** deploy with [GitHub + Vercel](#deploy-on-github--vercel) (see below).

## Deploy on GitHub + Vercel

### 1. Push to GitHub

```bash
cd /Users/moosairfaan/Desktop/photobooth

# Log in once (opens browser)
gh auth login

# Create repo and push (pick a name, e.g. photobooth)
gh repo create photobooth --public --source=. --remote=origin --push
```

Or create a repo manually at [github.com/new](https://github.com/new), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/photobooth.git
git branch -M main
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. **Import** your `photobooth` repository.
3. Leave defaults (no build command, output is the repo root) → **Deploy**.

Vercel will assign a URL like `https://photobooth-xxx.vercel.app`.

### 3. After deploy — allow your production URL

- **EmailJS:** [dashboard](https://dashboard.emailjs.com/) → Account → Security → add your Vercel URL (and `https://*.vercel.app` if needed).
- **Cloudinary:** unsigned preset works from any domain; no extra step.

Camera and mic require **HTTPS** — Vercel provides that automatically.

### Redeploy

Push to `main` on GitHub; Vercel redeploys automatically if the project is linked.

## Run locally

Serve the folder over HTTP (required for camera access):

```bash
npx serve .
# or
python3 -m http.server 8080
```

Open `http://localhost:8080` (or the port shown). Use HTTPS or `localhost` so `getUserMedia` works.

## After your strip — three options

| Option | How it works |
|--------|----------------|
| **Send to email** | EmailJS + Gmail (compressed image, 50KB limit) |
| **Scan to save** | Uploads strip to Cloudinary, shows QR code inline |
| **Download** | Saves PNG via canvas `toDataURL` |

## Cloudinary setup (Scan to save)

1. Create a free account at [cloudinary.com](https://cloudinary.com/).
2. Note your **Cloud name** (Dashboard).
3. Go to **Settings → Upload → Upload presets → Add upload preset**:
   - **Signing mode**: Unsigned
   - Save the preset name (e.g. `photobooth_unsigned`)
4. In `app.js`:

   ```js
   const CLOUDINARY_CONFIG = {
     cloudName: "your_cloud_name",
     uploadPreset: "photobooth_unsigned",
   };
   ```

Only the cloud name and unsigned preset are used in the browser — never put your API secret in frontend code.

## EmailJS setup (Send to email)

1. Create a free account at [emailjs.com](https://www.emailjs.com/).
2. Add an **Email Service** (e.g. Gmail).
3. Create an **Email Template**:
   - **To Email**: `{{to_email}}` (not your personal Gmail address)
   - Body: `<img src="{{strip_image}}" alt="strip" style="max-width:200px;" />`
4. Copy keys into `app.js` → `EMAILJS_CONFIG`.

Until configured, **Download** and **Scan to save** (after Cloudinary setup) still work.

## Features

- Webcam capture with 3-second analog countdown per shot
- Vertical 4-photo strip with sepia, grain, white borders, and booth label
- Flash effect and Web Audio shutter click
- Mobile-responsive UI

## Files

- `index.html` — screens and layout
- `styles.css` — Old Friends NYC aesthetic
- `app.js` — camera, strip, EmailJS, Cloudinary, QR, download
