# Rebuscándome V1 — Visual Identity Integration

Base used: latest manual-payment configured release, with the progressive Academy page/player restored from the rebuilt Academy version.

## Integrated assets
- `public/brand/rebuscandome-logo.png` — full wordmark for platform sidebar.
- `public/brand/rebuscandome-isotipo.png` — isotipo for login brand mark and favicon.
- `public/visuals/home-hero.webp` — affiliate dashboard hero.
- `public/visuals/dashboard.webp` — reserved dashboard visual.
- `public/visuals/academy.webp` — Academy and course hero visuals.
- `public/visuals/sales.webp` — Centro de Venta.
- `public/visuals/products.webp` — product catalog banner.
- `public/visuals/income.webp` — income/results banner.
- `public/visuals/night-business.webp` — performance/statistics banner.
- `public/visuals/community.webp` — community/supporting visual.
- `public/visuals/checkout.webp` — checkout visual language.
- `public/visuals/success.webp` — payment success visual language.
- `public/visuals/delivery.webp` — reserved for private delivery experience.
- `public/visuals/profile.webp` — affiliate profile hero.
- `public/visuals/admin.webp` — admin command/configuration visuals.
- `public/visuals/brand-bg.webp` — login/register brand background.

## UI changes
- Real Rebuscándome logo in the authenticated sidebar.
- Isotipo used in auth brand mark and site icon.
- Brand-level typography/spacing, card elevation, focus states, hover motion, glow and background diffusion.
- Responsive visual treatment for mobile navigation and hero crops.
- Visual storytelling banners for products, performance, income and admin areas.
- Academy progressive learning visual restored and enhanced with brand imagery.
- Checkout and payment-result backgrounds aligned with the brand system.
- Reduced-motion fallback included.

## Validation
- 88 TS/TSX source files transpile successfully with TypeScript parser checks (excluding declaration-only files).
- Full `next build` was not completed in this environment because dependency installation/Next binary setup timed out; run the existing local build before deployment.
