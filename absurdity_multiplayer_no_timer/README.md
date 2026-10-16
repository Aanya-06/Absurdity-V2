# ABSURDITY — Online Multiplayer (GitHub Pages + Firebase)

## Included files
- index.html — game interface
- game.js — multiplayer room, timer, reveal and score logic
- questions.js — 50 Indian-culture questions
- firebase-config.js — paste Firebase Web app configuration here
- database.rules.json — TEMPORARY playtest database rules (see security warning)

## GitHub Pages
Upload index.html, game.js, questions.js and firebase-config.js to the **same published directory** of your GitHub Pages repository. Commit changes. Do not upload the ZIP itself as the website. If the site is published from /docs, put them there rather than the root.

## Firebase Console setup
1. Visit https://console.firebase.google.com and create a project.
2. Project settings (gear) > Your apps > Add app > Web (</>) > Register app. No Firebase Hosting setup needed.
3. Copy the firebaseConfig object values into firebase-config.js. Be sure databaseURL is correct (see step 5).
4. Build > Authentication > Get started > Sign-in method > Anonymous > Enable > Save.
5. Build > Realtime Database > Create Database > choose a region > Locked mode. Copy the **database URL** shown on its Data page. It can end in firebaseio.com or firebasedatabase.app.
6. Realtime Database > Rules > paste contents of database.rules.json > Publish.
7. Commit the updated firebase-config.js to GitHub. Wait for GitHub Pages to deploy.
8. Open your GitHub Pages URL, type a name, create a room, tap Share invite link. Send to friends through WhatsApp.
9. Friends open link, enter their name, tap Join room; host taps Start game after at least two people join.

## Important security warning
The provided database rules are for a short private playtest ONLY. They allow any anonymously signed-in user who discovers your database to read or modify room data. This is not production-grade security. Do not use it for sensitive content or a public launch. Replace with server-enforced room membership, per-player writes, and validated score/round transitions (e.g. Cloud Functions) before public release. Delete test rooms afterward or tighten rules.

## Game behavior and limitations
- 2–12 players, no user-facing accounts.
- No timer: players answer at their own pace; reveal occurs automatically once all players submit.
- All answers private in the UI until the round reveal, but broad test rules do not protect database access.
- Answers: maximum 3 words; blanks score 0.
- Case, spaces, punctuation ignored for matching; synonyms and translations are not automatically matched.
- Unique answer: +1; matched: 0; first to 8 wins.
- The host controls the start and next round. If host leaves, the game cannot advance to a new round.
- Players should keep their tab open; browser session identity is used to rejoin. Reopening from another browser may create a new identity.
- No countdown timer is used.
- Room data is retained in Firebase until manually deleted; no automatic cleanup.
- Firebase service usage is subject to its current pricing and free quotas.
