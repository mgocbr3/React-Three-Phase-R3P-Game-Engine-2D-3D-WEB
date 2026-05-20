# PixlPlayground Studio Security Notes

## Current Guardrails

- No real `.env` is committed with the imported Studio app.
- Supabase and Pixlland platform URLs/keys are read from `VITE_*` variables.
- The engine lives in `engine/` as an isolated workspace so platform code and editor code can be reviewed separately.

## Next Guardrails

- Add schema validation for scene documents and imported manifests.
- Sandbox future script execution and previewed user code.
- Restrict asset imports to expected file types and size limits.
- Add CLI validation before publishing games to Pixlland.
- Run a dedicated security scan before exposing the downloadable public editor.
