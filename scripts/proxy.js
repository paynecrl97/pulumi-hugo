const http = require("http");
const httpProxy = require("http-proxy");
const got = require("got");
const JSDOM = require("jsdom").JSDOM;

const proxy = httpProxy.createProxyServer();

const server = http.createServer((req, res) => {
    proxy.web(req, res, {
        target: "http://localhost:1314",
        selfHandleResponse: true,
    });
});

proxy.on("proxyRes", async (proxyRes, thisReq, thisRes) => {
    let responseCode = proxyRes.statusCode;
    let responseBody = [];

    if (responseCode === 404) {
        console.log(`${thisReq.url} returned ${proxyRes.statusCode}. Fetching from pulumi.com...`);

        try {
            const siteRes = await got(`https://www.pulumi.com${thisReq.url}`);
            responseCode = siteRes.statusCode;

            // Modify the DOM returned by the website.
            const dom = new JSDOM(siteRes.body);

            // Replace JS bundles with local versions.
            dom.window.document.querySelectorAll("script").forEach(el => {
                const src = el.getAttribute("src");

                if (src && src.startsWith("/js/bundle.min.push-")) {
                    el.setAttribute("src", process.env.REL_JS_BUNDLE);
                }
            });

            // Replace CSS bundles with local versions.
            dom.window.document.querySelectorAll("link").forEach(el => {
                const href = el.getAttribute("href");

                if (href && href.startsWith("/css/styles.push-")) {
                    el.setAttribute("href", process.env.REL_CSS_BUNDLE);
                }
            });

            responseBody = dom.serialize();
        }
        catch (error) {
            responseCode = error.response.statusCode;
            responseBody = `Sorry, bro.`;
        }

        thisRes.statusCode = responseCode;
        thisRes.end(responseBody);
    } else {
        proxyRes.on("data", chunk => responseBody.push(chunk));
        proxyRes.on("end", () => {
            responseBody = Buffer.concat(responseBody).toString();
            thisRes.end(responseBody);
        });
    }
})

server.listen(1313);
