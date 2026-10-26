# Br — The project shelf

A 3D project portal at https://brbsq.github.io/ with the supplied acrylic shelf and game cases, the original Figma Moving gradient shader, and animated project dialogs.

## Development

Requires Node.js 22 or newer. Run `npm ci`, then `npm run dev`. Run `npm run build` to produce the static site in `dist/`; `npm run preview` serves that build locally.

## Publishing

Push to `main` to build and deploy through `.github/workflows/pages.yml`. GitHub Pages must use **GitHub Actions** as its publishing source. The workflow deploys only `dist/`; development files and dependencies are not served.

## Interaction and current settings

- Drag to rotate the shelf up to 15 degrees horizontally and vertically.
- Cases lift on hover with a geometry-aligned halo and a soft shadow at slot level; visible hover captions are disabled.
- Click or keyboard-activate a case to open its project. The case follows a straight path into a front-facing popup; opening and closing take 0.65 seconds, with synchronized transparent blur and copy fade.
- Blank space, Escape, or the close button dismisses the popup; focus returns to the originating case. Project links open a new tab.
- Background speed varies smoothly between 50 and 70 percent of its original speed, with a slight blur. Reduced-motion preferences freeze background animation and remove popup travel.

## Assets and browser support

All ten supplied GLBs are preserved in `public/models/`. The combined model contains the shelf and six occupied cases; T4 and B2 are empty slots. The original shader source and features metadata in `shader/` match the supplied ZIP byte-for-byte. A small WebGPU host supplies the Figma layer parameters and maps editor-only property metadata to a no-op.

The animated background requires WebGPU; unsupported browsers display a plain blue background with a compatibility note. The 3D shelf uses WebGL. Google Sans Flex is used when installed, with Arial as fallback. Physical mobile-device behavior and all external project destinations have not been verified.

Production builds and syntax checks passed. Browser checks covered shelf rendering, the original animated shader, popup content and blur, focus restoration, and the case highlight under keyboard focus.
