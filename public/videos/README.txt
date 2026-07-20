Hero background video

Drop your astrology/cosmos loop here so the homepage hero plays it behind the content:

  public/videos/hero-cosmos.mp4          (required, H.264 MP4)
  public/videos/hero-cosmos.webm         (optional, smaller/better; loaded first)
  public/videos/hero-cosmos-poster.jpg   (still frame shown before the video loads)

Guidelines for a good, fast hero video:
- Theme: slow starfield / nebula / rotating cosmos / galaxy. Calm, dark, no on-screen text.
- Duration: 8-20s, seamless loop.
- Resolution: 1920x1080 is plenty. Keep the file under ~3-5 MB so it loads fast.
- Muted (it autoplays muted + looping; audio is ignored).
- The video is hidden on mobile (<=768px) to save data; the poster/gradient shows there.

Where to get royalty-free clips: Pexels Videos, Pixabay, Coverr (search "space", "nebula", "stars", "galaxy").

Optimize with ffmpeg:
  ffmpeg -i input.mp4 -vf "scale=1920:-2" -c:v libx264 -crf 28 -preset slow -an -movflags +faststart hero-cosmos.mp4
  ffmpeg -i input.mp4 -vf "scale=1920:-2" -c:v libvpx-vp9 -crf 34 -b:v 0 -an hero-cosmos.webm
  ffmpeg -i input.mp4 -vframes 1 -q:v 3 hero-cosmos-poster.jpg

Until a file is added here, the hero gracefully falls back to the existing cosmic gradient + starfield.
