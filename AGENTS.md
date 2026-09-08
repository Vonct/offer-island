# Development boundary

This directory is an independent Git repository. Run Git commands from this root.
The parent directory may contain a separately maintained personal profile site.
Do not stage, copy, deploy, or modify parent files as part of this project unless the user asks.

- Public seed data must be fictional; never copy personal applications, resumes, screenshots, credentials, or private deployment configuration from the parent.
- Preserve user data across upgrades. Keep demo mode isolated from persistent storage.
- Keep source statuses and evidence; do not infer interview dates or completion from ambiguous text.
- Manual UI and Agent tools must use the same validation and mutation layer.
- Clearly distinguish implemented features from roadmap items.
- Preview: npm start (SQLite), or python3 -m http.server 8780 --bind 127.0.0.1 --directory web (browser storage)
- Keep this prototype dependency-light until a concrete feature needs a framework.

- Run npm test after model/server changes; build native changes with npm run build:mac.
- Public deployments publish web/ only. Never upload SQLite, private source config, or the parent project.
