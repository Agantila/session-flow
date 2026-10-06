# Marketplace

This directory contains the assets and manifest that make Session Flow
discoverable in a Hermes-Desktop marketplace / plugin store.

## `marketplace.json` (repo root)

A versioned manifest describing the plugin for marketplace listings:

- Identity: `id`, `name`, `version`, `license`, `author`, `homepage`, `repository`
- Discovery: `icon`, `banner`, `tagline`, `summary`, `description`, `categories`, `tags`
- Media: links to all 8 heroes, 3 social crops, the 19 component cards, and the
  5-second Hyperframes animation (MP4 / WebM / GIF)
- Install: deep link (`hermes://plugin/install?repo=agantila/session-flow`),
  platform compatibility, runtime requirements, peer dependencies
- Provenance: tested-on, locales, size

The schema lives at `https://hermes-agent.nousresearch.com/schemas/plugin-marketplace/v1.json`
(forward reference — final URL may be defined by the marketplace owner; the
fields used here are conservative and only reference relative paths and
plain metadata).

## Discoverability checklist

- [x] `marketplace.json` at repo root
- [x] `icon` field → 16:9 hero (3200×1800)
- [x] `banner` field → animated 5s preview
- [x] `media.showcase[]` → 8 hero images
- [x] `media.social_crops_4x5[]` → 3 vertical crops for cards
- [x] `media.components_1x1` → folder reference to all 19 component cards
- [x] `media.hyperframes_5s` → 3 formats (MP4/WebM/GIF)
- [x] `install.deepLink` → one-tap install via Hermes protocol
- [x] `locales[]` → en + de (matches the plugin's i18n keys)
- [x] Repo frontmatter in README.md is short, scannable, and links to the
      showcase gallery above the fold
- [x] `categories` and `tags` align with the plugin's primary user-value:
      chat, sidebar, session-management, ui-tweaks, productivity

## Verification

The marketplace.json is valid JSON; the referenced media files all exist
under `docs/marketing/`. To verify after a re-render:

```bash
# Every media path must resolve:
for path in $(jq -r '
  .icon, .banner,
  (.media.showcase[]),
  (.media.social_crops_4x5[]),
  .media.hyperframes_5s.mp4,
  .media.hyperframes_5s.webm,
  .media.hyperframes_5s.gif
' marketplace.json); do
  test -f "$path" || echo "MISSING: $path"
done
```
