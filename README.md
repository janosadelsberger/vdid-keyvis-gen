# VDID Keyvisual Generator

A web application for generating VDID key visuals in multiple formats.

## Features

- Generate assets for Website (Preview & Header), Instagram (Grid & Story), and LinkedIn
- VDID brand-compliant styling (VDID Blue #0A2CD9, Roboto typography)
- Event format dropdown with custom option
- Multi-line title and subtitle support
- Date and time pickers
- Real-time canvas preview
- PNG download for all formats

## Development

### Prerequisites

- [Bun](https://bun.sh) installed

### Setup

1. Install dependencies:
```bash
bun install
```

2. Add the VDID logo:
   - Place your VDID logo SVG at `public/VDID_Logo_neg.svg`

3. Run the development server:
```bash
bun dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Building for Production

Build the static export:
```bash
bun run build
```

The static files will be in the `out` directory.

## Deployment

### GitHub Pages

1. Push your code to a GitHub repository
2. Go to Settings → Pages
3. Enable GitHub Pages and select the `gh-pages` branch (or use GitHub Actions workflow)
4. The app will be available at `https://yourusername.github.io/repository-name`

The included GitHub Actions workflow (`.github/workflows/deploy.yml`) will automatically build and deploy on every push to `main`.

### Alternative: Vercel (Recommended for Next.js)

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Vercel will automatically detect Next.js and deploy

Vercel is free and optimized for Next.js apps.

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main page
│   └── globals.css        # Global styles
├── components/
│   ├── event-asset-generator.tsx  # Main generator component
│   └── ui/                # shadcn-style UI components
├── public/
│   └── VDID_Logo_neg.svg  # VDID logo (add your logo here)
└── lib/
    └── utils.ts           # Utility functions
```

## License

Private project for VDID.
