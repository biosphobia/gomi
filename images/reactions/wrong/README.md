# Wrong-answer reaction images (batsu ✗)

Drop images shown when the player answers **incorrectly** here.

- The manifest in `common.js` (`REACTION_IMAGES.wrong`) lists which
  files are used. One is picked at random each time.
- The first image expected here is **`batsu1.png`** — save the ✗
  (crossed-arms / "batsu") photo as `batsu1.png` in this folder.
- To add more, drop e.g. `batsu2.png`, `batsu3.png`, … and add their
  paths to the `wrong` array in `common.js`:

  ```js
  const REACTION_IMAGES = {
    ...
    wrong: [
      'images/reactions/wrong/batsu1.png',
      'images/reactions/wrong/batsu2.png',
    ],
  };
  ```

Transparent-background PNG looks best as a popup, but JPG works too —
just make the filename in the manifest match the file you add.
