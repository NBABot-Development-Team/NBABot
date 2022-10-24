const puppeteer = require('puppeteer');
const path = require('path');
const downloadPath = path.resolve('./');

async function simplefileDownload() {
    const browser = await puppeteer.launch({
        executablePath: `/usr/bin/chromium-browser`,
        headless: false
    });
    
    const page = await browser.newPage();
    await page.goto(
        'https://www.nba.com/game/mil-vs-phi-0022200015/game-charts', 
        { waitUntil: 'networkidle2' }
    );
    
    await page._client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath 
    });
    await page.click('.SaveSvgButton_saveSvgButton__vqekw');
}
simplefileDownload();