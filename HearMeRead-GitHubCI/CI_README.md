# Hear Me Read — GitHub CI Builder

This project is set up so **GitHub Actions** builds the macOS **.dmg** for you automatically.

## Steps
1. Create a new GitHub repository (e.g., `HearMeRead`).
2. Drag & drop **all files** from this folder into the repo and commit.
3. Go to the **Actions** tab → open **Build macOS DMG**.
4. Click **Run workflow** (green button).

When it finishes, click into the run → download the **Artifacts** named `HearMeRead-macOS-dmg`. Inside you'll find `Hear Me Read-<version>.dmg`.

### Local development (optional)
```
npm install
npm start
```
Build locally (optional):
```
npx electron-builder --mac
```
