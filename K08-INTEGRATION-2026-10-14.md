# Kitchen and room integration — 2026-10-14

This branch includes the room-document work and the reviewed K08 kitchen changes previously kept on D:. The source integration checked the recorded SHA256 before replacing any file and preserved the old working files outside the repository.

Changes: measured-room documents and recovery; kitchen alignment/editing; Premial sink with actual worktop opening and plumbing envelopes; oven with a separate installation body and configurable lower drawer; hob, hood and dishwasher room objects; dishwasher-to-sink connection and obstruction warnings. Development-only local backups use a per-process token and stay ignored by Git.

Verification after integration: 769/769 tests via npm test, TypeScript and Vite build. The oven-600 collision regression that failed on the previous C copy now passes. The identical K08 source was also exercised in 14/14 Chrome room/kitchen scenarios; server accounts/history/ownership passed 20/20 tests on temporary databases on 2026-10-14. Test fixtures contain a synthetic UI-built kitchen, not a customer order.

Limitations: incomplete catalogue prices and placement warnings remain; generic appliance geometry and routes are layout aids, not exact manufacturer installation drawings. The saved K08 example and the full manufacturing export still need explicit acceptance. These checks do not confirm a live VPS or public-site deployment.

Run: npm ci, npm test, npm run build in studio. The K08 regression is included in the default test command. Server requirements remain in server/studio-requirements-lock.txt.