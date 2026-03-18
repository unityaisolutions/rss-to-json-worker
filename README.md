# rss-to-json-worker
A Cloudflare Worker API for collecting an RSS feed and returning it as clean json.

I use Bun as the package manager. If you are using a Github Codespace, I've defined a ```devcontainer.json``` to automatically set Bun up.

After the Codespace is set up, just run ```bun i``` to install the dependencies, and then you are good to go!

I'm going to host a heavily rate-limited public version of this API (on Cloudflare!), and because of the rate-limiting (which is IP based) it will have slightly different code which will be kept private. It still uses the same base code as this repo though!