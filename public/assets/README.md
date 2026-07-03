# Assets — drop your files here

Replace the placeholders used by the invitation with your own files.

## Hero background (`assets/hero.jpg`)

- Save your romantic garden / conservatory photo here as **`hero.jpg`**.
- It fills the hero behind a frosted-glass panel that keeps the names readable,
  and fades softly into the page. Landscape or portrait both work.
- No file yet? A soft blush-and-sage gradient shows in its place.

## Photos (`assets/gallery/`)

1. Add your couple / pre-wedding photos here, e.g. `01.jpg`, `02.jpg`, …
2. In `../index.html`, find the `PHOTO GALLERY` section and change each
   `<img src="https://picsum.photos/...">` to `<img src="assets/gallery/01.jpg">`.
   Portrait and landscape shots both work — the layout tiles them automatically.

## Background music (`assets/music.mp3`)

- Put a soft, royalty-free instrumental track here named **`music.mp3`**.
- The 🎵 button (top-right) plays/mutes it. It also starts softly on a guest's
  first tap (browsers block truly automatic audio).
- No file yet? The music button simply does nothing until `music.mp3` exists.

## Shared guest album

- In `../script.js`, set `ALBUM_URL` to your Google Photos / Immich share link.
  The "Open the shared album" button and the photo-sharing section use it.
