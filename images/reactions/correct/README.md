# Correct-answer reaction images (maru ○)

Drop images shown when the player answers **correctly** here.

- The manifest in `common.js` (`REACTION_IMAGES.correct`) lists which
  files are used. One is picked at random each time.
- The first image expected here is **`maru1.png`** — save the ○
  (hands-up / "maru") photo as `maru1.png` in this folder.
- To add more, drop e.g. `maru2.png`, `maru3.png`, … and add their
  paths to the `correct` array in `common.js`:

  ```js
  const REACTION_IMAGES = {
    correct: [
      'images/reactions/correct/maru1.png',
      'images/reactions/correct/maru2.png',
    ],
    ...
  };
  ```

Transparent-background PNG looks best as a popup, but JPG works too —
just make the filename in the manifest match the file you add.
