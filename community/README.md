# Examples

Two recorded builds, kept here so you can see what the bridge actually does
without leaving the repo. Each is a `session.json` that replays on a fresh
Blender scene:

| project | what it shows |
|---|---|
| [`cable_comb`](cable_comb/) | a two-part pin joint built to measured 3D-printing design rules |
| [`stackable_bin`](stackable_bin/) | a parametric bin that nests into the one below it |

```bash
# with the bridge running and Blender open
blender-mcp-bridge play community/cable_comb/session.json
```

## The rest of the gallery

The full collection — benchy, architectural scenes, the modular profile rack,
the Y-zipper teardown and more — lives in its own repository:

**[blender-mcp-community](https://github.com/seehiong/blender-mcp-community)**

It is separate because the models are heavy and the server is not: 100+ STLs
worth of history that nobody installing the bridge should have to download.
Contributions go there.
