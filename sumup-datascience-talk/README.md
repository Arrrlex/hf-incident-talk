# The Hugging Face Incident — 30-minute data-science talk

This subdirectory contains a focused 30-minute adaptation of the root deck for a technically experienced data-science audience. The slides keep the existing black/orange visual language and reuse the repository’s local scenes. There are no speaker notes; `OUTLINE_30_MIN.md` lists the sections and sources.

## Run locally

The opening Simpsons clip is a local video, `assets/panic-clip.mp4`: a short cut (0:09.5 to 0:14.233 of the original) that the slide plays from the start. Neither it nor the full 31-second download, `panic-clip-full.mp4`, is committed (third-party content); both are gitignored. To create them: download with yt-dlp (it needs a JavaScript runtime such as node, and an ffmpeg to merge video and audio), then cut. Keep the full download so the bounds can be adjusted.

```sh
uvx yt-dlp --js-runtimes node --ffmpeg-location "$(dirname "$(which ffmpeg)")" \
  -f "bv*[vcodec^=avc1][height<=720]+ba[ext=m4a]" --merge-output-format mp4 \
  -o "sumup-datascience-talk/assets/panic-clip-full.%(ext)s" "https://www.youtube.com/watch?v=KojYatpLPSE"
ffmpeg -ss 9.5 -to 14.2333 -i sumup-datascience-talk/assets/panic-clip-full.mp4 \
  -c:v libx264 -crf 20 -pix_fmt yuv420p -c:a aac -movflags +faststart sumup-datascience-talk/assets/panic-clip.mp4
```

Without a system ffmpeg, `uv run --with imageio-ffmpeg python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"` prints the path of a bundled one.


From the repository root, serve the whole repository so the iframe paths to the shared scenes and assets resolve:

```sh
./serve.sh
```

Open <http://localhost:8765/sumup-datascience-talk/index.html>.

The deck is designed at 1920×1080. `F` toggles fullscreen and `Space` advances. Scene slides forward keys to the existing standalone scenes in the repository root. The exporter can build this adaptation from the repository root:

```sh
uv run scripts/export.py --index sumup-datascience-talk/index.html \
  --name sumup-datascience-talk --out sumup-datascience-talk/dist
```

The standalone HTML in `dist/` includes the shared assets and animations and can be copied to another computer. The PDF is a static fallback: it shows the selected end state of each animation and omits the live timeline band. The dark mass-termination scene is intentional. Exports are generated files and are ignored by Git.

The root deck and its assets remain the source material and are intentionally left unchanged. The subdeck links to `../vendor`, `../shared`, `../assets`, and the existing root scene pages rather than copying those files.
