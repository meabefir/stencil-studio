# Stencil Studio

Stencil Studio is a browser-based tattoo line-work sheet builder. It runs entirely on the visitor's device: there is no backend, account, or upload step.

## What it includes

- A3, A4, A5, A6, US Letter, and US Legal paper sizes
- Portrait and landscape orientation, printable margins in millimetres, optional even vertical row spacing, and a manual row gap for compact layouts
- Editable rows for straight lines, circles, ovals, waves, squares, polygons, hearts, and stars
- Shape-specific controls for size, thickness, arc angle, layered inner circles, oval ratio, wave amplitude and frequency, polygon sides, star points, and more
- Solid, dashed, and dotted strokes
- Per-element rotation, progressive rotation offset, and a per-row overlap offset for tighter or wider packing
- Automatic, even repeat spacing inside the printable width, with compact row stacking when vertical spacing is disabled
- Drag, arrow-button, duplicate, and delete row actions
- Fine adjustment for numeric controls: hover a number for half a second, then hold and drag horizontally
- Automatic browser-local saving, named local presets, and compatible JSON preset download/import
- PNG and JPEG export at 150, 300, or 600 DPI
- Responsive layout for desktop and mobile browsers

## Run it locally

You need [Node.js](https://nodejs.org/) 22.12 or newer (Node 20.19 also works).

```bash
npm install
npm run dev
```

Open the local address printed in the terminal. To create a production build:

```bash
npm run build
```

The finished static site will be in `dist/`.

## Saving presets

The current sheet is saved automatically in the browser and restored the next time Stencil Studio is opened on the same site and device. Use **Presets** in the header to save named browser-local versions, load them later, or download a portable JSON file. **Import JSON** accepts that same preset format.

Browser-local saves do not leave the device and are specific to the site's address. Download a JSON preset when you want a backup or need to move a design to another browser or device.

## Fine-adjusting values

Numeric fields can still be clicked and typed normally. For precise mouse adjustment, hover over a numeric input for half a second, then hold and drag horizontally. The deliberately low sensitivity makes small thickness, overlap, and rotation changes easier to control.

## Publish with GitHub Pages

GitHub Pages is free for public repositories on GitHub Free. It is also available for private repositories on GitHub Pro, Team, and Enterprise plans; organization policy and repository settings can still affect availability. A Pages site is public on the internet even when its source repository is private. See [GitHub's current Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) before choosing repository visibility.

This project already includes a deployment workflow, so publishing is short:

1. Create a new GitHub repository and add these project files to it.
2. Make sure the default branch is named `main`, then push the project.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Open the repository's **Actions** tab and wait for “Deploy Stencil Studio to GitHub Pages” to finish.
6. Return to **Settings → Pages** to find the public URL.

Every later push to `main` rebuilds and republishes the app automatically. The workflow follows GitHub's documented [custom Actions deployment flow](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow).

The Vite configuration uses relative asset paths, so it works both at `username.github.io` and at project URLs such as `username.github.io/stencil-studio/` without changing the repository name in the code.

## Export notes

- Use 300 DPI for a strong default balance between print sharpness and file size.
- Use 600 DPI for very fine line work; large paper sizes can take a moment to render.
- PNG preserves hard, clean edges. JPEG is smaller but may introduce slight compression around thin lines.
- The dashed margin guide shown in the editor is never included in exported files.

## Technology

Vite, React, and SVG. Raster exports are created locally with the browser's Canvas API, so the stencil design never leaves the device.
