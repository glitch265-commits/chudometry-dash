# Characters

The game reads the three chud pictures from this folder. Drop your files in with
these names and they are used automatically — no code changes, no uploads:

```
public/characters/chud.jpg      -> "Classic Chud"  (slot 1)
public/characters/chud 1.jpg    -> "Dragon Chud"   (slot 2)
public/characters/chud 2.jpg    -> "Fluffy Chud"   (slot 3)
```

Notes:

- `.jpeg`, `.png` and `.webp` also work, and `chud1.jpg` / `chud2.jpg` (no
  space) are accepted too.
- Files are looked up relative to the site root, so `characters/chud.jpg` also
  works if you'd rather skip the subfolder.
- Until a file is found, the game falls back to built-in stand-in art. The
  character cards show a **green border** once your real file is live, and the
  "missing photos" notice at the top of the panel disappears.
- Pictures are used as-is: the card and the in-game cube both crop the image
  from the centre, so a square-ish crop that keeps the head centred looks best.

After adding the files run `npm run build` and deploy the `dist/` folder —
`dist/characters/` must ship alongside `index.html`.

## Folder layout when deployed

```
index.html
characters/chud.jpg
characters/chud 1.jpg
characters/chud 2.jpg
```
