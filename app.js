const puppeteer = require("puppeteer-extra");

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const UserAgentPlugin = require("puppeteer-extra-plugin-anonymize-ua");
puppeteer.use(UserAgentPlugin({makeWindows: true}));

const encodeUrl = require('encodeurl');

const xlsx = require('xlsx');
const workbook = xlsx.readFile(__dirname + '/xlsx/youtube.xlsx');

const sheet = workbook.SheetNames;
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet[0]]);

const searchSystemUrl = 'https://www.google.com/';

// Массив с прокси
let proxy = [
];

async function main(poxyI) {

    const browser = await puppeteer.launch({
        headless: false,
        ignoreHTTPSErrors: true,
        args: [
            '--no-sandbox',
            '--incognito',
            '--disable-setuid-sandbox',
            // '--proxy-server=socks5=' + proxy[poxyI]
        ],

        defaultViewport: {
            width: 1920,
            height: 1200
        }
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({width: 1920, height: 1200});

        for (const i in data) {
            if (data[i].url !== undefined) {
                continue;
            }

            await page.goto(
                searchSystemUrl + encodeUrl('search?q=фк+'+data[i].Name+'+wikipedia'),
                {waitUntil: 'domcontentloaded'}
            );

            let wikiLink = await page.evaluate(() => {
                if (!document.querySelector('#rso')) {
                    throw 'Google Error';
                }

                let link = document.querySelector('#rso > div:nth-child(1) > div > div > div > div > div.r > a');

                if (!link) {
                    return false;
                }

                return link.href;
            });

            if (!wikiLink) {
                data[i].url = '';
                continue;
            }

            await page.goto(
                wikiLink,
                {waitUntil: 'domcontentloaded'}
            );

            // Ищем в википедии ссылку на youtube, если не найдена, то на оффициальный сайт клуба
            let officialLink = await page.evaluate(() => {

                for (const a of document.querySelectorAll('a')) {
                    if(['YouTube'].includes(a.textContent)) {
                        return a.href;
                    }
                }

                for (const a of document.querySelectorAll('a')) {
                    if (['Официальный сайт', 'Official website', 'Официальный сайт клуба'].includes(a.textContent)) {
                        return a.href;
                    }
                }

                return false;
            });


            if (!officialLink) {
                data[i].url = '';
                continue;
            }

            if (officialLink.match(/((http|https):\/\/|)(www\.|)youtube\.com\/(channel\/|user\/)[a-zA-Z0-9\-]{1,}/)) {
                data[i].url = officialLink;
                continue;
            }

            // Поиск ссылки youtube на оффициальном сайте
            try{
                await page.goto(
                    officialLink,
                    {waitUntil: 'domcontentloaded'}
                );

                let yotubeLink = await page.evaluate(() => {
                    let str = document.body;
                    if (!str) {
                        return false;
                    }

                    str = str.innerHTML;

                    return str.match(/((http|https):\/\/|)(www\.|)youtube\.com\/(channel\/|user\/)[a-zA-Z0-9\-]{1,}/);
                });

                if (yotubeLink instanceof Array && yotubeLink[0]) {
                    data[i].url = yotubeLink[0];
                    console.log('Youtube link '+yotubeLink[0]);
                } else {
                    data[i].url = '';
                }
            } catch (e) {
                data[i].url = 'Not found';
            }
        }
        const ws = await xlsx.utils.json_to_sheet(data);
        const wb = await xlsx.utils.book_new();
        await xlsx.utils.book_append_sheet(wb, ws, 'Youtube');
        await xlsx.writeFile(wb, __dirname + '/xlsx/result.xlsx');
    } catch (e) {
        await browser.close();
        await main(Math.floor(Math.random() * 6));
    }
}

main(0);
