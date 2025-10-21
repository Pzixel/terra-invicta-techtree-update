# Terra Invicta Tech tree web site

Big thanks and shoutout to spooker0 and theothersarah


## To regenerate icons

1. Have `habmodules` and `shipbuildericons` files in `./resources` folder. You can find them at `C:\Program Files (x86)\Steam\steamapps\common\Terra Invicta\TerraInvicta_Data\StreamingAssets\AssetBundles`
2. run
    ```bash
    rm -rf ./public/icons/habmodules/ ./public/icons/`shipbuildericons`

    python scripts/export_unity_textures.py ./resources ./icons
    ```

I am currently using icons from the experimental branch, it should be working fine. If it's not then fix it (like keep two separate icons sets maybe?). For now seems excessive.