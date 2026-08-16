# Terra Invicta Tech Tree — Interactive Viewer (Updated & Maintained)

**Live site: [https://pzixel.github.io/terra-invicta-techtree-update/](https://pzixel.github.io/terra-invicta-techtree-update/)**

An interactive, up-to-date **technology tree viewer for [Terra Invicta](https://store.steampowered.com/app/1176470/Terra_Invicta/)**, the grand strategy game by Pavonis Interactive. Browse every technology and project in the game: prerequisites, research costs, effects, and unlocked modules, habs, and ship parts.

This is an actively maintained fork of the original tech tree website ([sarahwatt.ca](https://sarahwatt.ca/terra-invicta/techtree/), no longer updated), refreshed for the latest stable and experimental game versions.

Big thanks and shoutout to spooker0 and theothersarah.

## Features

- Full tech tree graph with search and filtering
- Research cost and prerequisite chains for every tech and project
- Ship drives comparison chart
- Stable and experimental game version support
- 12 languages: English, 简体中文, 繁體中文, Deutsch, Español, Français, 日本語, Polski, Português, 한국어, Русский, Українська

## To regenerate icons

1. Have `habmodules` and `shipbuildericons` files in `./resources` folder. You can find them at `C:\Program Files (x86)\Steam\steamapps\common\Terra Invicta\TerraInvicta_Data\StreamingAssets\AssetBundles`
2. run
    ```bash
    rm -rf ./public/icons/habmodules/ ./public/icons/shipbuildericons

    python scripts/export_unity_textures.py ./resources ./public/icons
    ```

I am currently using icons from the experimental branch, it should be working fine. If it's not then fix it (like keep two separate icons sets maybe?). For now seems excessive.
