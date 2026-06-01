# Old Friends — Vintage Photobooth

A browser-based vintage photobooth: four sequential shots, film-style strip, and three ways to keep it — email, QR scan, or download.

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
