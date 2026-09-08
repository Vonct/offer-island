# Development boundary

This directory is an independent Git repository. Run Git commands from this root.
The parent directory may contain a separately maintained personal profile site.
Do not stage, copy, deploy, or modify parent files as part of this project unless the user asks.

- Public seed data must be fictional; never copy personal applications, resumes, screenshots, credentials, or private deployment configuration from the parent.
- Preserve user data across upgrades. Keep demo mode isolated from persistent storage.
- Keep source statuses and evidence; do not infer interview dates or completion from ambiguous text.
- Manual UI and future Agent tools must use the same validation and mutation layer.
- Clearly distinguish implemented features from roadmap items.
- Preview: python3 -m http.server 8780 --bind 127.0.0.1 --directory web
- Keep this prototype dependency-light until a concrete feature needs a framework.
