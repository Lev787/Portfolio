# Security Guard

A simple browser-based Node.js app: opens a camera page, detects object movement, and plays different sounds depending on the movement direction.

## Features

- Runs on Node.js without external dependencies.
- Captures camera video through `getUserMedia`.
- Detects motion using frame-to-frame difference.
- Detects directions: left, right, up, down.
- Estimates forward and backward movement by tracking motion area changes.
- Plays a separate sound for each motion type.
- Triggers a siren when the object moves back.
- Includes a polished UI, event log, and sensitivity controls.

## How to Run

1. Make sure Node.js is installed.
2. In the project folder, run:

```bash
npm start
```

3. Open `http://127.0.0.1:3000` in your browser.
4. Click "Enable Camera" and allow camera access.

## Open Without Server

You can also open [public/index.html](C:/Users/kuritsa/Documents/htmlcssjs/SecurityGuard/public/index.html) directly from the file system. The page will now load its local CSS and JS correctly without `npm start`.

Note: camera access from a direct `file://` launch depends on the browser. If the camera is blocked, use `npm start` and open `http://127.0.0.1:3000`.

## 10 Ideas for Future Improvements

1. Upload custom sounds for each movement.
2. Save a screenshot on alarm.
3. Keep an event history with JSON export.
4. Create separate security zones in the frame.
5. Send Telegram notifications.
6. Email alarm snapshots automatically.
7. Add a night mode with better contrast.
8. Recognize the object type.
9. Enable automatic arming on a schedule.
10. Control the system remotely from a phone.
