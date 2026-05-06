const fs = require('fs');

const rawData = fs.readFileSync('output2.html', 'utf8');
const match = rawData.match(/window\.__remixContext = (.*?);<\/script>/);
if (match) {
    const data = JSON.parse(match[1]);
    const route = data.state.loaderData["routes/$username.$friendlyId"];
    const html = route.post.html;
    const css = route.post.css;
    fs.writeFileSync('extracted.txt', "HTML:\n" + html + "\n\nCSS:\n" + css);
}

